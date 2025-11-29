import { Thermometer, Droplets, Wind, CloudRain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as THREE from 'three';
import { getColorFromValue } from '@/utils/colorUtils';

interface OutdoorBadgeProps {
  currentOutdoorData: {
    temperature: number;
    humidity: number;
    absoluteHumidity: number;
    dewPoint: number;
  } | null;
  indoorAverage: {
    temperature: number;
    humidity: number;
    absoluteHumidity: number;
    dewPoint: number;
  } | null;
  selectedMetric: string;
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
    switch (selectedMetric) {
      case 'temperature':
        return <Thermometer size={16} className="text-red-500" />;
      case 'humidity':
        return <Droplets size={16} className="text-blue-500" />;
      case 'absoluteHumidity':
        return <Wind size={16} className="text-cyan-500" />;
      case 'dewPoint':
        return <CloudRain size={16} className="text-purple-500" />;
    }
  };

  const getMetricValue = () => {
    switch (selectedMetric) {
      case 'temperature':
        return `${currentOutdoorData.temperature.toFixed(1)}°C`;
      case 'humidity':
        return `${currentOutdoorData.humidity.toFixed(1)}%`;
      case 'absoluteHumidity':
        return `${currentOutdoorData.absoluteHumidity.toFixed(2)} g/m³`;
      case 'dewPoint':
        return `${currentOutdoorData.dewPoint.toFixed(1)}°C`;
    }
  };

  const getComparisonIcon = () => {
    if (!indoorAverage) return null;

    const outdoorValue = selectedMetric === 'temperature' ? currentOutdoorData.temperature :
                         selectedMetric === 'humidity' ? currentOutdoorData.humidity :
                         selectedMetric === 'absoluteHumidity' ? currentOutdoorData.absoluteHumidity :
                         currentOutdoorData.dewPoint;

    const indoorValue = selectedMetric === 'temperature' ? indoorAverage.temperature :
                        selectedMetric === 'humidity' ? indoorAverage.humidity :
                        selectedMetric === 'absoluteHumidity' ? indoorAverage.absoluteHumidity :
                        indoorAverage.dewPoint;

    const diff = Math.abs(outdoorValue - indoorValue);
    const range = interpolationRange.max - interpolationRange.min;
    const threshold = range * 0.1;

    if (diff < threshold) {
      return <Minus size={14} className="text-gray-400" />;
    } else if (outdoorValue > indoorValue) {
      return <TrendingUp size={14} className="text-orange-500" />;
    } else {
      return <TrendingDown size={14} className="text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    const outdoorValue = selectedMetric === 'temperature' ? currentOutdoorData.temperature :
                         selectedMetric === 'humidity' ? currentOutdoorData.humidity :
                         selectedMetric === 'absoluteHumidity' ? currentOutdoorData.absoluteHumidity :
                         currentOutdoorData.dewPoint;

    const color = getColorFromValue(outdoorValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    const threeColor = new THREE.Color(color);
    
    const r = Math.round(threeColor.r * 255);
    const g = Math.round(threeColor.g * 255);
    const b = Math.round(threeColor.b * 255);
    
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  };

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
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getMetricValue()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};