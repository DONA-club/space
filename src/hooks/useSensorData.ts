import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sensor, SensorDataPoint } from '@/types/sensor.types';

interface UseSensorDataReturn {
  sensorData: Map<number, SensorDataPoint[]>;
  outdoorData: SensorDataPoint[];
  loading: boolean;
  error: string | null;
}

// Load 500 points before and 500 points after current timestamp
const POINTS_BEFORE = 500;
const POINTS_AFTER = 500;

export const useSensorData = (
  currentSpace: any,
  sensors: Sensor[],
  hasOutdoorData: boolean,
  currentTimestamp?: number
): UseSensorDataReturn => {
  const [sensorData, setSensorData] = useState<Map<number, SensorDataPoint[]>>(new Map());
  const [outdoorData, setOutdoorData] = useState<SensorDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedRanges, setLoadedRanges] = useState<Map<number, Array<{start: number, end: number}>>>(new Map());

  // Load data window around current timestamp
  useEffect(() => {
    if (!currentSpace || !currentTimestamp) return;

    const loadDataWindow = async () => {
      try {
        const targetDate = new Date(currentTimestamp).toISOString();

        console.log(`📊 Loading 500 points before and 500 after: ${new Date(currentTimestamp).toLocaleString('fr-FR')}`);

        const newData = new Map(sensorData);

        for (const sensor of sensors) {
          // Check if we already have data around this timestamp
          const ranges = loadedRanges.get(sensor.id) || [];
          const needsLoad = !ranges.some(r => 
            r.start <= currentTimestamp && 
            r.end >= currentTimestamp
          );

          if (!needsLoad) {
            console.log(`✓ Sensor ${sensor.name}: Using cached data`);
            continue;
          }

          // Load 500 points before current timestamp
          const { data: beforeData, error: beforeError } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .lt('timestamp', targetDate)
            .order('timestamp', { ascending: false })
            .limit(POINTS_BEFORE);

          if (beforeError) throw beforeError;

          // Load 500 points after current timestamp (including current)
          const { data: afterData, error: afterError } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .gte('timestamp', targetDate)
            .order('timestamp', { ascending: true })
            .limit(POINTS_AFTER);

          if (afterError) throw afterError;

          const windowData = [...(beforeData || []).reverse(), ...(afterData || [])];

          if (windowData.length > 0) {
            const formattedData = windowData.map(d => ({
              timestamp: new Date(d.timestamp).getTime(),
              temperature: d.temperature,
              humidity: d.humidity,
              absoluteHumidity: d.absolute_humidity,
              dewPoint: d.dew_point
            }));

            // Merge with existing data
            const existingData = newData.get(sensor.id) || [];
            const mergedData = [...existingData, ...formattedData]
              .sort((a, b) => a.timestamp - b.timestamp)
              // Remove duplicates
              .filter((item, index, arr) => 
                index === 0 || item.timestamp !== arr[index - 1].timestamp
              );

            newData.set(sensor.id, mergedData);

            // Calculate actual time range loaded
            const minTimestamp = Math.min(...formattedData.map(d => d.timestamp));
            const maxTimestamp = Math.max(...formattedData.map(d => d.timestamp));

            // Update loaded ranges
            const newRanges = [...ranges, {
              start: minTimestamp,
              end: maxTimestamp
            }];
            setLoadedRanges(prev => new Map(prev).set(sensor.id, newRanges));

            console.log(`✓ Sensor ${sensor.name}: Loaded ${windowData.length} points (${beforeData?.length || 0} before, ${afterData?.length || 0} after) - Total cache: ${mergedData.length}`);
            console.log(`   Range: ${new Date(minTimestamp).toLocaleString('fr-FR')} → ${new Date(maxTimestamp).toLocaleString('fr-FR')}`);
          }
        }

        setSensorData(newData);
      } catch (err) {
        console.error('❌ Error loading data window:', err);
      }
    };

    loadDataWindow();
  }, [currentSpace, sensors, currentTimestamp]);

  // Load outdoor data window
  useEffect(() => {
    if (!currentSpace || !hasOutdoorData || !currentTimestamp) return;

    const loadOutdoorWindow = async () => {
      try {
        const targetDate = new Date(currentTimestamp).toISOString();

        // Load 500 points before current timestamp
        const { data: beforeData, error: beforeError } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .lt('timestamp', targetDate)
          .order('timestamp', { ascending: false })
          .limit(POINTS_BEFORE);

        if (beforeError) throw beforeError;

        // Load 500 points after current timestamp (including current)
        const { data: afterData, error: afterError } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .gte('timestamp', targetDate)
          .order('timestamp', { ascending: true })
          .limit(POINTS_AFTER);

        if (afterError) throw afterError;

        const windowData = [...(beforeData || []).reverse(), ...(afterData || [])];

        if (windowData.length > 0) {
          const formattedData = windowData.map(d => ({
            timestamp: new Date(d.timestamp).getTime(),
            temperature: d.temperature,
            humidity: d.humidity,
            absoluteHumidity: d.absolute_humidity,
            dewPoint: d.dew_point
          }));

          // Merge with existing data
          const mergedData = [...outdoorData, ...formattedData]
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((item, index, arr) => 
              index === 0 || item.timestamp !== arr[index - 1].timestamp
            );

          setOutdoorData(mergedData);
          console.log(`✓ Outdoor: Loaded ${windowData.length} points (${beforeData?.length || 0} before, ${afterData?.length || 0} after) - Total cache: ${mergedData.length}`);
        }
      } catch (err) {
        console.error('❌ Error loading outdoor data window:', err);
      }
    };

    loadOutdoorWindow();
  }, [currentSpace, hasOutdoorData, currentTimestamp]);

  // Initial load: get time range only
  useEffect(() => {
    if (!currentSpace) return;

    const loadTimeRange = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('📊 Loading time range...');

        // Get min/max timestamps to establish the full range
        const { data: minData, error: minError } = await supabase
          .from('sensor_data')
          .select('timestamp')
          .eq('space_id', currentSpace.id)
          .order('timestamp', { ascending: true })
          .limit(1)
          .single();

        if (minError) throw minError;

        const { data: maxData, error: maxError } = await supabase
          .from('sensor_data')
          .select('timestamp')
          .eq('space_id', currentSpace.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (maxError) throw maxError;

        if (minData && maxData) {
          const minTime = new Date(minData.timestamp);
          const maxTime = new Date(maxData.timestamp);
          
          console.log(`✅ Time range: ${minTime.toLocaleString('fr-FR')} → ${maxTime.toLocaleString('fr-FR')}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error loading time range';
        setError(errorMessage);
        console.error('❌ Error loading time range:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTimeRange();
  }, [currentSpace]);

  return { sensorData, outdoorData, loading, error };
};