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
    const iconProps = { size: 18, strokeWidth: 2.5 };
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
    <div className="absolute top-4 left-4 z-10">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/20 shadow-2xl">
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
        
        <div className="relative p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div 
              className="p-2 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-sm shadow-lg"
              style={{ color: metricColor }}
            >
              {getMetricIcon()}
            </div>
            <span className="text-sm font-bold text-gray-800 dark:text-white">
              Extérieur
            </span>
          </div>

          {/* Main value with enhanced contrast */}
          <div className="flex items-center justify-center py-2">
            <div 
              className="px-4 py-2 rounded-xl bg-white/80 dark:bg-black/40 backdrop-blur-sm shadow-inner"
            >
              <span 
                className="text-2xl font-black tracking-tight"
                style={{ 
                  color: metricColor,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {displayValue}
              </span>
            </div>
          </div>
          
          {/* Delta with better contrast */}
          {meshingEnabled && volumetricAverage !== null && differenceText && (
            <div className="pt-2 border-t border-white/40 dark:border-white/20">
              <div className="flex items-center justify-between px-2">
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  Int./Ext.:
                </span>
                <div className="px-2 py-1 rounded-lg bg-white/70 dark:bg-black/30 backdrop-blur-sm">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {differenceText}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};