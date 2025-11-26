"use client";

import { useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { Play, Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const allSensorsHaveCSV = sensors.length > 0 && sensors.every(s => s.csvFile);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    try {
      // Parse all CSV files
      const parsedData = await Promise.all(
        sensors.map(async (sensor) => {
          if (!sensor.csvFile) return null;
          
          const text = await sensor.csvFile.text();
          const lines = text.split('\n').filter(line => line.trim());
          
          // Skip header
          const dataLines = lines.slice(1);
          
          const data = dataLines.map(line => {
            // Remove quotes and split by comma
            const values = line.replace(/"/g, '').split(',');
            
            if (values.length < 5) return null;
            
            const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
            
            // Parse timestamp (format: YYYY-MM-DD HH:MM:SS)
            const date = new Date(timestampStr.trim());
            
            if (isNaN(date.getTime())) {
              console.warn('Invalid timestamp:', timestampStr);
              return null;
            }
            
            const temp = parseFloat(tempStr);
            const hum = parseFloat(humStr);
            const absHum = parseFloat(absHumStr);
            const dpt = parseFloat(dptStr);
            
            if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) {
              console.warn('Invalid values:', { temp, hum, absHum, dpt });
              return null;
            }
            
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
      
      // Filter out null values
      const validData = parsedData.filter(d => d !== null && d.data.length > 0);
      
      if (validData.length === 0) {
        throw new Error('Aucune donnée valide trouvée');
      }
      
      // Find time range across all sensors
      const allTimestamps = validData.flatMap(d => d!.data.map(point => point.timestamp));
      const minTime = Math.min(...allTimestamps);
      const maxTime = Math.max(...allTimestamps);
      
      setTimeRange([minTime, maxTime]);
      setCurrentTimestamp(minTime);
      setDataReady(true);
      
      const totalPoints = allTimestamps.length;
      const duration = (maxTime - minTime) / (1000 * 60 * 60); // hours
      
      showSuccess(`Analyse terminée ! ${validData.length} capteurs, ${totalPoints} points de données sur ${duration.toFixed(1)}h`);
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de l\'analyse des données');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (mode !== 'replay') return null;

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        {!allSensorsHaveCSV && (
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            📊 Chargez les fichiers CSV pour tous les capteurs pour commencer l'analyse
          </div>
        )}

        {allSensorsHaveCSV && !dataReady && (
          <div className="flex justify-center">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Play size={16} className="mr-2" />
              {isAnalyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
            </Button>
          </div>
        )}

        {dataReady && (
          <div>
            <label className="text-sm font-medium mb-2 block">Métrique à afficher</label>
            <TooltipProvider>
              <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
                <TabsList className="grid grid-cols-2 gap-2 bg-white/50 dark:bg-black/50 h-auto p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="temperature" className="flex items-center gap-2 data-[state=active]:bg-red-100 dark:data-[state=active]:bg-red-900/30">
                        <Thermometer size={16} className="text-red-500" />
                        <span className="text-xs">Température</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Température</p>
                      <p className="text-xs">Température ambiante (°C)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="humidity" className="flex items-center gap-2 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30">
                        <Droplets size={16} className="text-blue-500" />
                        <span className="text-xs">Humidité Relative</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Humidité Relative</p>
                      <p className="text-xs">Pourcentage d'humidité (%)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="absoluteHumidity" className="flex items-center gap-2 data-[state=active]:bg-cyan-100 dark:data-[state=active]:bg-cyan-900/30">
                        <Wind size={16} className="text-cyan-500" />
                        <span className="text-xs">Humidité Absolue</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Humidité Absolue</p>
                      <p className="text-xs">Quantité d'eau dans l'air (g/m³)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="dewPoint" className="flex items-center gap-2 data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30">
                        <CloudRain size={16} className="text-purple-500" />
                        <span className="text-xs">Point de rosée</span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Point de rosée</p>
                      <p className="text-xs">Température de condensation (°C)</p>
                    </TooltipContent>
                  </Tooltip>
                </TabsList>
              </Tabs>
            </TooltipProvider>
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};