"use client";

import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue } from '@/utils/colorUtils';
import { formatMetricValue, getMetricUnit } from '@/utils/metricUtils';
import { useTheme } from '@/components/theme-provider';

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
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (!hasOutdoorData || !currentOutdoorData || !dataReady || !interpolationRange) {
    return null;
  }

  const getMetricIcon = () => {
    const iconProps = { size: 13, strokeWidth: 2.5 };
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
    textShadow: isDarkMode
      ? '0 1px 1px rgba(255, 255, 255, 0.06), 0 -1px 0 rgba(0, 0, 0, 0.5)'
      : '0 1px 1px rgba(0, 0, 0, 0.15), 0 -1px 0 rgba(255, 255, 255, 0.3)',
    color: isDarkMode ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.4)'
  } as const;

  const valueStyle = {
    textShadow: isDarkMode
      ? '0 1px 1px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 255, 255, 0.08)'
      : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.25)',
    color: metricColor,
    filter: isDarkMode ? 'brightness(1.2) opacity(0.95)' : 'brightness(0.9) opacity(0.8)'
  } as const;

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="space-y-2">
        {/* Title with icon */}
        <div className="flex items-center gap-2">
          <div style={{ color: metricColor, filter: isDarkMode ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.35)) brightness(1.0) opacity(0.85)' : 'drop-shadow(0 1px 1px rgba(0,0,0,0.15)) brightness(0.9) opacity(0.7)' }}>
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
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-black/5 dark:border-white/10">
            <span className="text-[10px] font-medium" style={textStyle}>
              Δ Intérieur
            </span>
            <span className="text-[10px] font-bold" style={{
              textShadow: isDarkMode
                ? '0 1px 1px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 255, 255, 0.06)'
                : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.25)',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.5)'
            }}>
              {differenceText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};