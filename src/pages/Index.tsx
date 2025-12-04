"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { AuthPage } from '@/components/AuthPage';
import { SpaceManager } from '@/components/SpaceManager';
import { Dashboard } from '@/components/Dashboard';
import { Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import ZoneAdjustPanel from '@/components/ZoneAdjustPanel';

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

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Replace comma with dot for decimal separator
      return parseFloat(value.replace(',', '.'));
    }
    return 0;
  };

  const handleSpaceSelected = async (space: any) => {
    try {
      setCurrentSpace(space);

      // Espace éphémère (local) : charger depuis les données locales
      if ((space as any).isEphemeral) {
        const localGltfUrl: string | null = (space as any).localGltfUrl || null;
        const localJsonText: string | null = (space as any).localJsonText || null;

        if (localGltfUrl) {
          setGltfModel(localGltfUrl);
        } else {
          setGltfModel(null);
        }

        if (localJsonText) {
          let text = localJsonText.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
          const data = JSON.parse(text);

          if (data.points && Array.isArray(data.points)) {
            const sensors = data.points.map((point: any, index: number) => {
              const x = parseNumber(point.x);
              const y = parseNumber(point.y);
              const z = parseNumber(point.z);

              if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.error(`Invalid coordinates for point ${index}:`, point);
                throw new Error(`Coordonnées invalides pour le point ${index + 1}`);
              }

              return {
                id: index + 1,
                position: [x, y, z] as [number, number, number],
                name: point.name || `Capteur ${index + 1}`,
              };
            });

            if (sensors.length === 0) {
              throw new Error('Aucun capteur trouvé dans le fichier JSON');
            }

            setSensors(sensors);
          } else {
            throw new Error('Format JSON invalide : le fichier doit contenir un tableau "points"');
          }
        }

        setShowSpaceManager(false);
        return;
      }

      // Espace persistant: charger depuis Supabase
      if (space.gltf_file_path) {
        const { data: gltfData, error: gltfError } = await supabase.storage
          .from('models')
          .download(space.gltf_file_path);

        if (gltfError) throw gltfError;

        if (gltfData) {
          const url = URL.createObjectURL(gltfData);
          setGltfModel(url);
        }
      }

      if (space.json_file_path) {
        const { data: jsonData, error: jsonError } = await supabase.storage
          .from('models')
          .download(space.json_file_path);

        if (jsonError) throw jsonError;

        if (jsonData) {
          let text = await jsonData.text();
          text = text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
          const data = JSON.parse(text);

          if (data.points && Array.isArray(data.points)) {
            const sensors = data.points.map((point: any, index: number) => {
              const x = parseNumber(point.x);
              const y = parseNumber(point.y);
              const z = parseNumber(point.z);

              if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.error(`Invalid coordinates for point ${index}:`, point);
                throw new Error(`Coordonnées invalides pour le point ${index + 1}`);
              }

              return {
                id: index + 1,
                position: [x, y, z] as [number, number, number],
                name: point.name || `Capteur ${index + 1}`,
              };
            });

            if (sensors.length === 0) {
              throw new Error('Aucun capteur trouvé dans le fichier JSON');
            }

            setSensors(sensors);
          } else {
            throw new Error('Format JSON invalide : le fichier doit contenir un tableau "points"');
          }
        }
      }

      setShowSpaceManager(false);
    } catch (error) {
      console.error('Error loading space:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors du chargement de l\'espace');
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

  return (
    <>
      <Dashboard onBackToSpaces={() => setShowSpaceManager(true)} />
      <ZoneAdjustPanel />
    </>
  );
};

export default Index;