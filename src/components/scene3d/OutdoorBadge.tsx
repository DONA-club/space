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
    const iconProps = { size: 14, strokeWidth: 2 };
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

  return (
    <div className="absolute top-3 left-3 z-10">
      <div className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/30 dark:bg-black/30 border border-white/40 dark:border-white/20 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
        
        <div className="relative px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div 
              className="p-1 rounded-lg bg-white/50 dark:bg-white/10"
              style={{ color: metricColor }}
            >
              {getMetricIcon()}
            </div>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              Extérieur
            </span>
          </div>

          <div className="flex items-center justify-center">
            <span 
              className="text-xl font-black tracking-tight"
              style={{ color: metricColor }}
            >
              {displayValue}
            </span>
          </div>
          
          {meshingEnabled && volumetricAverage !== null && differenceText && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/30">
              <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                Δ Intérieur
              </span>
              <span className="text-[10px] font-bold text-gray-800 dark:text-white">
                {differenceText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};