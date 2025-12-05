import { SensorDataPoint } from '@/types/sensor.types';

const computeVpdKpa = (temperatureC: number, rhPercent: number): number => {
  // Tetens formula for saturation vapor pressure (kPa), VPD = es * (1 - RH/100)
  const es = 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  return es * (1 - rhPercent / 100);
};

export const findClosestDataPoint = (
  data: SensorDataPoint[],
  targetTimestamp: number
): SensorDataPoint => {
  if (data.length === 0) {
    throw new Error('No data points available');
  }

  let left = 0;
  let right = data.length - 1;

  if (targetTimestamp <= data[left].timestamp) {
    return data[left];
  }
  if (targetTimestamp >= data[right].timestamp) {
    return data[right];
  }

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

  if (left >= data.length) return data[right];
  if (right < 0) return data[left];

  const leftDiff = Math.abs(data[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(data[right].timestamp - targetTimestamp);

  return leftDiff < rightDiff ? data[left] : data[right];
};

/**
 * Calcule la moyenne de toutes les mesures dans une fenêtre temporelle centrée
 * autour de targetTimestamp. Si aucune mesure dans la fenêtre, retombe sur le point le plus proche.
 */
export const getAverageDataPointInWindow = (
  data: SensorDataPoint[],
  targetTimestamp: number,
  windowMs: number
): SensorDataPoint => {
  if (data.length === 0) {
    throw new Error('No data points available');
  }
  if (!windowMs || windowMs <= 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const half = windowMs / 2;
  const start = targetTimestamp - half;
  const end = targetTimestamp + half;

  // On suppose data trié par timestamp
  const inWindow = data.filter(d => d.timestamp >= start && d.timestamp <= end);

  if (inWindow.length === 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const sum = inWindow.reduce(
    (acc, d) => {
      acc.temperature += d.temperature;
      acc.humidity += d.humidity;
      acc.absoluteHumidity += d.absoluteHumidity;
      acc.dewPoint += d.dewPoint;
      acc.vpdKpa += (d.vpdKpa ?? computeVpdKpa(d.temperature, d.humidity));
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
    vpdSum += (point.vpdKpa ?? computeVpdKpa(point.temperature, point.humidity));
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

export const getDataRange = (
  sensorData: Map<number, SensorDataPoint[]>,
  sensors: Array<{ id: number }>,
  currentTimestamp: number,
  metricKey: keyof Omit<SensorDataPoint, 'timestamp'>,
  windowMs: number = 0
): { min: number; max: number } => {
  const values: number[] = [];

  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;

    const data = sensorData.get(sensor.id)!;
    const point = getAverageDataPointInWindow(data, currentTimestamp, windowMs);
    const val = metricKey === 'vpdKpa' ? (point.vpdKpa ?? computeVpdKpa(point.temperature, point.humidity)) : (point as any)[metricKey];
    values.push(val);
  });

  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
};