interface SensorDataPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
  absoluteHumidity: number;
  dewPoint: number;
}

export const findClosestDataPoint = (
  data: SensorDataPoint[],
  targetTimestamp: number
): SensorDataPoint => {
  let closestData = data[0];
  let minDiff = Math.abs(data[0].timestamp - targetTimestamp);
  
  for (const point of data) {
    const diff = Math.abs(point.timestamp - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestData = point;
    }
  }
  
  return closestData;
};

export const getMetricValue = (
  data: SensorDataPoint,
  metric: string
): number => {
  switch (metric) {
    case 'temperature':
      return data.temperature;
    case 'humidity':
      return data.humidity;
    case 'absoluteHumidity':
      return data.absoluteHumidity;
    case 'dewPoint':
      return data.dewPoint;
    default:
      return 0;
  }
};

export const calculateIndoorAverage = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number
): {
  temperature: number;
  humidity: number;
  absoluteHumidity: number;
  dewPoint: number;
} | null => {
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
    temperature: tempSum / count,
    humidity: humSum / count,
    absoluteHumidity: absHumSum / count,
    dewPoint: dpSum / count
  };
};