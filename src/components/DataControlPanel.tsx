"use client";

import { useEffect, useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export const DataControlPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const setTimeRange = useAppStore((state) => state.setTimeRange);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const dataReady = useAppStore((state) => state.dataReady);
  const setDataReady = useAppStore((state) => state.setDataReady);
  
  const [checking, setChecking] = useState(false);
  const [sensorDataCounts, setSensorDataCounts] = useState<Map<number, number>>(new Map());

  // Check if all sensors have data
  useEffect(() => {
    if (!currentSpace || mode !== 'replay') return;

    const checkSensorData = async () => {
      setChecking(true);
      try {
        const counts = new Map<number, number>();
        
        for (const sensor of sensors) {
          const { count, error } = await supabase
            .from('sensor_data')
            .select('*', { count: 'exact', head: true })
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id);

          if (error) throw error;
          counts.set(sensor.id, count || 0);
        }
        
        setSensorDataCounts(counts);
        
        // Check if all sensors have data
        const allHaveData = sensors.length > 0 && sensors.every(s => (counts.get(s.id) || 0) > 0);
        
        if (allHaveData && !dataReady) {
          await handleAnalyze();
        }
      } catch (error) {
        console.error('Error checking sensor data:', error);
      } finally {
        setChecking(false);
      }
    };

    checkSensorData();

    // Plus de polling inutile: on ne re-vérifie pas périodiquement
    return () => {};
  }, [currentSpace, mode, sensors, dataReady]);

  const handleAnalyze = async () => {
    if (!currentSpace) return;

    try {
      // Récupérer min/max en une seule requête agrégée (évite les 406)
      const { data: aggRows, error: aggError } = await supabase
        .from('sensor_data')
        .select('min:timestamp.min, max:timestamp.max')
        .eq('space_id', currentSpace.id)
        .limit(1);

      if (aggError) throw aggError;

      const agg = (aggRows && aggRows[0]) || null;
      if (!agg || !agg.min || !agg.max) {
        throw new Error('Aucune donnée trouvée');
      }

      const minTime = new Date(agg.min as string).getTime();
      const maxTime = new Date(agg.max as string).getTime();
      
      // Get total count across all sensors
      const { count, error: countError } = await supabase
        .from('sensor_data')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', currentSpace.id);

      if (countError) throw countError;
      
      setTimeRange([minTime, maxTime]);
      setCurrentTimestamp(minTime);
      setDataReady(true);
      
      const duration = (maxTime - minTime) / (1000 * 60 * 60);
      const days = Math.floor(duration / 24);
      const hours = Math.floor(duration % 24);
      
      showSuccess(`Analyse terminée ! ${sensors.length} capteurs, ${(count || 0).toLocaleString()} points sur ${days}j ${hours}h`);
    } catch (error) {
      console.error('Error analyzing data:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors de l\'analyse des données');
    }
  };

  if (mode !== 'replay') return null;

  const allSensorsHaveData = sensors.length > 0 && sensors.every(s => (sensorDataCounts.get(s.id) || 0) > 0);

  if (!allSensorsHaveData) {
    const sensorsWithData = sensors.filter(s => (sensorDataCounts.get(s.id) || 0) > 0).length;
    
    return (
      <LiquidGlassCard className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-2">
          {checking && <Loader2 className="animate-spin h-4 w-4" />}
          📊 Chargez les fichiers CSV pour tous les capteurs pour commencer l'analyse
          {sensorsWithData > 0 && (
            <span className="ml-2 text-xs">
              ({sensorsWithData}/{sensors.length} capteurs prêts)
            </span>
          )}
        </div>
      </LiquidGlassCard>
    );
  }

  if (!dataReady && checking) {
    return (
      <LiquidGlassCard className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center justify-center gap-2">
          <Loader2 className="animate-spin h-4 w-4" />
          Analyse en cours...
        </div>
      </LiquidGlassCard>
    );
  }

  return null;
};