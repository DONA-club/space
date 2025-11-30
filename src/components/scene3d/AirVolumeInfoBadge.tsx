"use client";

import { Wind, Scale, Thermometer, Droplets, CloudRain } from 'lucide-react';

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
  if (!meshingEnabled || !dataReady || airVolume === null || airMass === null) {
    return null;
  }

  return (
    <div className="absolute top-3 right-3 z-10">
      <div className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/30 dark:bg-black/30 border border-white/40 dark:border-white/20 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
        
        <div className="relative px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 pb-1 border-b border-white/30">
            <div className="p-1 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <Wind size={14} className="text-cyan-600 dark:text-cyan-400" strokeWidth={2} />
            </div>
            <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
              Volume d'air
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                Volume:
              </span>
              <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400">
                {airVolume.toFixed(2)} m³
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Scale size={10} className="text-purple-600 dark:text-purple-400" strokeWidth={2} />
                <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                  Masse air:
                </span>
              </div>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
                {airMass.toFixed(2)} kg
              </span>
            </div>
            
            {waterMass !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <CloudRain size={10} className="text-blue-600 dark:text-blue-400" strokeWidth={2} />
                  <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                    Masse H₂O:
                  </span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                  {waterMass.toFixed(1)} g
                </span>
              </div>
            )}
            
            {averageTemperature !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Thermometer size={10} className="text-red-600 dark:text-red-400" strokeWidth={2} />
                  <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                    T° moyenne:
                  </span>
                </div>
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400">
                  {averageTemperature.toFixed(1)}°C
                </span>
              </div>
            )}
            
            {averageHumidity !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Droplets size={10} className="text-blue-600 dark:text-blue-400" strokeWidth={2} />
                  <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">
                    HR moyenne:
                  </span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                  {averageHumidity.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="pt-1 border-t border-white/30">
            <p className="text-[8px] font-medium text-center text-gray-600 dark:text-gray-400">
              ρ: {(airMass / airVolume).toFixed(3)} kg/m³
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};