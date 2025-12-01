"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Scene3DViewer } from './Scene3DViewer';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, History, LogOut, ArrowLeft } from 'lucide-react';
import { SensorPanel } from './SensorPanel';
import { TimelineControl } from './TimelineControl';
import { FileUploadPanel } from './FileUploadPanel';
import { DataControlPanel } from './DataControlPanel';
import { supabase } from '@/integrations/supabase/client';

interface DashboardProps {
  onBackToSpaces: () => void;
}

export const Dashboard = ({ onBackToSpaces }: DashboardProps) => {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const wsConnected = useAppStore((state) => state.wsConnected);
  const logout = useAppStore((state) => state.logout);
  const sensors = useAppStore((state) => state.sensors);
  const gltfModel = useAppStore((state) => state.gltfModel);
  const dataReady = useAppStore((state) => state.dataReady);
  const currentSpace = useAppStore((state) => state.currentSpace);
  
  const [spaceAddress, setSpaceAddress] = useState<string>('');
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    if (currentSpace?.latitude && currentSpace?.longitude) {
      loadSpaceAddress();
    }
  }, [currentSpace]);

  const loadSpaceAddress = async () => {
    if (!currentSpace?.latitude || !currentSpace?.longitude) return;

    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentSpace.latitude}&lon=${currentSpace.longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        setSpaceAddress(data.display_name);
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
  };

  const showFileUpload = !gltfModel || sensors.length === 0;

  return (
    <div className="h-screen overflow-hidden p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full gap-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0"
        >
          <LiquidGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBackToSpaces}
                  className="hover:bg-white/50 dark:hover:bg-black/50"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">
                    Space
                  </span>
                </Button>
                
                <div className="border-l border-gray-300 dark:border-gray-600 h-8"></div>
                
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {currentSpace?.name || 'Space'}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {loadingAddress ? (
                      'Chargement de la localisation...'
                    ) : spaceAddress ? (
                      spaceAddress
                    ) : currentSpace?.description ? (
                      currentSpace.description
                    ) : (
                      `${sensors.length} capteur${sensors.length > 1 ? 's' : ''} configuré${sensors.length > 1 ? 's' : ''}`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!showFileUpload && (
                  <Tabs value={mode} onValueChange={(v) => setMode(v as 'live' | 'replay')}>
                    <TabsList className="bg-white/50 dark:bg-black/50">
                      <TabsTrigger 
                        value="replay" 
                        className={`flex items-center gap-2 ${
                          mode === 'replay' 
                            ? 'text-green-600 dark:text-green-400 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400' 
                            : 'text-gray-400 dark:text-gray-500 data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:text-gray-500'
                        }`}
                      >
                        <History size={16} />
                        Replay
                      </TabsTrigger>
                      <TabsTrigger 
                        value="live" 
                        className={`flex items-center gap-2 ${
                          mode === 'live' 
                            ? 'text-red-600 dark:text-red-400 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400' 
                            : 'text-gray-400 dark:text-gray-500 data-[state=inactive]:text-gray-400 dark:data-[state=inactive]:text-gray-500'
                        }`}
                      >
                        <Radio size={16} />
                        Live
                        {wsConnected && mode === 'live' && (
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="bg-white/50 dark:bg-black/50"
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </LiquidGlassCard>
        </motion.div>

        {showFileUpload ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto flex-1 overflow-y-auto"
          >
            <FileUploadPanel />
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 h-full min-h-0"
              >
                <LiquidGlassCard className="p-4 h-full">
                  <div className="relative w-full h-full">
                    <Scene3DViewer />
                  </div>
                </LiquidGlassCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="h-full min-h-0 space-y-4 overflow-y-auto"
              >
                <SensorPanel />
              </motion.div>
            </div>

            {mode === 'replay' && (
              <div className="flex-shrink-0 space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <DataControlPanel />
                </motion.div>
                
                {dataReady && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <TimelineControl />
                  </motion.div>
                )}
              </div>
            )}

            {mode === 'live' && (
              <div className="flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <TimelineControl />
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};