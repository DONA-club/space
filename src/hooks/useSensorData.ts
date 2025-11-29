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

        console.log('📊 Loading ALL sensor data...');
        const loadStartTime = performance.now();

        for (const sensor of sensors) {
          let allData: any[] = [];
          let from = 0;
          const batchSize = 10000;
          let hasMore = true;

          while (hasMore) {
            const { data: batchData, error: fetchError } = await supabase
              .from('sensor_data')
              .select('*')
              .eq('space_id', currentSpace.id)
              .eq('sensor_id', sensor.id)
              .order('timestamp', { ascending: true })
              .range(from, from + batchSize - 1);

            if (fetchError) throw fetchError;

            if (batchData && batchData.length > 0) {
              allData = allData.concat(batchData);
              
              if (batchData.length < batchSize) {
                hasMore = false;
              } else {
                from += batchSize;
              }
            } else {
              hasMore = false;
            }
          }

          if (allData.length > 0) {
            const formattedData = allData.map(d => ({
              timestamp: new Date(d.timestamp).getTime(),
              temperature: d.temperature,
              humidity: d.humidity,
              absoluteHumidity: d.absolute_humidity,
              dewPoint: d.dew_point
            }));

            data.set(sensor.id, formattedData);
            
            const firstTimestamp = new Date(formattedData[0].timestamp);
            const lastTimestamp = new Date(formattedData[formattedData.length - 1].timestamp);
            console.log(`   ✓ Sensor ${sensor.name}: ${formattedData.length.toLocaleString()} points`);
            console.log(`      Time range: ${firstTimestamp.toLocaleString('fr-FR')} → ${lastTimestamp.toLocaleString('fr-FR')}`);
            
            // DEBUG: Log some sample timestamps
            console.log(`      Sample timestamps (first 5):`);
            formattedData.slice(0, 5).forEach((d, idx) => {
              console.log(`         ${idx + 1}. ${new Date(d.timestamp).toLocaleString('fr-FR')} - Temp: ${d.temperature.toFixed(1)}°C`);
            });
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
        console.log('🌤️ Loading ALL outdoor data...');
        const loadStartTime = performance.now();

        let allData: any[] = [];
        let from = 0;
        const batchSize = 10000;
        let hasMore = true;

        while (hasMore) {
          const { data: batchData, error: fetchError } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', 0)
            .order('timestamp', { ascending: true })
            .range(from, from + batchSize - 1);

          if (fetchError) throw fetchError;

          if (batchData && batchData.length > 0) {
            allData = allData.concat(batchData);
            
            if (batchData.length < batchSize) {
              hasMore = false;
            } else {
              from += batchSize;
            }
          } else {
            hasMore = false;
          }
        }

        if (allData.length > 0) {
          const formattedData = allData.map(d => ({
            timestamp: new Date(d.timestamp).getTime(),
            temperature: d.temperature,
            humidity: d.humidity,
            absoluteHumidity: d.absolute_humidity,
            dewPoint: d.dew_point
          }));

          const loadEndTime = performance.now();
          const firstTimestamp = new Date(formattedData[0].timestamp);
          const lastTimestamp = new Date(formattedData[formattedData.length - 1].timestamp);
          
          console.log(`✅ Outdoor data loaded in ${(loadEndTime - loadStartTime).toFixed(0)}ms`);
          console.log(`   Total: ${formattedData.length.toLocaleString()} outdoor data points`);
          console.log(`   Time range: ${firstTimestamp.toLocaleString('fr-FR')} → ${lastTimestamp.toLocaleString('fr-FR')}`);

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