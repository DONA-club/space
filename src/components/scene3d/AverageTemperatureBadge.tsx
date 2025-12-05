"use client";

import { Thermometer, Droplets, Wind, CloudRain, Gauge } from 'lucide-react';
import { MetricType } from '@/types/sensor.types';
import { getColorFromValue, rgbaFromColor } from '@/utils/colorUtils';
import { formatMetricValue, getMetricLabel } from '@/utils/metricUtils';

interface AverageTemperatureBadgeProps {
  averageValue: number | null;
  selectedMetric: MetricType;
  interpolationRange: { min: number; max: number } | null;
  meshingEnabled: boolean;
  dataReady: boolean;
  pointCount: number;
}

export const AverageTemperatureBadge = ({
  averageValue,
  selectedMetric,
  interpolationRange,
  meshingEnabled,
  dataReady,
  pointCount
}: AverageTemperatureBadgeProps) => {
  if (!meshingEnabled || !dataReady || !interpolationRange || averageValue === null) {
    return null;
  }

  const getMetricIcon = () => {
    const iconProps = { size: 16 };
    switch (selectedMetric) {
      case 'temperature':
        return <Thermometer {...iconProps} />;
      case 'humidity':
        return <Droplets {...iconProps} />;
      case 'absoluteHumidity':
        return <Wind {...iconProps} />;
      case 'dewPoint':
        return <CloudRain {...iconProps} />;
      case 'vpd':
        return <Gauge {...iconProps} />;
    }
  };

  const getBackgroundColor = () => {
    const color = getColorFromValue(averageValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return rgbaFromColor(color, 0.15);
  };

  const getTextColor = () => {
    const color = getColorFromValue(averageValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
  const displayValue = formatMetricValue(averageValue, selectedMetric, decimals);
  const metricLabel = getMetricLabel(selectedMetric);

  return (
    <div className="absolute top-4 left-4 z-10">
      <div 
        className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: getTextColor() }}>
            {getMetricIcon()}
          </div>
          <div>
            <p className="text-[10px] text-gray-600 dark:text-gray-300">Moyenne volumique</p>
            <div className="flex items-baseline gap-1">
              <p 
                className="text-sm font-semibold"
                style={{ color: getTextColor() }}
              >
                {displayValue}
              </p>
            </div>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">
              {pointCount.toLocaleString()} points
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};