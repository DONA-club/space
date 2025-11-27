"use client";

import { useEffect } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';

export const DataControlPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setTimeRange = useAppStore((state) => state.setTimeRange);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const dataReady = useAppStore((state) => state.dataReady);
  const setDataReady = useAppStore((state) => state.setDataReady);

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

  return null;
};