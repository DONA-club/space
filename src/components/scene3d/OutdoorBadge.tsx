import { Thermometer, Droplets, Wind, CloudRain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
        return <Thermometer {...iconProps} className="text-red-500" />;
      case 'humidity':
        return <Droplets {...iconProps} className="text-blue-500" />;
      case 'absoluteHumidity':
        return <Wind {...iconProps} className="text-cyan-500" />;
      case 'dewPoint':
        return <CloudRain {...iconProps} className="text-purple-500" />;
    }
  };

  const getComparisonIcon = () => {
    if (!indoorAverage) return null;

    const outdoorValue = currentOutdoorData[selectedMetric];
    const indoorValue = indoorAverage[selectedMetric];
    const diff = Math.abs(outdoorValue - indoorValue);
    const range = interpolationRange.max - interpolationRange.min;
    const threshold = range * 0.1;

    const iconProps = { size: 14 };
    
    if (diff < threshold) {
      return <Minus {...iconProps} className="text-gray-400" />;
    } else if (outdoorValue > indoorValue) {
      return <TrendingUp {...iconProps} className="text-orange-500" />;
    } else {
      return <TrendingDown {...iconProps} className="text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    const outdoorValue = currentOutdoorData[selectedMetric];
    const color = getColorFromValue(outdoorValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    return rgbaFromColor(color, 0.15);
  };

  const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
  const displayValue = formatMetricValue(currentOutdoorData[selectedMetric], selectedMetric, decimals);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div 
        className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <div className="flex items-center gap-2">
          {getMetricIcon()}
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-gray-600 dark:text-gray-300">Extérieur</p>
              {getComparisonIcon()}
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {displayValue}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};