"use client";

import { Thermometer, Droplets, Wind, CloudRain, Gauge } from 'lucide-react';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue, rgbaFromColor } from '@/utils/colorUtils';
import { formatMetricValue, getMetricUnit } from '@/utils/metricUtils';

interface OutdoorBadgeProps {
  currentOutdoorData: SensorDataPoint | null;
  indoorAverage: SensorDataPoint | null;
  selectedMetric: MetricType;
  interpolationRange: { min: number; max: number } | null;
  hasOutdoorData: boolean;
  dataReady: boolean;
  volumetricAverage: number | null;
  meshingEnabled: boolean;
}

export const OutdoorBadge = ({
  currentOutdoorData,
  indoorAverage,
  selectedMetric,
  interpolationRange,
  hasOutdoorData,
  dataReady,
  volumetricAverage,
  meshingEnabled
}: OutdoorBadgeProps) => {
  if (!hasOutdoorData || !currentOutdoorData || !dataReady || !interpolationRange) {
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
      case 'vpdKpa':
        return <Gauge {...iconProps} />;
    }
  };

  const getMetricColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    const clampedValue = Math.max(
      interpolationRange.min,
      Math.min(interpolationRange.max, outdoorValue ?? 0)
    );
    
    const color = getColorFromValue(clampedValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  const getBackgroundColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    const clampedValue = Math.max(
      interpolationRange.min,
      Math.min(interpolationRange.max, outdoorValue ?? 0)
    );
    
    const color = getColorFromValue(clampedValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return rgbaFromColor(color, 0.15);
  };

  const getDifferenceText = () => {
    if (!meshingEnabled || volumetricAverage === null) return null;

    const outdoorValue = currentOutdoorData[selectedMetric] ?? 0;
    const diff = outdoorValue - volumetricAverage;
    
    const sign = diff > 0 ? '+' : '';
    const decimals = (selectedMetric === 'absoluteHumidity' || selectedMetric === 'vpdKpa') ? 2 : 1;
    const unit = getMetricUnit(selectedMetric);
    
    return `${sign}${diff.toFixed(decimals)}${unit}`;
  };

  const decimals = (selectedMetric === 'absoluteHumidity' || selectedMetric === 'vpdKpa') ? 2 : 1;
  const displayValue = formatMetricValue(currentOutdoorData[selectedMetric] ?? 0, selectedMetric, decimals);
  const differenceText = getDifferenceText();
  const metricColor = getMetricColor();

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div 
        className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: metricColor }}>
            {getMetricIcon()}
          </div>
          <div>
            <p className="text-[10px] text-gray-600 dark:text-gray-300">Extérieur</p>
            <div className="flex items-baseline gap-1">
              <p 
                className="text-sm font-semibold"
                style={{ color: metricColor }}
              >
                {displayValue}
              </p>
            </div>
            {meshingEnabled && volumetricAverage !== null && differenceText && (
              <p className="text-[9px] text-gray-500 dark:text-gray-400">
                Δ Int: {differenceText}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};