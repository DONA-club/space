import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue, rgbaFromColor } from '@/utils/colorUtils';
import { formatMetricValue, getMetricLabel } from '@/utils/metricUtils';

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
    }
  };

  const getBackgroundColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    
    // Clamp outdoor value to indoor range for color calculation
    const clampedValue = Math.max(
      interpolationRange.min,
      Math.min(interpolationRange.max, outdoorValue)
    );
    
    const color = getColorFromValue(clampedValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return rgbaFromColor(color, 0.15);
  };

  const getTextColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    
    // Clamp outdoor value to indoor range for color calculation
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
    
    return `${sign}${diff.toFixed(decimals)}`;
  };

  const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
  const displayValue = formatMetricValue(currentOutdoorData[selectedMetric], selectedMetric, decimals);
  const differenceText = getDifferenceText();
  const metricLabel = getMetricLabel(selectedMetric);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div 
        className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-white/20">
            <div style={{ color: getTextColor() }}>
              {getMetricIcon()}
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Extérieur
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">{metricLabel}:</span>
              <span 
                className="text-sm font-semibold"
                style={{ color: getTextColor() }}
              >
                {displayValue}
              </span>
            </div>
            
            {meshingEnabled && volumetricAverage !== null && differenceText && (
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/20">
                <span className="text-[10px] text-gray-600 dark:text-gray-400">Δ Volumique:</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {differenceText}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};