import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sensor, SensorDataPoint } from '@/types/sensor.types';

interface UseSensorDataReturn {
  sensorData: Map<number, SensorDataPoint[]>;
  outdoorData: SensorDataPoint[];
  loading: boolean;
  error: string | null;
}

// Cache window: load ±12 hours around current timestamp
const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

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
        const windowStart = new Date(currentTimestamp - CACHE_WINDOW_MS).toISOString();
        const windowEnd = new Date(currentTimestamp + CACHE_WINDOW_MS).toISOString();

        console.log(`📊 Loading data window: ${new Date(windowStart).toLocaleString('fr-FR')} → ${new Date(windowEnd).toLocaleString('fr-FR')}`);

        const newData = new Map(sensorData);

        for (const sensor of sensors) {
          // Check if we already have this range loaded
          const ranges = loadedRanges.get(sensor.id) || [];
          const needsLoad = !ranges.some(r => 
            r.start <= currentTimestamp - CACHE_WINDOW_MS && 
            r.end >= currentTimestamp + CACHE_WINDOW_MS
          );

          if (!needsLoad) {
            console.log(`✓ Sensor ${sensor.name}: Using cached data`);
            continue;
          }

          const { data: windowData, error: fetchError } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .gte('timestamp', windowStart)
            .lte('timestamp', windowEnd)
            .order('timestamp', { ascending: true });

          if (fetchError) throw fetchError;

          if (windowData && windowData.length > 0) {
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

            // Update loaded ranges
            const newRanges = [...ranges, {
              start: currentTimestamp - CACHE_WINDOW_MS,
              end: currentTimestamp + CACHE_WINDOW_MS
            }];
            setLoadedRanges(prev => new Map(prev).set(sensor.id, newRanges));

            console.log(`✓ Sensor ${sensor.name}: Loaded ${windowData.length} points (total: ${mergedData.length})`);
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
        const windowStart = new Date(currentTimestamp - CACHE_WINDOW_MS).toISOString();
        const windowEnd = new Date(currentTimestamp + CACHE_WINDOW_MS).toISOString();

        const { data: windowData, error: fetchError } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .gte('timestamp', windowStart)
          .lte('timestamp', windowEnd)
          .order('timestamp', { ascending: true });

        if (fetchError) throw fetchError;

        if (windowData && windowData.length > 0) {
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
          console.log(`✓ Outdoor: Loaded ${windowData.length} points (total: ${mergedData.length})`);
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