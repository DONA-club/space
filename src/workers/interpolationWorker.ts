import { interpolateIDW, RBFInterpolator, type Point3D } from '@/utils/interpolation';
import { calculateAirDensity, calculateWaterMass } from '@/utils/airCalculations';

interface WorkerMessage {
  sensors: any[];
  sensorData: Record<number, any[]>;
  currentTimestamp: number;
  selectedMetric: string;
  modelScale: number;
  originalCenter: { x: number; y: number; z: number } | null;
  modelPosition: { x: number; y: number; z: number };
  sensorOffset: { x: number; y: number; z: number };
  smoothingWindowMs: number;
  bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  meshResolution: number;
  interpolationMethod: string;
  rbfKernel: string;
  idwPower: number;
  exactVolume: number;
  jobTs: number;
}

const getAverageDataPointInWindow = (
  data: any[],
  targetTimestamp: number,
  windowMs: number
): any => {
  if (windowMs === 0 || data.length === 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const halfWindow = windowMs / 2;
  const startTime = targetTimestamp - halfWindow;
  const endTime = targetTimestamp + halfWindow;

  const inWindow = data.filter(
    (d: any) => d.timestamp >= startTime && d.timestamp <= endTime
  );

  if (inWindow.length === 0) {
    return findClosestDataPoint(data, targetTimestamp);
  }

  const sum = inWindow.reduce(
    (acc: any, d: any) => {
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

const findClosestDataPoint = (data: any[], targetTimestamp: number): any => {
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
      vpdKpa: data[0].vpdKpa ?? 0
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
      vpdKpa: data[0].vpdKpa ?? 0
    };
  }

  if (left === data.length) {
    return {
      ...data[data.length - 1],
      vpdKpa: data[data.length - 1].vpdKpa ?? 0
    };
  }

  const leftDiff = Math.abs(data[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(data[right].timestamp - targetTimestamp);

  const closest = leftDiff < rightDiff ? data[left] : data[right];
  return {
    ...closest,
    vpdKpa: closest.vpdKpa ?? 0
  };
};

self.onmessage = (evt: MessageEvent<WorkerMessage>) => {
  const {
    sensors,
    sensorData,
    currentTimestamp,
    selectedMetric,
    modelScale,
    originalCenter,
    modelPosition,
    sensorOffset,
    smoothingWindowMs,
    bounds,
    meshResolution,
    interpolationMethod,
    rbfKernel,
    idwPower,
    exactVolume,
    jobTs
  } = evt.data;

  const metricKey = selectedMetric === 'temperature' ? 'temperature' :
                    selectedMetric === 'humidity' ? 'humidity' :
                    selectedMetric === 'absoluteHumidity' ? 'absoluteHumidity' :
                    selectedMetric === 'vpdKpa' ? 'vpdKpa' : 'dewPoint';

  const points: Point3D[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData[sensor.id]) return;
    
    const data = sensorData[sensor.id];
    const averaged = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowMs);
    
    let value: number;
    switch (metricKey) {
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
      default:
        value = 0;
    }
    
    const xCentered = sensor.position[0] - (originalCenter?.x || 0);
    const yCentered = sensor.position[1] - (originalCenter?.y || 0);
    const zCentered = sensor.position[2] - (originalCenter?.z || 0);
    
    const xScaled = xCentered * modelScale;
    const yScaled = yCentered * modelScale;
    const zScaled = zCentered * modelScale;
    
    const xWithModel = xScaled + modelPosition.x;
    const yWithModel = yScaled + modelPosition.y;
    const zWithModel = zScaled + modelPosition.z;
    
    const xFinal = xWithModel + sensorOffset.x;
    const yFinal = yWithModel + sensorOffset.y;
    const zFinal = zWithModel + sensorOffset.z;
    
    points.push({ x: xFinal, y: yFinal, z: zFinal, value });
  });

  if (points.length === 0) {
    self.postMessage({
      positions: [],
      values: [],
      minValue: 0,
      maxValue: 0,
      volumetricAverage: null,
      interpolationPointCount: 0,
      airMass: null,
      waterMass: null,
      avgTemp: null,
      avgHumidity: null,
      avgAbsHumidity: null,
      jobTs
    });
    return;
  }

  const minValue = Math.min(...points.map(p => p.value));
  const maxValue = Math.max(...points.map(p => p.value));

  const validGridPoints: { x: number; y: number; z: number }[] = [];
  
  const stepX = (bounds.max.x - bounds.min.x) / (meshResolution - 1);
  const stepY = (bounds.max.y - bounds.min.y) / (meshResolution - 1);
  const stepZ = (bounds.max.z - bounds.min.z) / (meshResolution - 1);

  for (let i = 0; i < meshResolution; i++) {
    for (let j = 0; j < meshResolution; j++) {
      for (let k = 0; k < meshResolution; k++) {
        const x = bounds.min.x + i * stepX;
        const y = bounds.min.y + j * stepY;
        const z = bounds.min.z + k * stepZ;
        validGridPoints.push({ x, y, z });
      }
    }
  }

  let rbfInterpolator: RBFInterpolator | null = null;
  if (interpolationMethod === 'rbf') {
    rbfInterpolator = new RBFInterpolator(points, rbfKernel as any, 1.0);
  }
  
  const gridValues = validGridPoints.map(({ x, y, z }) => {
    let value: number;
    if (interpolationMethod === 'idw') {
      value = interpolateIDW(points, { x, y, z }, idwPower);
    } else {
      value = rbfInterpolator!.interpolate({ x, y, z });
    }
    value = Math.max(minValue, Math.min(maxValue, value));
    return { x, y, z, value };
  });

  const volumetricAverage = gridValues.reduce((acc, point) => acc + point.value, 0) / gridValues.length;

  const tempPoints: Point3D[] = [];
  const humidityPoints: Point3D[] = [];
  const absHumidityPoints: Point3D[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData[sensor.id]) return;
    
    const data = sensorData[sensor.id];
    const closestData = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowMs);
    
    const xCentered = sensor.position[0] - (originalCenter?.x || 0);
    const yCentered = sensor.position[1] - (originalCenter?.y || 0);
    const zCentered = sensor.position[2] - (originalCenter?.z || 0);
    
    const xScaled = xCentered * modelScale;
    const yScaled = yCentered * modelScale;
    const zScaled = zCentered * modelScale;
    
    const xWithModel = xScaled + modelPosition.x;
    const yWithModel = yScaled + modelPosition.y;
    const zWithModel = zScaled + modelPosition.z;
    
    const xFinal = xWithModel + sensorOffset.x;
    const yFinal = yWithModel + sensorOffset.y;
    const zFinal = zWithModel + sensorOffset.z;
    
    tempPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: closestData.temperature });
    humidityPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: closestData.humidity });
    absHumidityPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: closestData.absoluteHumidity });
  });

  let rbfTempInterpolator: RBFInterpolator | null = null;
  let rbfHumidityInterpolator: RBFInterpolator | null = null;
  let rbfAbsHumidityInterpolator: RBFInterpolator | null = null;
  
  if (interpolationMethod === 'rbf') {
    rbfTempInterpolator = new RBFInterpolator(tempPoints, rbfKernel as any, 1.0);
    rbfHumidityInterpolator = new RBFInterpolator(humidityPoints, rbfKernel as any, 1.0);
    rbfAbsHumidityInterpolator = new RBFInterpolator(absHumidityPoints, rbfKernel as any, 1.0);
  }

  let totalTemp = 0;
  let totalHumidity = 0;
  let totalAbsHumidity = 0;

  validGridPoints.forEach(({ x, y, z }) => {
    let temperature: number;
    let humidity: number;
    let absHumidity: number;

    if (interpolationMethod === 'idw') {
      temperature = interpolateIDW(tempPoints, { x, y, z }, idwPower);
      humidity = interpolateIDW(humidityPoints, { x, y, z }, idwPower);
      absHumidity = interpolateIDW(absHumidityPoints, { x, y, z }, idwPower);
    } else {
      temperature = rbfTempInterpolator!.interpolate({ x, y, z });
      humidity = rbfHumidityInterpolator!.interpolate({ x, y, z });
      absHumidity = rbfAbsHumidityInterpolator!.interpolate({ x, y, z });
    }

    totalTemp += temperature;
    totalHumidity += humidity;
    totalAbsHumidity += absHumidity;
  });

  const avgTemp = totalTemp / validGridPoints.length;
  const avgHumidity = totalHumidity / validGridPoints.length;
  const avgAbsHumidity = totalAbsHumidity / validGridPoints.length;

  const density = calculateAirDensity(avgTemp, avgHumidity);
  const totalMass = density * exactVolume;
  
  const totalWaterMass = calculateWaterMass(exactVolume, avgTemp, avgHumidity);

  const positions = new Float32Array(gridValues.length * 3);
  const values = new Float32Array(gridValues.length);

  gridValues.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    values[i] = point.value;
  });

  self.postMessage({
    positions,
    values,
    minValue,
    maxValue,
    volumetricAverage,
    interpolationPointCount: gridValues.length,
    airMass: totalMass,
    waterMass: totalWaterMass,
    avgTemp,
    avgHumidity,
    avgAbsHumidity,
    jobTs
  });
};