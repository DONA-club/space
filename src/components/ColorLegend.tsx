"use client";

import { useAppStore } from '@/store/appStore';
import { motion, AnimatePresence } from 'framer-motion';

interface ColorLegendProps {
  volumetricAverage?: number | null;
}

export const ColorLegend = ({ volumetricAverage }: ColorLegendProps) => {
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const dataReady = useAppStore((state) => state.dataReady);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const interpolationRange = useAppStore((state) => state.interpolationRange);

  if (!meshingEnabled || !dataReady || !interpolationRange) return null;

  const getMetricInfo = () => {
    switch (selectedMetric) {
      case 'temperature':
        return {
          label: 'Température',
          unit: '°C',
          colors: ['#3b82f6', '#06b6d4', '#10b981', '#fbbf24', '#f97316', '#ef4444'],
        };
      case 'humidity':
        return {
          label: 'Humidité Relative',
          unit: '%',
          colors: ['#fbbf24', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#3b82f6'],
        };
      case 'absoluteHumidity':
        return {
          label: 'Humidité Absolue',
          unit: 'g/m³',
          colors: ['#fbbf24', '#f97316', '#ef4444', '#ec4899', '#a855f7'],
        };
      case 'dewPoint':
        return {
          label: 'Point de Rosée',
          unit: '°C',
          colors: ['#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4'],
        };
    }
  };

  const metricInfo = getMetricInfo();
  const gradient = `linear-gradient(to right, ${metricInfo.colors.join(', ')})`;

  const getAveragePosition = () => {
    if (volumetricAverage === null || volumetricAverage === undefined) return null;
    
    const normalized = (volumetricAverage - interpolationRange.min) / (interpolationRange.max - interpolationRange.min);
    const percentage = Math.max(0, Math.min(100, normalized * 100));
    return percentage;
  };

  const getAverageColor = () => {
    if (volumetricAverage === null || volumetricAverage === undefined) return '#ffffff';
    
    const normalized = (volumetricAverage - interpolationRange.min) / (interpolationRange.max - interpolationRange.min);
    const clampedNormalized = Math.max(0, Math.min(1, normalized));
    
    const colors = metricInfo.colors;
    const segmentSize = 1 / (colors.length - 1);
    const segmentIndex = Math.floor(clampedNormalized / segmentSize);
    const segmentProgress = (clampedNormalized % segmentSize) / segmentSize;
    
    const startColorIndex = Math.min(segmentIndex, colors.length - 2);
    const endColorIndex = startColorIndex + 1;
    
    const startColor = colors[startColorIndex];
    const endColor = colors[endColorIndex];
    
    const parseHex = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    
    const start = parseHex(startColor);
    const end = parseHex(endColor);
    
    const r = Math.round(start.r + (end.r - start.r) * segmentProgress);
    const g = Math.round(start.g + (end.g - start.g) * segmentProgress);
    const b = Math.round(start.b + (end.b - start.b) * segmentProgress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const averagePosition = getAveragePosition();
  const averageColor = getAverageColor();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="absolute bottom-3 left-3 z-10"
      >
        <div className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/30 dark:bg-black/30 border border-white/40 dark:border-white/20 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
          
          <div className="relative px-3 py-2 space-y-2">
            {/* Header with metric label */}
            <div className="flex items-center justify-center">
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                {metricInfo.label}
              </span>
            </div>
            
            {/* Gradient bar with cursor */}
            <div className="relative">
              <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: gradient }}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>
              
              {/* Volumetric average indicator - raised by half its radius */}
              {averagePosition !== null && (
                <div className="absolute top-0 left-0 right-0 group">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute top-[3.75px] -translate-x-1/2 cursor-help"
                    style={{ left: `${averagePosition}%` }}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-lg relative"
                      style={{ backgroundColor: averageColor }}
                    >
                      <div 
                        className="absolute inset-0 rounded-full animate-ping opacity-75" 
                        style={{ backgroundColor: averageColor }}
                      ></div>
                    </div>
                  </motion.div>
                  
                  {/* Tooltip on hover - shows volumetric average */}
                  <div 
                    className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-gray-900 text-white px-2 py-1 rounded text-[9px] font-medium z-[99999]"
                    style={{ 
                      left: `${averagePosition}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <span style={{ color: averageColor }}>
                      Moyenne volumique: {volumetricAverage.toFixed(selectedMetric === 'absoluteHumidity' ? 2 : 1)}{metricInfo.unit}
                    </span>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Min/Max values - inline */}
            <div className="flex items-center justify-between text-[9px] font-medium">
              <span className="text-blue-600 dark:text-blue-400">
                {interpolationRange.min.toFixed(1)}{metricInfo.unit}
              </span>
              <span className="text-red-600 dark:text-red-400">
                {interpolationRange.max.toFixed(1)}{metricInfo.unit}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};