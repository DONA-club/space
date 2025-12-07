"use client";

import { useAppStore } from '@/store/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';
import { useSmoothedValue } from '@/hooks/useSmoothedValue';

interface ColorLegendProps {
  volumetricAverage?: number | null;
}

export const ColorLegend = ({ volumetricAverage }: ColorLegendProps) => {
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const dataReady = useAppStore((state) => state.dataReady);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const interpolationRange = useAppStore((state) => state.interpolationRange);

  const { theme } = useTheme();
  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const smoothedAverage = useSmoothedValue(volumetricAverage ?? null, {
    stiffness: 200,
    damping: 28,
    enabled: true,
  });

  if (!dataReady || !interpolationRange) return null;

  const getMetricInfo = () => {
    switch (selectedMetric) {
      case 'temperature':
        return {
          label: 'TEMPÉRATURE',
          unit: '°C',
          colors: ['#3b82f6', '#06b6d4', '#10b981', '#fbbf24', '#f97316', '#ef4444'],
        };
      case 'humidity':
        return {
          label: 'HUMIDITÉ RELATIVE',
          unit: '%',
          colors: ['#fbbf24', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#3b82f6'],
        };
      case 'absoluteHumidity':
        return {
          label: 'HUMIDITÉ ABSOLUE',
          unit: 'g/m³',
          colors: ['#fbbf24', '#f97316', '#ef4444', '#ec4899', '#a855f7'],
        };
      case 'dewPoint':
        return {
          label: 'POINT DE ROSÉE',
          unit: '°C',
          colors: ['#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4'],
        };
      case 'vpdKpa':
        return {
          label: 'déficit de pression de vapeur',
          unit: 'kPa',
          colors: ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'],
        };
      default:
        return {
          label: '',
          unit: '',
          colors: ['#3b82f6', '#ef4444'],
        };
    }
  };

  const metricInfo = getMetricInfo()!;
  const gradient = `linear-gradient(to right, ${metricInfo.colors.join(', ')})`;

  const getPositionFromValue = (avg: number | null) => {
    if (!meshingEnabled || avg === null || avg === undefined) return null;
    const normalized = (avg - interpolationRange.min) / (interpolationRange.max - interpolationRange.min);
    const percentage = Math.max(0, Math.min(100, normalized * 100));
    return percentage;
  };

  const getColorFromValue = (avg: number | null) => {
    if (!meshingEnabled || avg === null || avg === undefined) return '#ffffff';
    const normalized = (avg - interpolationRange.min) / (interpolationRange.max - interpolationRange.min);
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

  const averagePosition = getPositionFromValue(smoothedAverage ?? null);
  const averageColor = getColorFromValue(smoothedAverage ?? null);

  const minColor = metricInfo.colors[0];
  const maxColor = metricInfo.colors[metricInfo.colors.length - 1];

  const decimals = (selectedMetric === 'absoluteHumidity' || selectedMetric === 'vpdKpa') ? 2 : 1;

  const titleSpan = (
    <span
      className="text-[10px] sm:text-xs font-semibold tracking-wide"
      style={{
        textShadow: isDarkMode
          ? '0 1px 1px rgba(255,255,255,0.06), 0 -1px 0 rgba(0,0,0,0.5)'
          : '0 1px 1px rgba(0, 0, 0, 0.15), 0 -1px 0 rgba(255, 255, 255, 0.3)',
        color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0, 0, 0, 0.5)',
      }}
    >
      {metricInfo.label}
    </span>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="absolute top-2 sm:top-4 left-0 right-0 z-10 flex justify-center px-2"
      >
        <div className="space-y-1 sm:space-y-2 flex flex-col items-center">
          <div className="flex items-center justify-center">
            {titleSpan}
          </div>

          <div className="relative w-[150px] sm:w-[200px]">
            <div
              className="h-2 sm:h-3 rounded-full shadow-inner"
              style={{
                background: gradient,
                boxShadow: isDarkMode
                  ? 'inset 0 2px 4px rgba(255,255,255,0.1)'
                  : 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            ></div>

            {meshingEnabled && averagePosition !== null && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="absolute -translate-x-1/2"
                style={{
                  left: `${averagePosition}%`,
                  top: '0px',
                }}
              >
                <div
                  className="w-2 sm:w-3 h-2 sm:h-3 rounded-full border-2 border-white shadow-lg relative"
                  style={{ backgroundColor: averageColor }}
                >
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: averageColor }}
                  ></div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="relative w-[150px] sm:w-[200px] flex items-center justify-between text-[9px] sm:text-[11px] font-bold">
            <span
              className="absolute left-0 -translate-x-1/2"
              style={{
                color: minColor,
                textShadow: isDarkMode
                  ? '0 1px 2px rgba(255,255,255,0.18)'
                  : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.2)',
                filter: isDarkMode ? 'brightness(1.15) opacity(0.95)' : 'brightness(0.9) opacity(0.8)',
              }}
            >
              {interpolationRange.min.toFixed(decimals)}
              {metricInfo.unit}
            </span>

            {meshingEnabled &&
              averagePosition !== null &&
              smoothedAverage !== null &&
              smoothedAverage !== undefined && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="absolute -translate-x-1/2"
                  style={{
                    left: `${averagePosition}%`,
                    color: averageColor,
                    textShadow: isDarkMode
                      ? '0 1px 2px rgba(255,255,255,0.18)'
                      : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.2)',
                    filter: isDarkMode ? 'brightness(1.2) opacity(0.95)' : 'brightness(0.9) opacity(0.8)',
                  }}
                >
                  {smoothedAverage.toFixed(decimals)}
                  {metricInfo.unit}
                </motion.span>
              )}

            <span
              className="absolute right-0 translate-x-1/2"
              style={{
                color: maxColor,
                textShadow: isDarkMode
                  ? '0 1px 2px rgba(255,255,255,0.18)'
                  : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.2)',
                filter: isDarkMode ? 'brightness(1.15) opacity(0.95)' : 'brightness(0.9) opacity(0.8)',
              }}
            >
              {interpolationRange.max.toFixed(decimals)}
              {metricInfo.unit}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};