"use client";

import { useEffect, useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const DataControlPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const setTimeRange = useAppStore((state) => state.setTimeRange);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const dataReady = useAppStore((state) => state.dataReady);
  const timeRange = useAppStore((state) => state.timeRange);
  const setDataReady = useAppStore((state) => state.setDataReady);
  
  const [checking, setChecking] = useState(false);
  const [sensorDataCounts, setSensorDataCounts] = useState<Map<number, number>>(new Map());

  console.debug('[DataControlPanel] render', { mode, spaceId: currentSpace?.id, sensors: sensors.length, dataReady });

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

      type AggRow = { min: string | null; max: string | null };
      const agg = ((aggRows as unknown as AggRow[])?.[0]) ?? null;
      if (!agg || !agg.min || !agg.max) {
        throw new Error('Aucune donnée trouvée');
      }

      const { min, max } = agg as AggRow;
      const minTime = new Date(min as string).getTime();
      const maxTime = new Date(max as string).getTime();
      
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


  const allSensorsHaveData = sensors.length > 0 && sensors.every(s => (sensorDataCounts.get(s.id) || 0) > 0);
  const sensorsWithData = sensors.filter(s => (sensorDataCounts.get(s.id) || 0) > 0).length;
  const indoorSensors = sensors.filter(s => !s.isOutdoor).length;
  const outdoorSensors = sensors.filter(s => s.isOutdoor).length;

  // Afficher le panneau dès qu'il y a des capteurs mappés, même sans données
  if (sensors.length === 0) {
    console.debug('[DataControlPanel] No sensors mapped');
    return null;
  }

  if (!allSensorsHaveData) {
    console.debug('[DataControlPanel] Not all sensors have data', { sensorsWithData, total: sensors.length, checking });
    return (
      <LiquidGlassCard className="p-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            📊 Données des capteurs
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {indoorSensors} capteur{indoorSensors > 1 ? 's' : ''} intérieur{indoorSensors > 1 ? 's' : ''}
            {outdoorSensors > 0 && ` · ${outdoorSensors} capteur${outdoorSensors > 1 ? 's' : ''} extérieur${outdoorSensors > 1 ? 's' : ''}`}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-2">
            {checking && <Loader2 className="animate-spin h-4 w-4" />}
            Chargez les fichiers CSV pour tous les capteurs pour commencer l'analyse
            {sensorsWithData > 0 && (
              <span className="ml-2 text-xs font-medium">
                ({sensorsWithData}/{sensors.length} prêts)
              </span>
            )}
          </div>
        </div>
      </LiquidGlassCard>
    );
  }

  if (!dataReady && checking) {
    console.debug('[DataControlPanel] Checking in progress...');
    return (
      <LiquidGlassCard className="p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center justify-center gap-2">
          <Loader2 className="animate-spin h-4 w-4" />
          Analyse en cours...
        </div>
      </LiquidGlassCard>
    );
  }

  // Tous les capteurs ont des données mais l'analyse n'a pas encore été lancée
  if (!dataReady && allSensorsHaveData) {
    console.debug('[DataControlPanel] All sensors ready but analysis not started');
    return (
      <LiquidGlassCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            ✅ Tous les capteurs ont des données. Lancez l'analyse pour calculer la période et activer la timeline.
          </div>
          <Button size="sm" onClick={handleAnalyze} disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Analyse...
              </>
            ) : (
              'Analyser'
            )}
          </Button>
        </div>
      </LiquidGlassCard>
    );
  }

  // Analyse prête: garder un petit résumé visible
  if (dataReady) {
    const [minTime, maxTime] = timeRange || [null, null];
    const durationHours = minTime && maxTime ? Math.round((maxTime - minTime) / (1000 * 60 * 60)) : null;
    console.debug('[DataControlPanel] Data ready', { timeRange });
    return (
      <LiquidGlassCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <div className="text-gray-700 dark:text-gray-300">
            ✅ Données prêtes {durationHours != null ? `(≈ ${durationHours} h)` : ''}. Utilisez la timeline ci-dessous.
          </div>
          <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={checking}>
            Recalculer
          </Button>
        </div>
      </LiquidGlassCard>
    );
  }

  return null;
};