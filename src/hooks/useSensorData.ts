import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SensorDataPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
  absoluteHumidity: number;
  dewPoint: number;
}

interface Sensor {
  id: number;
  position: [number, number, number];
  name: string;
}

export const useSensorData = (
  currentSpace: any,
  sensors: Sensor[],
  hasOutdoorData: boolean
) => {
  const [sensorData, setSensorData] = useState<Map<number, SensorDataPoint[]>>(new Map());
  const [outdoorData, setOutdoorData] = useState<SensorDataPoint[]>([]);

  useEffect(() => {
    if (!currentSpace) return;

    const loadSensorData = async () => {
      const data = new Map<number, SensorDataPoint[]>();

      for (const sensor of sensors) {
        try {
          const { data: rawData, error } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .order('timestamp', { ascending: true });

          if (error) throw error;

          if (rawData && rawData.length > 0) {
            const formattedData = rawData.map(d => ({
              timestamp: new Date(d.timestamp).getTime(),
              temperature: d.temperature,
              humidity: d.humidity,
              absoluteHumidity: d.absolute_humidity,
              dewPoint: d.dew_point
            }));

            data.set(sensor.id, formattedData);
            console.log(`✅ Loaded ${formattedData.length} data points for sensor ${sensor.name}`);
          }
        } catch (error) {
          console.error(`Error loading data for sensor ${sensor.id}:`, error);
        }
      }

      setSensorData(data);
    };

    loadSensorData();
  }, [currentSpace, sensors]);

  useEffect(() => {
    if (!currentSpace || !hasOutdoorData) return;

    const loadOutdoorData = async () => {
      try {
        const { data: rawData, error } = await supabase
          .from('sensor_data')
          .select('*')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .order('timestamp', { ascending: true });

        if (error) throw error;

        if (rawData && rawData.length > 0) {
          const formattedData = rawData.map(d => ({
            timestamp: new Date(d.timestamp).getTime(),
            temperature: d.temperature,
            humidity: d.humidity,
            absoluteHumidity: d.absolute_humidity,
            dewPoint: d.dew_point
          }));

          setOutdoorData(formattedData);
          console.log(`✅ Loaded ${formattedData.length} outdoor data points`);
        }
      } catch (error) {
        console.error('Error loading outdoor data:', error);
      }
    };

    loadOutdoorData();
  }, [currentSpace, hasOutdoorData]);

  return { sensorData, outdoorData };
};