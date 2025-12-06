export interface Sensor {
  id: number;
  position: [number, number, number];
  name: string;
  csvFile?: File;
  currentData?: SensorDataPoint;
}

export interface SensorDataPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
  absoluteHumidity: number;
  dewPoint: number;
  vpdKpa?: number;
}

export type MetricType = 'temperature' | 'humidity' | 'absoluteHumidity' | 'dewPoint' | 'vpdKpa';

export interface MetricInfo {
  label: string;
  unit: string;
  icon: string;
}

export const METRIC_INFO: Record<MetricType, MetricInfo> = {
  temperature: { label: 'Température', unit: '°C', icon: 'thermometer' },
  humidity: { label: 'Humidité Relative', unit: '%', icon: 'droplets' },
  absoluteHumidity: { label: 'Humidité Absolue', unit: 'g/m³', icon: 'wind' },
  dewPoint: { label: 'Point de Rosée', unit: '°C', icon: 'cloud-rain' },
  vpdKpa: { label: 'Déficit de pression de vapeur (VPD)', unit: 'kPa', icon: 'gauge' }
};