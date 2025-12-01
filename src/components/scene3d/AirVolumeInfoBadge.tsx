"use client";

import { Scale, Thermometer, Droplets, CloudRain } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface AirVolumeInfoBadgeProps {
  airVolume: number | null;
  airMass: number | null;
  waterMass: number | null;
  averageTemperature: number | null;
  averageHumidity: number | null;
  meshingEnabled: boolean;
  dataReady: boolean;
}

export const AirVolumeInfoBadge = ({
  airVolume,
  airMass,
  waterMass,
  averageTemperature,
  averageHumidity,
  meshingEnabled,
  dataReady
}: AirVolumeInfoBadgeProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (!meshingEnabled || !dataReady || airVolume === null || airMass === null) {
    return null;
  }

  const textStyle = {
    textShadow: isDarkMode
      ? '0 1px 1px rgba(255, 255, 255, 0.06), 0 -1px 0 rgba(0, 0, 0, 0.5)'
      : '0 1px 1px rgba(0, 0, 0, 0.15), 0 -1px 0 rgba(255, 255, 255, 0.3)',
    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.4)'
  } as const;

  const valueStyle = {
    textShadow: isDarkMode
      ? '0 1px 1px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.08)'
      : '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.25)',
    color: isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.5)'
  } as const;

  const iconStyle = {
    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
    color: isDarkMode ? 'rgba(255,255,255,0.6)' : undefined
  } as const;

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Scale size={11} className="opacity-40" style={iconStyle} />
          <span className="text-[10px] font-medium" style={textStyle}>
            Volume:
          </span>
          <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
            {airVolume.toFixed(2)} m³
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Scale size={11} className="opacity-40" style={iconStyle} />
          <span className="text-[10px] font-medium" style={textStyle}>
            Masse air:
          </span>
          <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
            {airMass.toFixed(2)} kg
          </span>
        </div>
        
        {waterMass !== null && (
          <div className="flex items-center gap-2">
            <CloudRain size={11} className="opacity-40" style={iconStyle} />
            <span className="text-[10px] font-medium" style={textStyle}>
              Masse H₂O:
            </span>
            <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
              {waterMass.toFixed(1)} g
            </span>
          </div>
        )}
        
        {averageTemperature !== null && (
          <div className="flex items-center gap-2">
            <Thermometer size={11} className="opacity-40" style={iconStyle} />
            <span className="text-[10px] font-medium" style={textStyle}>
              T° moyenne:
            </span>
            <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
              {averageTemperature.toFixed(1)}°C
            </span>
          </div>
        )}
        
        {averageHumidity !== null && (
          <div className="flex items-center gap-2">
            <Droplets size={11} className="opacity-40" style={iconStyle} />
            <span className="text-[10px] font-medium" style={textStyle}>
              HR moyenne:
            </span>
            <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
              {averageHumidity.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};