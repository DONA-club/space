import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Scene3D } from './Scene3D';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, Upload, Radio, History, LogOut } from 'lucide-react';
import { SensorPanel } from './SensorPanel';
import { TimelineControl } from './TimelineControl';

export const Dashboard = () => {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const wsConnected = useAppStore((state) => state.wsConnected);
  const logout = useAppStore((state) => state.logout);
  const sensors = useAppStore((state) => state.sensors);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('machineId');
    logout();
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 3D Visualization */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <LiquidGlassCard className="p-4 h-[600px]">
              {sensors.length > 0 ? (
                <Scene3D />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">
                      Chargement de la scène 3D...
                    </p>
                  </div>
                </div>
              )}
            </LiquidGlassCard>
          </motion.div>

          {/* Sensor Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SensorPanel />
          </motion.div>
        </div>

        {/* Timeline Control (Replay mode) */}
        {mode === 'replay' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <TimelineControl />
          </motion.div>
        )}
      </div>
    </div>
  );
};