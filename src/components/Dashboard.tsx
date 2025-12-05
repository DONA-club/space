"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Scene3DViewer } from './Scene3DViewer';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, History, LogOut, ArrowLeft, Menu, X } from 'lucide-react';
import { TbMinimize } from 'react-icons/tb';
import { SensorPanel } from './SensorPanel';
import { TimelineControl } from './TimelineControl';
import { FileUploadPanel } from './FileUploadPanel';
import { DataControlPanel } from './DataControlPanel';
import { supabase } from '@/integrations/supabase/client';
import PsychrometricSvgChart from './PsychrometricSvgChart';
import { useChartPoints } from '@/hooks/useChartPoints';

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
  const scienceExpanded = useAppStore((state) => state.scienceExpanded);
  const chartPoints = useAppStore((state) => state.chartPoints);
  const outdoorData = useAppStore((state) => state.outdoorData);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setScienceExpanded = useAppStore((state) => state.setScienceExpanded);
  const setIsInterpolationExpanded = useAppStore((state) => state.setIsInterpolationExpanded);
  
  const [spaceAddress, setSpaceAddress] = useState<string>('');

  // Calcul/MAJ centralisés des points du diagramme (live & replay)
  useChartPoints();
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

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

      const formatAddress = (addr: any) => {
        if (!addr || typeof addr !== 'object') return '';
        const number = addr.house_number || '';
        const road = addr.road || addr.pedestrian || addr.footway || addr.cycleway || addr.path || '';
        const postcode = addr.postcode || '';
        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || '';
        const region = addr.state || addr.region || addr.county || '';
        const country = addr.country || '';

        const street = [number, road].filter(Boolean).join(' ').trim();
        const cityPart = [postcode, city].filter(Boolean).join(' ').trim();
        const regionPart = [region, country].filter(Boolean).join(', ').trim();

        return [street, cityPart, regionPart].filter(Boolean).join(', ');
      };

      if (data?.address) {
        const formatted = formatAddress(data.address);
        if (formatted) {
          setSpaceAddress(formatted);
        } else if (data.display_name) {
          setSpaceAddress(data.display_name);
        }
      } else if (data?.display_name) {
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

  // Affiche le panneau d'import modèle si aucun modèle 3D n'est chargé,
  // mais ne masque plus les autres panneaux quand la liste de capteurs est vide.
  const showFileUpload = !gltfModel;
  const hasSensorMapping = sensors.length > 0;

  return (
    <div className="h-screen overflow-hidden p-2 sm:p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full gap-2 sm:gap-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0"
        >
          <LiquidGlassCard className="p-2 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBackToSpaces}
                  className="hover:bg-white/50 dark:hover:bg-black/50 h-8 px-2 sm:px-3"
                >
                  <ArrowLeft size={16} className="sm:mr-2" />
                  <span className="hidden sm:inline bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">
                    Space
                  </span>
                </Button>
                
                <div className="hidden sm:block border-l border-gray-300 dark:border-gray-600 h-8"></div>
                
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                    {currentSpace?.name || 'Space'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">
                    {loadingAddress ? (
                      'Chargement...'
                    ) : spaceAddress ? (
                      <span className="hidden sm:inline">{spaceAddress}</span>
                    ) : currentSpace?.description ? (
                      currentSpace.description
                    ) : (
                      `${sensors.length} capteur${sensors.length > 1 ? 's' : ''}`
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {!showFileUpload && (
                  <>
                    <Tabs value={mode} onValueChange={(v) => setMode(v as 'live' | 'replay')} className="hidden sm:block">
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
                          <span className="hidden md:inline">Replay</span>
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
                          <span className="hidden md:inline">Live</span>
                          {wsConnected && mode === 'live' && (
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMobilePanel(!showMobilePanel)}
                      className="sm:hidden h-8 w-8 p-0"
                    >
                      {showMobilePanel ? <X size={16} /> : <Menu size={16} />}
                    </Button>
                  </>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="bg-white/50 dark:bg-black/50 h-8 w-8 p-0"
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </LiquidGlassCard>
        </motion.div>


        {showFileUpload && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto w-full"
          >
            <FileUploadPanel />
          </motion.div>
        )}
        <>
          {/* Mobile: Stacked layout */}
          <div className="flex-1 min-h-0 flex flex-col lg:hidden gap-2">
            {/* 3D Scene */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className={`${showMobilePanel ? 'h-1/3' : 'flex-1'} min-h-[200px] transition-all duration-300`}
            >
              <LiquidGlassCard className="p-2 h-full">
                <div className="relative w-full h-full">
                  <Scene3DViewer />
                </div>
              </LiquidGlassCard>
            </motion.div>

            {/* Mobile Panel */}
            {showMobilePanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-1 overflow-y-auto"
              >
                <SensorPanel />
              </motion.div>
            )}

            {/* Timeline & Données (mobile) */}
            <div className="flex-shrink-0 space-y-2">
              {hasSensorMapping && <DataControlPanel />}
              {mode === 'replay' && dataReady && <TimelineControl />}
              {mode === 'live' && <TimelineControl />}
            </div>
          </div>

          {/* Desktop/Tablet: Side-by-side layout */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-4 flex-1 min-h-0">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 h-full min-h-0"
            >
              <LiquidGlassCard className="p-4 h-full">
                <div className="relative w-full h-full">
                  {scienceExpanded ? (
                    <>
                      <PsychrometricSvgChart
                        points={chartPoints}
                        outdoorTemp={outdoorData ? outdoorData.temperature : null}
                        animationMs={isPlaying ? 100 : 250}
                      />
                      <div className="absolute top-2 right-2 z-10">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 bg-white/70 dark:bg-black/40 backdrop-blur"
                          onClick={() => {
                            // Forcer la fermeture du panneau Interpolation quand on réduit Monitoring
                            setIsInterpolationExpanded(false);
                            setScienceExpanded(false);
                          }}
                          aria-label="Réduire"
                          title="Réduire"
                        >
                          <TbMinimize size={18} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Scene3DViewer />
                  )}
                </div>
              </LiquidGlassCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full min-h-0 space-y-4 overflow-y-auto"
            >
              {scienceExpanded ? (
                <LiquidGlassCard className="p-2">
                  <div className="relative w-full h-[360px]">
                    <Scene3DViewer />
                  </div>
                </LiquidGlassCard>
              ) : (
                <SensorPanel />
              )}
            </motion.div>
          </div>

          {/* Desktop Timeline & Données */}
          <div className="hidden lg:block flex-shrink-0 space-y-4">
            {hasSensorMapping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <DataControlPanel />
              </motion.div>
            )}

            {mode === 'replay' && dataReady && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <TimelineControl />
              </motion.div>
            )}

            {mode === 'live' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <TimelineControl />
              </motion.div>
            )}
          </div>
        </>
      </div>
    </div>
  );
};