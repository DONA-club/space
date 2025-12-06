/* eslint-disable no-restricted-globals */
import { interpolateIDW, RBFInterpolator, type Point3D } from '@/utils/interpolation';
import { getAverageDataPointInWindow } from '@/utils/sensorUtils';
import { calculateAirDensity, calculateWaterMass } from '@/utils/airCalculations';

type Vec3 = { x: number; y: number; z: number };

type ComputePayload = {
  sensors: Array<{ id: number; position: [number, number, number]; name: string }>;
  sensorData: Record<number, Array<{
    timestamp: number;
    temperature: number;
    humidity: number;
    absoluteHumidity: number;
    dewPoint: number;
  }>>;
  currentTimestamp: number;
  selectedMetric: 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint';
  modelScale: number;
  originalCenter: Vec3 | null;
  modelPosition: Vec3;
  sensorOffset: Vec3;
  smoothingWindowMs: number;
  bounds: { min: Vec3; max: Vec3 };
  meshResolution: number;
  interpolationMethod: 'idw' | 'rbf';
  rbfKernel: 'gaussian' | 'multiquadric' | 'inverse_multiquadric' | 'thin_plate_spline';
  idwPower: number;
  exactVolume: number;
  jobTs: number;
};

type ComputeResult = {
  positions: Float32Array;
  values: Float32Array;
  minValue: number;
  maxValue: number;
  volumetricAverage: number;
  interpolationPointCount: number;
  airMass: number;
  waterMass: number;
  avgTemp: number;
  avgHumidity: number;
  avgAbsHumidity: number;
  jobTs: number;
};

function getMetricValue(
  point: { temperature: number; humidity: number; absoluteHumidity: number; dewPoint: number },
  metric: 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint'
): number {
  if (metric === 'temperature') return point.temperature;
  if (metric === 'humidity') return point.humidity;
  if (metric === 'absoluteHumidity') return point.absoluteHumidity;
  return point.dewPoint;
}

function buildInterpolationPoints(
  sensors: ComputePayload['sensors'],
  sensorData: ComputePayload['sensorData'],
  currentTimestamp: number,
  selectedMetric: ComputePayload['selectedMetric'],
  modelScale: number,
  originalCenter: Vec3 | null,
  modelPosition: Vec3,
  manualOffset: Vec3,
  smoothingWindowMs: number
): Point3D[] {
  const points: Point3D[] = [];
  for (const sensor of sensors) {
    const series = sensorData[sensor.id];
    if (!series || series.length === 0) continue;
    const averaged = getAverageDataPointInWindow(series, currentTimestamp, smoothingWindowMs);
    const value = getMetricValue(averaged, selectedMetric);

    const xCentered = sensor.position[0] - (originalCenter?.x || 0);
    const yCentered = sensor.position[1] - (originalCenter?.y || 0);
    const zCentered = sensor.position[2] - (originalCenter?.z || 0);

    const xScaled = xCentered * modelScale;
    const yScaled = yCentered * modelScale;
    const zScaled = zCentered * modelScale;

    const xWithModel = xScaled + modelPosition.x;
    const yWithModel = yScaled + modelPosition.y;
    const zWithModel = zScaled + modelPosition.z;

    const xFinal = xWithModel + manualOffset.x;
    const yFinal = yWithModel + manualOffset.y;
    const zFinal = zWithModel + manualOffset.z;

    points.push({ x: xFinal, y: yFinal, z: zFinal, value });
  }
  return points;
}

function getValidGridPoints(bounds: { min: Vec3; max: Vec3 }, meshResolution: number): Float32Array {
  const count = meshResolution * meshResolution * meshResolution;
  const positions = new Float32Array(count * 3);

  const stepX = (bounds.max.x - bounds.min.x) / (meshResolution - 1);
  const stepY = (bounds.max.y - bounds.min.y) / (meshResolution - 1);
  const stepZ = (bounds.max.z - bounds.min.z) / (meshResolution - 1);

  let idx = 0;
  for (let i = 0; i < meshResolution; i++) {
    for (let j = 0; j < meshResolution; j++) {
      for (let k = 0; k < meshResolution; k++) {
        const x = bounds.min.x + i * stepX;
        const y = bounds.min.y + j * stepY;
        const z = bounds.min.z + k * stepZ;
        positions[idx++] = x;
        positions[idx++] = y;
        positions[idx++] = z;
      }
    }
  }
  return positions;
}

function interpolateGridValues(
  points: Point3D[],
  positions: Float32Array,
  method: 'idw' | 'rbf',
  rbfKernel: ComputePayload['rbfKernel'],
  idwPower: number
): Float32Array {
  const values = new Float32Array(positions.length / 3);
  let rbfInterpolator: RBFInterpolator | null = null;
  if (method === 'rbf') {
    rbfInterpolator = new RBFInterpolator(points, rbfKernel, 1.0);
  }

  for (let n = 0, vi = 0; n < positions.length; n += 3, vi++) {
    const x = positions[n], y = positions[n + 1], z = positions[n + 2];
    let v: number;
    if (method === 'idw') {
      v = interpolateIDW(points, { x, y, z }, idwPower);
    } else {
      v = rbfInterpolator!.interpolate({ x, y, z });
    }
    values[vi] = v;
  }
  return values;
}

function clampValues(values: Float32Array, minValue: number, maxValue: number) {
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    values[i] = Math.max(minValue, Math.min(maxValue, v));
  }
}

