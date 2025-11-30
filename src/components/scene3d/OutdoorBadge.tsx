"use client";

import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue } from '@/utils/colorUtils';
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
    const iconProps = { size: 14, strokeWidth: 2.5 };
    switch (selectedMetric) {
      case 'temperature':
        return <Thermometer {...iconProps} />;
      case 'humidity':
        return <Droplets {...iconProps} />;
      case 'absoluteHumidity':
        return <Wind {...iconProps} />;
      case 'dewPoint':
        return <CloudRain {...iconProps} />;
    }
  };

  const getMetricColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    const clampedValue = Math.max(
      interpolationRange.min,
      Math.min(interpolationRange.max, outdoorValue)
    );
    
    const color = getColorFromValue(clampedValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  const getDifferenceText = () => {
    if (!meshingEnabled || volumetricAverage === null) return null;

    const outdoorValue = currentOutdoorData[selectedMetric];
    const diff = outdoorValue - volumetricAverage;
    
    const sign = diff > 0 ? '+' : '';
    const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
    const unit = getMetricUnit(selectedMetric);
    
    return `${sign}${diff.toFixed(decimals)}${unit}`;
  };

  const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
  const displayValue = formatMetricValue(currentOutdoorData[selectedMetric], selectedMetric, decimals);
  const differenceText = getDifferenceText();
  const metricColor = getMetricColor();

  const textStyle = {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3), 0 -1px 0 rgba(255, 255, 255, 0.5)',
    color: 'rgba(0, 0, 0, 0.65)'
  };

  const valueStyle = {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.4)',
    color: metricColor,
    filter: 'brightness(0.85)'
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="space-y-2">
        {/* Title with icon */}
        <div className="flex items-center gap-2">
          <div style={{ color: metricColor, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3)) brightness(0.85)' }}>
            {getMetricIcon()}
          </div>
          <span className="text-xs font-bold tracking-wide" style={textStyle}>
            Extérieur
          </span>
        </div>

        {/* Main value */}
        <div className="flex items-center justify-center">
          <span 
            className="text-2xl font-black tracking-tight"
            style={valueStyle}
          >
            {displayValue}
          </span>
        </div>
        
        {/* Difference with interior */}
        {meshingEnabled && volumetricAverage !== null && differenceText && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-black/10">
            <span className="text-[10px] font-medium" style={textStyle}>
              Δ Intérieur
            </span>
            <span className="text-[11px] font-bold" style={{
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.4)',
              color: 'rgba(0, 0, 0, 0.75)'
            }}>
              {differenceText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};