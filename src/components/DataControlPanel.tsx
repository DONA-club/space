"use client";

import { useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { Play, Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showSuccess, showError } from '@/utils/toast';

type MetricType = 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint';

export const DataControlPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setTimeRange = useAppStore((state) => state.setTimeRange);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('temperature');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataReady, setDataReady] = useState(false);

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
            const [timestamp, temperature, humidity] = line.split(',').map(v => v.trim());
            
            // Parse timestamp (format: DD/MM/YYYY HH:MM:SS)
            const [datePart, timePart] = timestamp.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hours, minutes, seconds] = timePart.split(':');
            const date = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hours),
              parseInt(minutes),
              parseInt(seconds)
            );
            
            const temp = parseFloat(temperature);
            const hum = parseFloat(humidity);
            
            // Calculate absolute humidity (g/m³)
            const absoluteHumidity = (6.112 * Math.exp((17.67 * temp) / (temp + 243.5)) * hum * 2.1674) / (273.15 + temp);
            
            // Calculate dew point (°C)
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * temp) / (b + temp)) + Math.log(hum / 100);
            const dewPoint = (b * alpha) / (a - alpha);
            
            return {
              timestamp: date.getTime(),
              temperature: temp,
              humidity: hum,
              absoluteHumidity,
              dewPoint
            };
          });
          
          return {
            sensorId: sensor.id,
            data
          };
        })
      );
      
      // Filter out null values
      const validData = parsedData.filter(d => d !== null);
      
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
      
      showSuccess(`Analyse terminée ! ${validData.length} capteurs, ${allTimestamps.length} points de données`);
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError('Erreur lors de l\'analyse des données');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (mode !== 'replay') return null;

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Analyse des données</h3>
          {allSensorsHaveCSV && !dataReady && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Play size={16} className="mr-2" />
              {isAnalyzing ? 'Analyse...' : 'Lancer l\'analyse'}
            </Button>
          )}
        </div>

        {!allSensorsHaveCSV && (
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            📊 Chargez les fichiers CSV pour tous les capteurs pour commencer l'analyse
          </div>
        )}

        {dataReady && (
          <div className="space-y-3">
            <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              ✓ Données prêtes ! Sélectionnez une métrique à visualiser
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Métrique à afficher</label>
              <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
                <TabsList className="grid grid-cols-2 gap-2 bg-white/50 dark:bg-black/50 h-auto p-1">
                  <TabsTrigger value="temperature" className="flex items-center gap-2 data-[state=active]:bg-red-100 dark:data-[state=active]:bg-red-900/30">
                    <Thermometer size={16} className="text-red-500" />
                    <span className="text-xs">Température</span>
                  </TabsTrigger>
                  <TabsTrigger value="humidity" className="flex items-center gap-2 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/30">
                    <Droplets size={16} className="text-blue-500" />
                    <span className="text-xs">Humidité Relative</span>
                  </TabsTrigger>
                  <TabsTrigger value="absoluteHumidity" className="flex items-center gap-2 data-[state=active]:bg-cyan-100 dark:data-[state=active]:bg-cyan-900/30">
                    <Wind size={16} className="text-cyan-500" />
                    <span className="text-xs">Humidité Absolue</span>
                  </TabsTrigger>
                  <TabsTrigger value="dewPoint" className="flex items-center gap-2 data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30">
                    <CloudRain size={16} className="text-purple-500" />
                    <span className="text-xs">Point de rosée</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>• <strong>Température</strong> : Température ambiante (°C)</p>
              <p>• <strong>Humidité Relative</strong> : Pourcentage d'humidité (%)</p>
              <p>• <strong>Humidité Absolue</strong> : Quantité d'eau dans l'air (g/m³)</p>
              <p>• <strong>Point de rosée</strong> : Température de condensation (°C)</p>
            </div>
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};