function calculateAirProps(
  sensors: ComputePayload['sensors'],
  sensorData: ComputePayload['sensorData'],
  currentTimestamp: number,
  modelScale: number,
  originalCenter: Vec3 | null,
  modelPosition: Vec3,
  sensorOffset: Vec3,
  smoothingWindowMs: number,
  exactVolume: number,
  method: 'idw' | 'rbf',
  rbfKernel: ComputePayload['rbfKernel'],
  idwPower: number,
  positions: Float32Array
) {
  const tempPoints: Point3D[] = [];
  const humidityPoints: Point3D[] = [];
  const absHumidityPoints: Point3D[] = [];

  for (const sensor of sensors) {
    const series = sensorData[sensor.id];
    if (!series || series.length === 0) continue;
    const d = getAverageDataPointInWindow(series, currentTimestamp, smoothingWindowMs);

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

    tempPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: d.temperature });
    humidityPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: d.humidity });
    absHumidityPoints.push({ x: xFinal, y: yFinal, z: zFinal, value: d.absoluteHumidity });
  }

  let tempInterpolator: RBFInterpolator | null = null;
  let humInterpolator: RBFInterpolator | null = null;
  let absInterpolator: RBFInterpolator | null = null;
  if (method === 'rbf') {
    tempInterpolator = new RBFInterpolator(tempPoints, rbfKernel, 1.0);
    humInterpolator = new RBFInterpolator(humidityPoints, rbfKernel, 1.0);
    absInterpolator = new RBFInterpolator(absHumidityPoints, rbfKernel, 1.0);
  }

  let totalT = 0, totalRH = 0, totalAH = 0;
  for (let n = 0; n < positions.length; n += 3) {
    const x = positions[n], y = positions[n + 1], z = positions[n + 2];

    const t = method === 'idw'
      ? interpolateIDW(tempPoints, { x, y, z }, idwPower)
      : tempInterpolator!.interpolate({ x, y, z });

    const rh = method === 'idw'
      ? interpolateIDW(humidityPoints, { x, y, z }, idwPower)
      : humInterpolator!.interpolate({ x, y, z });

    const ah = method === 'idw'
      ? interpolateIDW(absHumidityPoints, { x, y, z }, idwPower)
      : absInterpolator!.interpolate({ x, y, z });

    totalT += t;
    totalRH += rh;
    totalAH += ah;
  }

  const sampleCount = positions.length / 3;
  const avgTemp = totalT / sampleCount;
  const avgHumidity = totalRH / sampleCount;
  const avgAbsHumidity = totalAH / sampleCount;

  const density = calculateAirDensity(avgTemp, avgHumidity);
  const airMass = density * exactVolume;
  const waterMass = calculateWaterMass(exactVolume, avgTemp, avgHumidity);

  return { avgTemp, avgHumidity, avgAbsHumidity, airMass, waterMass };
}

self.onmessage = (e: MessageEvent<ComputePayload>) => {
  const payload = e.data;
  const {
    sensors, sensorData, currentTimestamp, selectedMetric,
    modelScale, originalCenter, modelPosition, sensorOffset,
    smoothingWindowMs, bounds, meshResolution,
    interpolationMethod, rbfKernel, idwPower, exactVolume, jobTs
  } = payload;

  // 1) Construire les points d’interpolation à partir des capteurs
  const points = buildInterpolationPoints(
    sensors, sensorData, currentTimestamp, selectedMetric,
    modelScale, originalCenter, modelPosition, sensorOffset, smoothingWindowMs
  );
  if (points.length === 0) {
    const empty: ComputeResult = {
      positions: new Float32Array(0),
      values: new Float32Array(0),
      minValue: 0,
      maxValue: 0,
      volumetricAverage: 0,
      interpolationPointCount: 0,
      airMass: 0,
      waterMass: 0,
      avgTemp: 0,
      avgHumidity: 0,
      avgAbsHumidity: 0,
      jobTs
    };
    // @ts-ignore
    self.postMessage(empty, [empty.positions.buffer, empty.values.buffer]);
    return;
  }

  // 2) Grille
  const positions = getValidGridPoints(bounds, meshResolution);

  // 3) Interpoler
  const values = interpolateGridValues(points, positions, interpolationMethod, rbfKernel, idwPower);

  // 4) Min/Max des points capteurs
  let minValue = points[0].value;
  let maxValue = points[0].value;
  for (let i = 1; i < points.length; i++) {
    const v = points[i].value;
    if (v < minValue) minValue = v;
    if (v > maxValue) maxValue = v;
  }

  // Clamp des valeurs sur la grille pour cohérence de la légende
  clampValues(values, minValue, maxValue);

  // 5) Moyenne volumétrique
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  const volumetricAverage = values.length ? (sum / values.length) : 0;

  // 6) Propriétés de l’air (en parallèle de l’interpolation, ici dans le worker)
  const { avgTemp, avgHumidity, avgAbsHumidity, airMass, waterMass } = calculateAirProps(
    sensors, sensorData, currentTimestamp, modelScale, originalCenter || { x: 0, y: 0, z: 0 },
    modelPosition, sensorOffset, smoothingWindowMs, exactVolume,
    interpolationMethod, rbfKernel, idwPower, positions
  );

  const result: ComputeResult = {
    positions,
    values,
    minValue,
    maxValue,
    volumetricAverage,
    interpolationPointCount: values.length,
    airMass,
    waterMass,
    avgTemp,
    avgHumidity,
    avgAbsHumidity,
    jobTs
  };

  // @ts-ignore
  self.postMessage(result, [positions.buffer, values.buffer]);
};