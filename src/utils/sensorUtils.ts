import { SensorDataPoint } from '@/types/sensor.types';

/**
 * Find the closest data point to a target timestamp using binary search
 * This is much faster than linear search for large datasets
 */
export const findClosestDataPoint = (
  data: SensorDataPoint[],
  targetTimestamp: number
): SensorDataPoint => {
  if (data.length === 0) {
    throw new Error('No data points available');
  }

  // Binary search for the closest timestamp
  let left = 0;
  let right = data.length - 1;
  
  // Handle edge cases
  if (targetTimestamp <= data[left].timestamp) return data[left];
  if (targetTimestamp >= data[right].timestamp) return data[right];
  
  // Binary search
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = data[mid].timestamp;
    
    if (midTimestamp === targetTimestamp) {
      return data[mid];
    }
    
    if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // At this point, right < left
  // data[right].timestamp < targetTimestamp < data[left].timestamp
  // Return the closest one
  if (left >= data.length) return data[right];
  if (right < 0) return data[left];
  
  const leftDiff = Math.abs(data[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(data[right].timestamp - targetTimestamp);
  
  return leftDiff < rightDiff ? data[left] : data[right];
};

export const calculateIndoorAverage = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number
): SensorDataPoint | null => {
  let tempSum = 0, humSum = 0, absHumSum = 0, dpSum = 0, count = 0;
  
  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;
    
    const data = sensorData.get(sensor.id)!;
    const closestData = findClosestDataPoint(data, currentTimestamp);
    
    tempSum += closestData.temperature;
    humSum += closestData.humidity;
    absHumSum += closestData.absoluteHumidity;
    dpSum += closestData.dewPoint;
    count++;
  });
  
  if (count === 0) return null;
  
  return {
    timestamp: currentTimestamp,
    temperature: tempSum / count,
    humidity: humSum / count,
    absoluteHumidity: absHumSum / count,
    dewPoint: dpSum / count
  };
};

export const getDataRange = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number,
  metricKey: keyof Omit<SensorDataPoint, 'timestamp'>
): { min: number; max: number } => {
  const values: number[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;
    
    const data = sensorData.get(sensor.id)!;
    const closestData = findClosestDataPoint(data, currentTimestamp);
    values.push(closestData[metricKey]);
  });
  
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
};