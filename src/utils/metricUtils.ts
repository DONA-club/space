import { MetricType, SensorDataPoint, METRIC_INFO } from '@/types/sensor.types';

export const getMetricValue = (
  data: SensorDataPoint,
  metric: MetricType
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
    case 'vpdKpa':
      return data.vpdKpa ?? 0;
  }
};

export const formatMetricValue = (
  value: number,
  metric: MetricType,
  decimals: number = 1
): string => {
  const formatted = value.toFixed(decimals);
  const unit = METRIC_INFO[metric].unit;
  return `${formatted}${unit}`;
};

export const getMetricLabel = (metric: MetricType): string => {
  return METRIC_INFO[metric].label;
};

export const getMetricUnit = (metric: MetricType): string => {
  return METRIC_INFO[metric].unit;
};