"use client";

import { useState, useEffect } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, AlertCircle, ChevronDown, ChevronUp, Grid3x3, Upload, Download, Trash2, FolderUp, Loader2, Clock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Alert, AlertDescription } from './ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const currentSpace = useAppStore((state) => state.currentSpace);
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
  const [hoveredSensorId, setHoveredSensorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sensorDataCounts, setSensorDataCounts] = useState<Map<number, number>>(new Map());
  const [lastDataDates, setLastDataDates] = useState<Map<number, Date>>(new Map());

  useEffect(() => {
    if (currentSpace && mode === 'replay') {
      loadSensorDataInfo();
    }
  }, [currentSpace, mode]);

  const loadSensorDataInfo = async () => {
    if (!currentSpace) return;

    try {
      const counts = new Map<number, number>();
      const dates = new Map<number, Date>();
      
      for (const sensor of sensors) {
        const { count, error: countError } = await supabase
          .from('sensor_data')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', sensor.id);

        if (countError) throw countError;
        counts.set(sensor.id, count || 0);

        const { data: lastData, error: dateError } = await supabase
          .from('sensor_data')
          .select('timestamp')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', sensor.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (dateError && dateError.code !== 'PGRST116') throw dateError;
        
        if (lastData) {
          dates.set(sensor.id, new Date(lastData.timestamp));
        }
      }
      
      setSensorDataCounts(counts);
      setLastDataDates(dates);
    } catch (error) {
      console.error('Error loading sensor data info:', error);
    }
  };

  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[\s\-_]/g, '')
      .replace(/_(data|export|capteur|sensor)$/i, '')
      .replace(/\.csv$/i, '');
  };

  const getInitials = (name: string): string => {
    return name
      .split(/[\s\-_]/)
      .map(word => word[0])
      .join('')
      .toLowerCase();
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const norm1 = normalizeName(str1);
    const norm2 = normalizeName(str2);
    
    if (norm1 === norm2) return 1.0;
    
    const initials1 = getInitials(str1);
    const initials2 = getInitials(str2);
    if (initials1 === norm2 || initials2 === norm1) return 0.9;
    
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
    
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 0;
    
    let matches = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] === norm2[i]) matches++;
    }
    
    return matches / maxLen;
  };

  const handleBulkCSVUpload = async (files: FileList) => {
    if (!currentSpace) return;

    setLoading(true);

    try {
      const fileArray = Array.from(files);
      let matchedCount = 0;
      let unmatchedFiles: string[] = [];
      const matchDetails: Array<{ file: string; sensor: string; score: number }> = [];

      for (const file of fileArray) {
        if (!file.name.endsWith('.csv')) continue;

        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        
        let bestMatch: { sensor: typeof sensors[0]; score: number } | null = null;
        
        for (const sensor of sensors) {
          const score = calculateSimilarity(sensor.name, fileNameWithoutExt);
          
          if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { sensor, score };
          }
        }

        if (bestMatch) {
          await handleCSVUpload(bestMatch.sensor.id, file, false);
          matchedCount++;
          matchDetails.push({
            file: file.name,
            sensor: bestMatch.sensor.name,
            score: bestMatch.score,
          });
        } else {
          unmatchedFiles.push(file.name);
        }
      }

      if (matchDetails.length > 0) {
        console.log('📊 Fichiers CSV associés :');
        matchDetails.forEach(detail => {
          const confidence = detail.score === 1.0 ? 'exact' : 
                            detail.score >= 0.9 ? 'très bon' :
                            detail.score >= 0.8 ? 'bon' : 'acceptable';
          console.log(`   ✓ ${detail.file} → ${detail.sensor} (${confidence}, score: ${detail.score.toFixed(2)})`);
        });
      }

      if (matchedCount > 0) {
        showSuccess(`${matchedCount} fichier${matchedCount > 1 ? 's' : ''} CSV chargé${matchedCount > 1 ? 's' : ''} avec succès`);
        loadSensorDataInfo();
      }
      
      if (unmatchedFiles.length > 0) {
        console.warn('⚠️ Fichiers non associés :', unmatchedFiles);
        showError(`${unmatchedFiles.length} fichier${unmatchedFiles.length > 1 ? 's' : ''} non associé${unmatchedFiles.length > 1 ? 's' : ''}: ${unmatchedFiles.slice(0, 3).join(', ')}${unmatchedFiles.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Error in bulk upload:', error);
      showError('Erreur lors du chargement en masse');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (sensorId: number, file: File, showToast: boolean = true) => {
    if (!currentSpace) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(1);

      const sensor = sensors.find(s => s.id === sensorId);
      if (!sensor) throw new Error('Capteur non trouvé');

      const newData: any[] = [];

      for (const line of dataLines) {
        const values = line.replace(/"/g, '').split(',');
        if (values.length < 5) continue;

        const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
        const timestamp = new Date(timestampStr.trim());

        if (isNaN(timestamp.getTime())) continue;

        const temp = parseFloat(tempStr);
        const hum = parseFloat(humStr);
        const absHum = parseFloat(absHumStr);
        const dpt = parseFloat(dptStr);

        if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) continue;

        newData.push({
          space_id: currentSpace.id,
          sensor_id: sensorId,
          sensor_name: sensor.name,
          timestamp: timestamp.toISOString(),
          temperature: temp,
          humidity: hum,
          absolute_humidity: absHum,
          dew_point: dpt,
        });
      }

      if (newData.length === 0) {
        throw new Error('Aucune donnée valide trouvée');
      }

      const { error } = await supabase
        .from('sensor_data')
        .upsert(newData, { onConflict: 'space_id,sensor_id,timestamp' });

      if (error) throw error;

      const maxTimestamp = Math.max(...newData.map(d => new Date(d.timestamp).getTime()));
      await supabase
        .from('spaces')
        .update({ 
          last_csv_date: new Date(maxTimestamp).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSpace.id);

      if (showToast) {
        showSuccess(`${newData.length} points de données ajoutés pour ${sensor.name}`);
        loadSensorDataInfo();
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      if (showToast) {
        showError(error instanceof Error ? error.message : 'Erreur lors du chargement du CSV');
      }
      throw error;
    }
  };

  const downloadAllData = async (sensorId: number) => {
    if (!currentSpace) return;

    try {
      const sensor = sensors.find(s => s.id === sensorId);
      if (!sensor) return;

      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', sensorId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Aucune donnée disponible');
        return;
      }

      const headers = ['timestamp', 'temperature', 'humidity', 'absolute_humidity', 'dew_point'];
      const csvLines = [headers.join(',')];

      data.forEach(row => {
        csvLines.push([
          row.timestamp,
          row.temperature,
          row.humidity,
          row.absolute_humidity,
          row.dew_point
        ].join(','));
      });

      const csv = csvLines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sensor.name}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showSuccess('Données téléchargées');
    } catch (error) {
      console.error('Error downloading data:', error);
      showError('Erreur lors du téléchargement');
    }
  };

  const deleteAllData = async (sensorId: number) => {
    if (!currentSpace) return;

    const sensor = sensors.find(s => s.id === sensorId);
    if (!sensor) return;

    if (!confirm(`Supprimer toutes les données de ${sensor.name} ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sensor_data')
        .delete()
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', sensorId);

      if (error) throw error;

      showSuccess('Données supprimées');
      loadSensorDataInfo();
    } catch (error) {
      console.error('Error deleting data:', error);
      showError('Erreur lors de la suppression');
    }
  };

  const handleSensorHover = (sensorId: number) => {
    setHoveredSensorId(sensorId);
    window.dispatchEvent(new CustomEvent('sensorHover', { detail: { sensorId } }));
  };

  const handleSensorLeave = () => {
    setHoveredSensorId(null);
    window.dispatchEvent(new CustomEvent('sensorLeave'));
  };

  const isDataOld = (date: Date): boolean => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return date < oneHourAgo;
  };

  const formatRelativeTime = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `il y a ${days}j`;
    if (hours > 0) return `il y a ${hours}h`;
    return 'récent';
  };

  useEffect(() => {
    if (dataReady) {
      setIsExpanded(false);
    }
  }, [dataReady]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto pb-2">
      {/* Sensors List Card */}
      <LiquidGlassCard className="flex-shrink-0">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Capteurs</h2>
              <Badge variant="outline" className="text-xs h-5">
                {sensors.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {currentSpace && mode === 'replay' && (
                  <div className="mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border-blue-300 dark:border-blue-700 h-8"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files && files.length > 0) handleBulkCSVUpload(files);
                        };
                        input.click();
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={14} />
                          Chargement...
                        </>
                      ) : (
                        <>
                          <FolderUp size={14} className="mr-2" />
                          Charger plusieurs CSV
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-center">
                      Matching intelligent automatique
                    </p>
                  </div>
                )}

                {sensors.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Aucun capteur</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {sensors.map((sensor) => {
                      const dataCount = sensorDataCounts.get(sensor.id) || 0;
                      const hasData = dataCount > 0;
                      const lastDate = lastDataDates.get(sensor.id);
                      const isOld = lastDate && isDataOld(lastDate);

                      return (
                        <motion.div
                          key={sensor.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            hoveredSensorId === sensor.id 
                              ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20' 
                              : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/50'
                          }`}
                          onMouseEnter={() => handleSensorHover(sensor.id)}
                          onMouseLeave={handleSensorLeave}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium truncate">{sensor.name}</span>
                            <div className="flex items-center gap-1">
                              {hasData && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                  {dataCount.toLocaleString()}
                                </Badge>
                              )}
                              <Badge 
                                variant={sensor.currentData ? "default" : "secondary"}
                                className="text-[10px] h-4 px-1.5"
                              >
                                {sensor.currentData ? "●" : "○"}
                              </Badge>
                            </div>
                          </div>

                          {sensor.currentData && (
                            <div className="grid grid-cols-2 gap-1 mb-1">
                              <div className="flex items-center gap-1 text-[10px]">
                                <Thermometer size={10} className="text-red-500" />
                                <span>{sensor.currentData.temperature.toFixed(1)}°C</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <Droplets size={10} className="text-blue-500" />
                                <span>{sensor.currentData.humidity.toFixed(1)}%</span>
                              </div>
                            </div>
                          )}

                          {lastDate && (
                            <Alert className={`mb-1 py-1 ${isOld ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                              <Clock className={`h-3 w-3 ${isOld ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                              <AlertDescription className={`text-[10px] ${isOld ? 'text-orange-800 dark:text-orange-200' : 'text-green-800 dark:text-green-200'}`}>
                                Dernières données : {formatRelativeTime(lastDate)}
                              </AlertDescription>
                            </Alert>
                          )}

                          {currentSpace && mode === 'replay' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-6 text-[10px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = '.csv';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) handleCSVUpload(sensor.id, file);
                                  };
                                  input.click();
                                }}
                                disabled={loading}
                              >
                                <Upload size={10} className="mr-1" />
                                CSV
                              </Button>

                              {hasData && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadAllData(sensor.id);
                                    }}
                                  >
                                    <Download size={10} />
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAllData(sensor.id);
                                    }}
                                  >
                                    <Trash2 size={10} />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LiquidGlassCard>

      {/* Interpolation Card */}
      {dataReady && (
        <LiquidGlassCard className="flex-shrink-0">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid3x3 size={14} className="text-purple-600" />
                <h3 className="font-medium text-sm">Interpolation</h3>
              </div>
              <Switch
                checked={meshingEnabled}
                onCheckedChange={setMeshingEnabled}
                className="scale-75"
              />
            </div>

            <AnimatePresence>
              {meshingEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  {/* Visualization Type */}
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      Type de visualisation
                      <TooltipPrimitive.Provider delayDuration={300}>
                        <TooltipPrimitive.Root>
                          <TooltipPrimitive.Trigger asChild>
                            <Info size={12} className="text-gray-400 cursor-help" />
                          </TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                              <p className="font-medium mb-1">Types de visualisation :</p>
                              <ul className="space-y-1 text-gray-300">
                                <li>• <strong>Points :</strong> Nuage de points colorés (rapide)</li>
                                <li>• <strong>Vecteurs :</strong> Champ de gradients (direction)</li>
                                <li>• <strong>Isosurface :</strong> Niveaux de valeurs (contours)</li>
                                <li>• <strong>Mesh :</strong> Maillage volumique (dense)</li>
                              </ul>
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      </TooltipPrimitive.Provider>
                    </Label>
                    <Tabs value={visualizationType} onValueChange={(v) => setVisualizationType(v as any)}>
                      <TabsList className="grid grid-cols-4 w-full h-8">
                        <TabsTrigger value="points" className="text-[10px] px-1">Points</TabsTrigger>
                        <TabsTrigger value="vectors" className="text-[10px] px-1">Vecteurs</TabsTrigger>
                        <TabsTrigger value="isosurface" className="text-[10px] px-1">ISO</TabsTrigger>
                        <TabsTrigger value="mesh" className="text-[10px] px-1">Mesh</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Résolution</Label>
                      <span className="text-xs font-medium text-purple-600">{meshResolution}³</span>
                    </div>
                    <Slider
                      value={[meshResolution]}
                      onValueChange={(v) => setMeshResolution(v[0])}
                      min={10}
                      max={50}
                      step={5}
                      className="h-1"
                    />
                    <p className="text-[9px] text-gray-500 dark:text-gray-400">
                      {Math.pow(meshResolution, 3).toLocaleString()} points
                    </p>
                  </div>

                  {/* Interpolation Method */}
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      Méthode
                      <TooltipPrimitive.Provider delayDuration={300}>
                        <TooltipPrimitive.Root>
                          <TooltipPrimitive.Trigger asChild>
                            <Info size={12} className="text-gray-400 cursor-help" />
                          </TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                              <p className="font-medium mb-1">Méthodes d'interpolation :</p>
                              <ul className="space-y-1 text-gray-300">
                                <li>• <strong>IDW :</strong> Inverse Distance Weighting</li>
                                <li className="ml-3 text-[10px]">✓ Rapide et simple</li>
                                <li className="ml-3 text-[10px]">✓ Bon pour données uniformes</li>
                                <li>• <strong>RBF :</strong> Radial Basis Functions</li>
                                <li className="ml-3 text-[10px]">✓ Surfaces très lisses</li>
                                <li className="ml-3 text-[10px]">✗ Plus coûteux en calcul</li>
                              </ul>
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      </TooltipPrimitive.Provider>
                    </Label>
                    <Tabs value={interpolationMethod} onValueChange={(v) => setInterpolationMethod(v as any)}>
                      <TabsList className="grid grid-cols-2 w-full h-8">
                        <TabsTrigger value="idw" className="text-xs">IDW</TabsTrigger>
                        <TabsTrigger value="rbf" className="text-xs">RBF</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* IDW Power */}
                  {interpolationMethod === 'idw' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-xs flex items-center gap-1">
                          Exposant (p)
                          <TooltipPrimitive.Provider delayDuration={300}>
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <Info size={12} className="text-gray-400 cursor-help" />
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium mb-1">Exposant de pondération :</p>
                                  <ul className="space-y-1 text-gray-300">
                                    <li>• p=1 : Influence linéaire</li>
                                    <li>• p=2 : Standard (recommandé)</li>
                                    <li>• p&gt;2 : Influence locale forte</li>
                                  </ul>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          </TooltipPrimitive.Provider>
                        </Label>
                        <span className="text-xs font-medium text-blue-600">{idwPower}</span>
                      </div>
                      <Slider
                        value={[idwPower]}
                        onValueChange={(v) => setIdwPower(v[0])}
                        min={1}
                        max={5}
                        step={0.5}
                        className="h-1"
                      />
                    </motion.div>
                  )}

                  {/* RBF Kernel */}
                  {interpolationMethod === 'rbf' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1"
                    >
                      <Label className="text-xs flex items-center gap-1">
                        Fonction de base
                        <TooltipPrimitive.Provider delayDuration={300}>
                          <TooltipPrimitive.Root>
                            <TooltipPrimitive.Trigger asChild>
                              <Info size={12} className="text-gray-400 cursor-help" />
                            </TooltipPrimitive.Trigger>
                            <TooltipPrimitive.Portal>
                              <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                <p className="font-medium mb-1">Fonctions RBF :</p>
                                <ul className="space-y-1 text-gray-300">
                                  <li>• <strong>Multiquadric :</strong> Polyvalent (recommandé)</li>
                                  <li>• <strong>Gaussienne :</strong> Lisse et locale</li>
                                  <li>• <strong>Inverse MQ :</strong> Décroissance rapide</li>
                                  <li>• <strong>Thin Plate :</strong> Surfaces naturelles</li>
                                </ul>
                              </TooltipPrimitive.Content>
                            </TooltipPrimitive.Portal>
                          </TooltipPrimitive.Root>
                        </TooltipPrimitive.Provider>
                      </Label>
                      <select
                        value={rbfKernel}
                        onChange={(e) => setRbfKernel(e.target.value as any)}
                        className="w-full text-xs bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="multiquadric">Multiquadric</option>
                        <option value="gaussian">Gaussienne</option>
                        <option value="inverse_multiquadric">Inverse Multiquadric</option>
                        <option value="thin_plate_spline">Thin Plate Spline</option>
                      </select>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LiquidGlassCard>
      )}
    </div>
  );
};