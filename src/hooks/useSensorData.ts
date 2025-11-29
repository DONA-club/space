import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sensor, SensorDataPoint } from '@/types/sensor.types';

interface UseSensorDataReturn {
  sensorData: Map<number, SensorDataPoint[]>;
  outdoorData: SensorDataPoint[];
  loading: boolean;
  error: string | null;
}

export const useSensorData = (
  currentSpace: any,
  sensors: Sensor[],
  hasOutdoorData: boolean
): UseSensorDataReturn => {
  const [sensorData, setSensorData] = useState<Map<number, SensorDataPoint[]>>(new Map());
  const [outdoorData, setOutdoorData] = useState<SensorDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSpace) return;

    const loadSensorData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = new Map<number, SensorDataPoint[]>();

        console.log('📊 Loading ALL sensor data (no limit)...');
        const loadStartTime = performance.now();

        for (const sensor of sensors) {
          // NO LIMIT - fetch ALL data points for each sensor
          const { data: rawData, error: fetchError, count } = await supabase
            .from('sensor_data')
            .select('*', { count: 'exact' })
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .order('timestamp', { ascending: true });

          if (fetchError) throw fetchError;

          if (rawData && rawData.length > 0) {
            const formattedData = rawData.map(d => ({
              timestamp: new Date(d.timestamp).getTime(),
              temperature: d.temperature,
              humidity: d.humidity,
              absoluteHumidity: d.absolute_humidity,
              dewPoint: d.dew_point
            }));

            data.set(sensor.id, formattedData);
            console.log(`   ✓ Sensor ${sensor.name}: ${formattedData.length.toLocaleString()} points loaded`);
          }
        }

        const loadEndTime = performance.now();
        const totalPoints = Array.from(data.values()).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`✅ All sensor data loaded in ${(loadEndTime - loadStartTime).toFixed(0)}ms`);
        console.log(`   Total: ${totalPoints.toLocaleString()} data points across ${sensors.length} sensors`);

        setSensorData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error loading sensor data';
        setError(errorMessage);
        console.error('❌ Error loading sensor data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSensorData();
  }, [currentSpace, sensors]);

  useEffect(() => {
    if (!currentSpace || !hasOutdoorData) return;

    const loadOutdoorData = async () => {
      try {
        console.log('🌤️ Loading ALL outdoor data (no limit)...');
        const loadStartTime = performance.now();

        // NO LIMIT - fetch ALL outdoor data points
        const { data: rawData, error: fetchError } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .order('timestamp', { ascending: true });

        if (fetchError) throw fetchError;

        if (rawData && rawData.length > 0) {
          const formattedData = rawData.map(d => ({
            timestamp: new Date(d.timestamp).getTime(),
            temperature: d.temperature,
            humidity: d.humidity,
            absoluteHumidity: d.absolute_humidity,
            dewPoint: d.dew_point
          }));

          const loadEndTime = performance.now();
          console.log(`✅ Outdoor data loaded in ${(loadEndTime - loadStartTime).toFixed(0)}ms`);
          console.log(`   Total: ${formattedData.length.toLocaleString()} outdoor data points`);

          setOutdoorData(formattedData);
        }
      } catch (err) {
        console.error('❌ Error loading outdoor data:', err);
      }
    };

    loadOutdoorData();
  }, [currentSpace, hasOutdoorData]);

  return { sensorData, outdoorData, loading, error };
};