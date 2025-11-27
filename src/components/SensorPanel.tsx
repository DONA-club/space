"use client";

import { useState, useEffect } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Upload, Thermometer, Droplets, AlertCircle, FileText, X, ChevronDown, ChevronUp, FolderUp, Grid3x3, Zap, Waves, Circle, ArrowUpRight, Box, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setSensorCsv = useAppStore((state) => state.setSensorCsv);
  const dataReady = useAppStore((state) => state.dataReady);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const setMeshingEnabled = useAppStore((state) => state.setMeshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const setInterpolationMethod = useAppStore((state) => state.setInterpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const setRbfKernel = useAppStore((state) => state.setRbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const setIdwPower = useAppStore((state) => state.setIdwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const setMeshResolution = useAppStore((state) => state.setMeshResolution);
  const visualizationType = useAppStore((state) => state.visualizationType);
  const setVisualizationType = useAppStore((state) => state.setVisualizationType);
  
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFileUpload = (sensorId: number, file: File) => {
    setSensorCsv(sensorId, file);
  };

  const clearCsv = (sensorId: number) => {
    setSensorCsv(sensorId, null as any);
  };

  const handleBulkUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    let matchedCount = 0;
    let unmatchedFiles: string[] = [];

    for (const file of fileArray) {
      if (!file.name.endsWith('.csv')) continue;

      const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
      
      const matchingSensor = sensors.find(sensor => {
        if (sensor.name === fileNameWithoutExt) return true;
        if (sensor.name.toLowerCase() === fileNameWithoutExt.toLowerCase()) return true;
        
        const normalizedSensorName = sensor.name.replace(/[\s-_]/g, '').toLowerCase();
        const normalizedFileName = fileNameWithoutExt.replace(/[\s-_]/g, '').toLowerCase();
        if (normalizedSensorName === normalizedFileName) return true;
        
        return false;
      });

      if (matchingSensor) {
        setSensorCsv(matchingSensor.id, file);
        matchedCount++;
      } else {
        unmatchedFiles.push(file.name);
      }
    }

    if (matchedCount > 0) {
      showSuccess(`${matchedCount} fichier${matchedCount > 1 ? 's' : ''} CSV associé${matchedCount > 1 ? 's' : ''} automatiquement`);
    }
    
    if (unmatchedFiles.length > 0) {
      showError(`${unmatchedFiles.length} fichier${unmatchedFiles.length > 1 ? 's' : ''} non associé${unmatchedFiles.length > 1 ? 's' : ''}: ${unmatchedFiles.slice(0, 3).join(', ')}${unmatchedFiles.length > 3 ? '...' : ''}`);
    }
  };

  const handleSensorHover = (sensorId: number) => {
    window.dispatchEvent(new CustomEvent('sensorHover', { detail: { sensorId } }));
  };

  const handleSensorLeave = () => {
    window.dispatchEvent(new CustomEvent('sensorLeave'));
  };

  const sensorsWithCsv = sensors.filter(s => s.csvFile).length;
  const allSensorsHaveCsv = sensors.length > 0 && sensorsWithCsv === sensors.length;

  useEffect(() => {
    if (dataReady) {
      setIsExpanded(false);
    }
  }, [dataReady]);

  return (
    <LiquidGlassCard className="h-full">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Capteurs</h2>
            <Badge variant="outline" className="text-xs">
              {sensors.length}
            </Badge>
            {mode === 'replay' && sensors.length > 0 && (
              <Badge 
                variant={allSensorsHaveCsv ? "default" : "secondary"} 
                className="text-xs"
              >
                {sensorsWithCsv}/{sensors.length} CSV
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
        
        {sensors.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun capteur configuré</p>
              <p className="text-xs mt-1 opacity-75">Chargez un fichier JSON</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {mode === 'replay' && isExpanded && (
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border-blue-300 dark:border-blue-700"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv';
                    input.multiple = true;
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files && files.length > 0) handleBulkUpload(files);
                    };
                    input.click();
                  }}
                >
                  <FolderUp size={16} className="mr-2" />
                  Charger plusieurs CSV
                </Button>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Les fichiers seront associés automatiquement par nom
                </p>
              </div>
            )}

            {isExpanded && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sensors.map((sensor) => (
                  <div 
                    key={sensor.id} 
                    className="bg-white/10 dark:bg-black/10 backdrop-blur-xl backdrop-saturate-150 border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 rounded-2xl p-3 hover:shadow-md transition-all cursor-pointer hover:border-purple-300 dark:hover:border-purple-700"
                    onMouseEnter={() => handleSensorHover(sensor.id)}
                    onMouseLeave={handleSensorLeave}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-xs truncate">{sensor.name}</h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">ID: {sensor.id}</p>
                        </div>
                        <Badge 
                          variant={sensor.currentData ? "default" : "secondary"}
                          className="shrink-0 text-[10px] h-5 px-2"
                        >
                          {sensor.currentData ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                              Actif
                            </span>
                          ) : (
                            "Inactif"
                          )}
                        </Badge>
                      </div>

                      {sensor.currentData && (
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="flex items-center gap-1.5 p-1.5 bg-red-50 dark:bg-red-900/20 rounded">
                            <Thermometer size={12} className="text-red-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-xs">{sensor.currentData.temperature.toFixed(1)}°C</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <Droplets size={12} className="text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-xs">{sensor.currentData.humidity.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {mode === 'replay' && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          {!sensor.csvFile ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-[10px] bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.csv';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleFileUpload(sensor.id, file);
                                };
                                input.click();
                              }}
                            >
                              <Upload size={10} className="mr-1" />
                              CSV
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5 p-1.5 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                              <FileText size={12} className="text-green-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-medium text-green-700 dark:text-green-400 truncate">
                                  {sensor.csvFile.name}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                                onClick={() => clearCsv(sensor.id)}
                              >
                                <X size={10} className="text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dataReady && (
              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 space-y-3 overflow-y-auto max-h-[50vh]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid3x3 size={16} className="text-purple-600" />
                    <h3 className="font-medium text-sm">Interpolation</h3>
                  </div>
                  <TooltipPrimitive.Provider delayDuration={300}>
                    <TooltipPrimitive.Root>
                      <TooltipPrimitive.Trigger asChild>
                        <div>
                          <Switch
                            id="meshing-toggle"
                            checked={meshingEnabled}
                            onCheckedChange={setMeshingEnabled}
                            className="scale-75"
                          />
                        </div>
                      </TooltipPrimitive.Trigger>
                      <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content side="left" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                          <p className="font-medium mb-1">Interpolation spatiale 3D</p>
                          <p className="text-gray-300">Crée un champ continu entre les capteurs</p>
                        </TooltipPrimitive.Content>
                      </TooltipPrimitive.Portal>
                    </TooltipPrimitive.Root>
                  </TooltipPrimitive.Provider>
                </div>

                {meshingEnabled && (
                  <>
                    {/* Visualization Type */}
                    <div className="space-y-1">
                      <Label className="text-xs">Type de visualisation</Label>
                      <TooltipPrimitive.Provider delayDuration={300}>
                        <Tabs value={visualizationType} onValueChange={(v) => setVisualizationType(v as any)}>
                          <TabsList className="grid grid-cols-4 bg-white/30 dark:bg-black/30 backdrop-blur-sm h-8 p-1 gap-1">
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="points" className="h-6 px-1">
                                  <Circle size={12} />
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                                  Points colorés
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="vectors" className="h-6 px-1">
                                  <ArrowUpRight size={12} />
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                                  Champ vectoriel
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="isosurface" className="h-6 px-1">
                                  <Layers size={12} />
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                                  Isosurfaces
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="mesh" className="h-6 px-1">
                                  <Box size={12} />
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                                  Maillage volumique
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          </TabsList>
                        </Tabs>
                      </TooltipPrimitive.Provider>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Méthode d'interpolation</Label>
                      <TooltipPrimitive.Provider delayDuration={300}>
                        <Tabs value={interpolationMethod} onValueChange={(v) => setInterpolationMethod(v as any)}>
                          <TabsList className="grid grid-cols-2 bg-white/30 dark:bg-black/30 backdrop-blur-sm h-8 p-1 gap-1">
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="idw" className="relative flex items-center gap-1 text-xs h-6">
                                  {interpolationMethod === 'idw' && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-md"></div>
                                  )}
                                  <Zap size={12} className="relative z-10" />
                                  <span className="relative z-10">IDW</span>
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                                  <p className="font-medium mb-1">Inverse Distance Weighting</p>
                                  <p className="text-gray-300">Rapide et efficace</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <TabsTrigger value="rbf" className="relative flex items-center gap-1 text-xs h-6">
                                  {interpolationMethod === 'rbf' && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-md"></div>
                                  )}
                                  <Waves size={12} className="relative z-10" />
                                  <span className="relative z-10">RBF</span>
                                </TabsTrigger>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                                  <p className="font-medium mb-1">Radial Basis Functions</p>
                                  <p className="text-gray-300">Surfaces très lisses</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          </TabsList>
                        </Tabs>
                      </TooltipPrimitive.Provider>
                    </div>

                    {interpolationMethod === 'idw' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Exposant (p)</Label>
                          <span className="text-xs font-medium text-blue-600">{idwPower}</span>
                        </div>
                        <Slider
                          value={[idwPower]}
                          onValueChange={(v) => setIdwPower(v[0])}
                          min={1}
                          max={5}
                          step={0.5}
                          className="w-full"
                        />
                      </div>
                    )}

                    {interpolationMethod === 'rbf' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Kernel</Label>
                        <select
                          value={rbfKernel}
                          onChange={(e) => setRbfKernel(e.target.value as any)}
                          className="w-full text-xs bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="multiquadric">Multiquadric</option>
                          <option value="gaussian">Gaussienne</option>
                          <option value="inverse_multiquadric">Inverse Multiquadric</option>
                          <option value="thin_plate_spline">Thin Plate Spline</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Résolution</Label>
                        <span className="text-xs font-medium text-purple-600">{meshResolution}³</span>
                      </div>
                      <Slider
                        value={[meshResolution]}
                        onValueChange={(v) => setMeshResolution(v[0])}
                        min={10}
                        max={40}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};