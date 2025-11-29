import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sensor, SensorDataPoint } from '@/types/sensor.types';

interface UseSensorDataReturn {
  sensorData: Map<number, SensorDataPoint[]>;
  outdoorData: SensorDataPoint[];
  loading: boolean;
  error: string | null;
}

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

  useEffect(() => {
    if (!currentSpace || !currentTimestamp) return;

    const loadDataWindow = async () => {
      try {
        const targetDate = new Date(currentTimestamp).toISOString();

        const newData = new Map(sensorData);

        for (const sensor of sensors) {
          const ranges = loadedRanges.get(sensor.id) || [];
          const needsLoad = !ranges.some(r => 
            r.start <= currentTimestamp && 
            r.end >= currentTimestamp
          );

          if (!needsLoad) continue;

          const { data: beforeData, error: beforeError } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .lt('timestamp', targetDate)
            .order('timestamp', { ascending: false })
            .limit(POINTS_BEFORE);

          if (beforeError) throw beforeError;

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

            const existingData = newData.get(sensor.id) || [];
            const mergedData = [...existingData, ...formattedData]
              .sort((a, b) => a.timestamp - b.timestamp)
              .filter((item, index, arr) => 
                index === 0 || item.timestamp !== arr[index - 1].timestamp
              );

            newData.set(sensor.id, mergedData);

            const minTimestamp = Math.min(...formattedData.map(d => d.timestamp));
            const maxTimestamp = Math.max(...formattedData.map(d => d.timestamp));

            const newRanges = [...ranges, {
              start: minTimestamp,
              end: maxTimestamp
            }];
            setLoadedRanges(prev => new Map(prev).set(sensor.id, newRanges));
          }
        }

        setSensorData(newData);
      } catch (err) {
        console.error('Error loading data window:', err);
      }
    };

    loadDataWindow();
  }, [currentSpace, sensors, currentTimestamp]);

  useEffect(() => {
    if (!currentSpace || !hasOutdoorData || !currentTimestamp) return;

    const loadOutdoorWindow = async () => {
      try {
        const targetDate = new Date(currentTimestamp).toISOString();

        const { data: beforeData, error: beforeError } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .lt('timestamp', targetDate)
          .order('timestamp', { ascending: false })
          .limit(POINTS_BEFORE);

        if (beforeError) throw beforeError;

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

          const mergedData = [...outdoorData, ...formattedData]
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((item, index, arr) => 
              index === 0 || item.timestamp !== arr[index - 1].timestamp
            );

          setOutdoorData(mergedData);
        }
      } catch (err) {
        console.error('Error loading outdoor data window:', err);
      }
    };

    loadOutdoorWindow();
  }, [currentSpace, hasOutdoorData, currentTimestamp]);

  useEffect(() => {
    if (!currentSpace) return;

    const loadTimeRange = async () => {
      setLoading(true);
      setError(null);
      
      try {
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
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error loading time range';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTimeRange();
  }, [currentSpace]);

  return { sensorData, outdoorData, loading, error };
};