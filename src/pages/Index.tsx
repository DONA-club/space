"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { AuthPage } from '@/components/AuthPage';
import { SpaceManager } from '@/components/SpaceManager';
import { Dashboard } from '@/components/Dashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [showSpaceManager, setShowSpaceManager] = useState(false);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const setAuth = useAppStore((state) => state.setAuth);
  const setCurrentSpace = useAppStore((state) => state.setCurrentSpace);
  const setGltfModel = useAppStore((state) => state.setGltfModel);
  const setSensors = useAppStore((state) => state.setSensors);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuth(session.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuth(session.user);
      } else {
        setAuth(null);
        setCurrentSpace(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setAuth, setCurrentSpace]);

  const handleSpaceSelected = async (space: any) => {
    try {
      setCurrentSpace(space);

      // Load GLTF model
      if (space.gltf_file_path) {
        const { data: gltfData } = await supabase.storage
          .from('models')
          .download(space.gltf_file_path);

        if (gltfData) {
          const url = URL.createObjectURL(gltfData);
          setGltfModel(url);
        }
      }

      // Load JSON positions
      if (space.json_file_path) {
        const { data: jsonData } = await supabase.storage
          .from('models')
          .download(space.json_file_path);

        if (jsonData) {
          const text = await jsonData.text();
          const data = JSON.parse(text);

          if (data.points && Array.isArray(data.points)) {
            const sensors = data.points.map((point: any, index: number) => ({
              id: index + 1,
              position: [
                parseFloat(point.x),
                parseFloat(point.y),
                parseFloat(point.z)
              ] as [number, number, number],
              name: point.name || `Capteur ${index + 1}`,
            }));

            setSensors(sensors);
          }
        }
      }

      setShowSpaceManager(false);
    } catch (error) {
      console.error('Error loading space:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (!currentSpace || showSpaceManager) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
        <div className="max-w-7xl mx-auto">
          <SpaceManager onSpaceSelected={handleSpaceSelected} />
        </div>
      </div>
    );
  }

  return <Dashboard onBackToSpaces={() => setShowSpaceManager(true)} />;
};

export default Index;