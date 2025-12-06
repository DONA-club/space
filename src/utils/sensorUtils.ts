import { SensorDataPoint } from '@/types/sensor.types';

export const findClosestDataPoint = (
  data: SensorDataPoint[],
  targetTimestamp: number
): SensorDataPoint => {
  if (data.length === 0) {
    return {
      timestamp: targetTimestamp,
      temperature: 0,
      humidity: 0,
      absoluteHumidity: 0,
      dewPoint: 0,
      vpdKpa: 0
    };
  }

  if (data.length === 1) {
    return {
      ...data[0],
      vpdKpa: data[0].vpdKpa
    };
  }

  let left = 0;
  let right = data.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (data[mid].timestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  if (left === 0) {
    return {
      ...data[0],
      vpdKpa: data[0].vpdKpa
    };
  }

  if (left === data.length) {
    return {
      ...data[data.length - 1],
      vpdKpa: data[data.length - 1].vpdKpa
    };
  }

  const leftDiff = Math.abs(data[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(data[right].timestamp - targetTimestamp);

  const closest = leftDiff < rightDiff ? data[left] : data[right];
  return {
    ...closest,
    vpdKpa: closest.vpdKpa
  };
};

export const getAverageDataPointInWindow = (
  data: SensorDataPoint[],
  targetTimestamp: number,
  windowMs: number
): SensorDataPoint => {
  if (windowMs === 0 || data.length === 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const halfWindow = windowMs / 2;
  const startTime = targetTimestamp - halfWindow;
  const endTime = targetTimestamp + halfWindow;

  const inWindow = data.filter(
    (d) => d.timestamp >= startTime && d.timestamp <= endTime
  );

  if (inWindow.length === 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const sum = inWindow.reduce(
    (acc, d) => {
      acc.temperature += d.temperature;
      acc.humidity += d.humidity;
      acc.absoluteHumidity += d.absoluteHumidity;
      acc.dewPoint += d.dewPoint;
      acc.vpdKpa += (d.vpdKpa ?? 0);
      return acc;
    },
    { temperature: 0, humidity: 0, absoluteHumidity: 0, dewPoint: 0, vpdKpa: 0 }
  );

  const count = inWindow.length;

  return {
    timestamp: targetTimestamp,
    temperature: sum.temperature / count,
    humidity: sum.humidity / count,
    absoluteHumidity: sum.absoluteHumidity / count,
    dewPoint: sum.dewPoint / count,
    vpdKpa: sum.vpdKpa / count
  };
};

export const getDataRange = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number,
  metric: 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint' | 'vpdKpa',
  smoothingWindowMs: number = 0
): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;

  sensors.forEach((sensor) => {
    const data = sensorData.get(sensor.id);
    if (!data || data.length === 0) return;

    const averaged = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowMs);
    
    let value: number;
    switch (metric) {
      case 'temperature':
        value = averaged.temperature;
        break;
      case 'humidity':
        value = averaged.humidity;
        break;
      case 'absoluteHumidity':
        value = averaged.absoluteHumidity;
        break;
      case 'dewPoint':
        value = averaged.dewPoint;
        break;
      case 'vpdKpa':
        value = averaged.vpdKpa ?? 0;
        break;
    }
    
    if (value < min) min = value;
    if (value > max) max = value;
  });

  if (min === Infinity || max === -Infinity) {
    return { min: 0, max: 100 };
  }

  return { min, max };
};

export const calculateIndoorAverage = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number,
  windowMs: number = 0
): SensorDataPoint | null => {
  let tempSum = 0, humSum = 0, absHumSum = 0, dpSum = 0, vpdSum = 0, count = 0;

  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;

    const data = sensorData.get(sensor.id)!;
    const point = getAverageDataPointInWindow(data, currentTimestamp, windowMs);

    tempSum += point.temperature;
    humSum += point.humidity;
    absHumSum += point.absoluteHumidity;
    dpSum += point.dewPoint;
    vpdSum += (point.vpdKpa ?? 0);
    count++;
  });

  if (count === 0) return null;

  return {
    timestamp: currentTimestamp,
    temperature: tempSum / count,
    humidity: humSum / count,
    absoluteHumidity: absHumSum / count,
    dewPoint: dpSum / count,
    vpdKpa: vpdSum / count
  };
};