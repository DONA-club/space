"use client";

import { useEffect } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { Play, Pause, SkipBack, SkipForward, Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { showSuccess, showError } from '@/utils/toast';

export const DataControlPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setTimeRange = useAppStore((state) => state.setTimeRange);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const setSelectedMetric = useAppStore((state) => state.setSelectedMetric);
  const dataReady = useAppStore((state) => state.dataReady);
  const setDataReady = useAppStore((state) => state.setDataReady);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const timeRange = useAppStore((state) => state.timeRange);

  const allSensorsHaveCSV = sensors.length > 0 && sensors.every(s => s.csvFile);

  // Auto-analyze when all CSVs are loaded
  useEffect(() => {
    if (allSensorsHaveCSV && !dataReady) {
      handleAnalyze();
    }
  }, [allSensorsHaveCSV, dataReady]);

  const handleAnalyze = async () => {
    try {
      const parsedData = await Promise.all(
        sensors.map(async (sensor) => {
          if (!sensor.csvFile) return null;
          
          const text = await sensor.csvFile.text();
          const lines = text.split('\n').filter(line => line.trim());
          const dataLines = lines.slice(1);
          
          const data = dataLines.map(line => {
            const values = line.replace(/"/g, '').split(',');
            if (values.length < 5) return null;
            
            const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
            const date = new Date(timestampStr.trim());
            
            if (isNaN(date.getTime())) return null;
            
            const temp = parseFloat(tempStr);
            const hum = parseFloat(humStr);
            const absHum = parseFloat(absHumStr);
            const dpt = parseFloat(dptStr);
            
            if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) return null;
            
            return {
              timestamp: date.getTime(),
              temperature: temp,
              humidity: hum,
              absoluteHumidity: absHum,
              dewPoint: dpt
            };
          }).filter(d => d !== null);
          
          return {
            sensorId: sensor.id,
            data
          };
        })
      );
      
      const validData = parsedData.filter(d => d !== null && d.data.length > 0);
      
      if (validData.length === 0) {
        throw new Error('Aucune donnée valide trouvée');
      }
      
      const allTimestamps = validData.flatMap(d => d!.data.map(point => point.timestamp));
      const minTime = Math.min(...allTimestamps);
      const maxTime = Math.max(...allTimestamps);
      
      setTimeRange([minTime, maxTime]);
      setCurrentTimestamp(minTime);
      setDataReady(true);
      
      const totalPoints = allTimestamps.length;
      const duration = (maxTime - minTime) / (1000 * 60 * 60);
      
      showSuccess(`Analyse terminée ! ${validData.length} capteurs, ${totalPoints} points sur ${duration.toFixed(1)}h`);
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de l\'analyse des données');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (mode !== 'replay') return null;

  if (!allSensorsHaveCSV) {
    return (
      <LiquidGlassCard className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-2">
          📊 Chargez les fichiers CSV pour tous les capteurs pour commencer l'analyse
        </div>
      </LiquidGlassCard>
    );
  }

  if (!dataReady) {
    return (
      <LiquidGlassCard className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          Analyse en cours...
        </div>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => timeRange && setCurrentTimestamp(timeRange[0])}
            className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-8 w-8 p-0"
          >
            <SkipBack size={14} />
          </Button>
          <Button
            size="sm"
            onClick={() => setPlaying(!isPlaying)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-8 w-8 p-0"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => timeRange && setCurrentTimestamp(timeRange[1])}
            className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-8 w-8 p-0"
          >
            <SkipForward size={14} />
          </Button>
          
          <div className="text-xs text-gray-600 dark:text-gray-300 font-medium ml-2">
            {formatTime(currentTimestamp)}
          </div>
        </div>

        {/* Metric selector */}
        <TooltipProvider>
          <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
            <TabsList className="bg-white/50 dark:bg-black/50 h-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="temperature" className="flex items-center gap-1 data-[state=active]:bg-red-100 dark:data-[state=active]:bg-red-900/30 h-7 px-2">
                    <Thermometer size={14} className="text-red-500" />
                    <span className="text-xs">T°</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Température (°C)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="humidity" className="flex items-center gap-1 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30 h-7 px-2">
                    <Droplets size={14} className="text-blue-500" />
                    <span className="text-xs">HR</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Humidité Relative (%)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="absoluteHumidity" className="flex items-center gap-1 data-[state=active]:bg-cyan-100 dark:data-[state=active]:bg-cyan-900/30 h-7 px-2">
                    <Wind size={14} className="text-cyan-500" />
                    <span className="text-xs">HA</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Humidité Absolue (g/m³)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="dewPoint" className="flex items-center gap-1 data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30 h-7 px-2">
                    <CloudRain size={14} className="text-purple-500" />
                    <span className="text-xs">PR</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Point de rosée (°C)</p>
                </TooltipContent>
              </Tooltip>
            </TabsList>
          </Tabs>
        </TooltipProvider>
      </div>
    </LiquidGlassCard>
  );
};