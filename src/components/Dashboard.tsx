"use client";

import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Scene3DViewer } from './Scene3DViewer';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, History, LogOut } from 'lucide-react';
import { SensorPanel } from './SensorPanel';
import { TimelineControl } from './TimelineControl';
import { FileUploadPanel } from './FileUploadPanel';

export const Dashboard = () => {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const wsConnected = useAppStore((state) => state.wsConnected);
  const logout = useAppStore((state) => state.logout);
  const sensors = useAppStore((state) => state.sensors);
  const gltfModel = useAppStore((state) => state.gltfModel);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('machineId');
    logout();
  };

  const showFileUpload = !gltfModel || sensors.length === 0;

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
      <div className="max-w-7xl mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LiquidGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  DONA.club Space
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Visualisation environnementale 3D - {sensors.length} capteurs
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!showFileUpload && (
                  <Tabs value={mode} onValueChange={(v) => setMode(v as 'live' | 'replay')}>
                    <TabsList className="bg-white/50 dark:bg-black/50">
                      <TabsTrigger value="replay" className="flex items-center gap-2">
                        <History size={16} />
                        Replay
                      </TabsTrigger>
                      <TabsTrigger value="live" className="flex items-center gap-2">
                        <Radio size={16} />
                        Live
                        {wsConnected && (
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
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
            className="max-w-2xl mx-auto"
          >
            <FileUploadPanel />
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2"
              >
                <LiquidGlassCard className="p-4 min-h-[600px]">
                  <div className="w-full h-[568px]">
                    <Scene3DViewer />
                  </div>
                </LiquidGlassCard>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <SensorPanel />
              </motion.div>
            </div>

            {mode === 'replay' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <TimelineControl />
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
};