import { Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue, rgbaFromColor } from '@/utils/colorUtils';
import { formatMetricValue } from '@/utils/metricUtils';

interface OutdoorBadgeProps {
  currentOutdoorData: SensorDataPoint | null;
  indoorAverage: SensorDataPoint | null;
  selectedMetric: MetricType;
  interpolationRange: { min: number; max: number } | null;
  hasOutdoorData: boolean;
  dataReady: boolean;
}

export const OutdoorBadge = ({
  currentOutdoorData,
  indoorAverage,
  selectedMetric,
  interpolationRange,
  hasOutdoorData,
  dataReady
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
    if (!indoorAverage) return null;

    const outdoorValue = currentOutdoorData[selectedMetric];
    const indoorValue = indoorAverage[selectedMetric];
    const diff = outdoorValue - indoorValue;
    
    const sign = diff > 0 ? '+' : '';
    const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
    
    return `${sign}${diff.toFixed(decimals)}`;
  };

  const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
  const displayValue = formatMetricValue(currentOutdoorData[selectedMetric], selectedMetric, decimals);
  const differenceText = getDifferenceText();

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div 
        className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: getTextColor() }}>
            {getMetricIcon()}
          </div>
          <div>
            <p className="text-[10px] text-gray-600 dark:text-gray-300">Extérieur</p>
            <div className="flex items-baseline gap-1">
              <p 
                className="text-sm font-semibold"
                style={{ color: getTextColor() }}
              >
                {displayValue}
              </p>
              {differenceText && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  ({differenceText})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};