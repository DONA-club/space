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
    <div className="absolute top-4 right-4 z-10">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/20 shadow-2xl">
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>
        
        <div className="relative p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/40 dark:border-white/20">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm">
              <Wind size={18} className="text-cyan-600 dark:text-cyan-400" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-gray-800 dark:text-white">
              Volume d'air
            </span>
          </div>
          
          <div className="space-y-2">
            {/* Volume */}
            <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                Volume:
              </span>
              <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400">
                {airVolume.toFixed(2)} m³
              </span>
            </div>
            
            {/* Air mass */}
            <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <Scale size={12} className="text-purple-600 dark:text-purple-400" strokeWidth={2.5} />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  Masse air:
                </span>
              </div>
              <span className="text-sm font-bold text-purple-700 dark:text-purple-400">
                {airMass.toFixed(2)} kg
              </span>
            </div>
            
            {/* Water mass */}
            {waterMass !== null && (
              <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <CloudRain size={12} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    Masse H₂O:
                  </span>
                </div>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                  {waterMass.toFixed(1)} g
                </span>
              </div>
            )}
            
            {/* Average temperature */}
            {averageTemperature !== null && (
              <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <Thermometer size={12} className="text-red-600 dark:text-red-400" strokeWidth={2.5} />
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    T° moy:
                  </span>
                </div>
                <span className="text-sm font-bold text-red-700 dark:text-red-400">
                  {averageTemperature.toFixed(1)}°C
                </span>
              </div>
            )}
            
            {/* Average humidity */}
            {averageHumidity !== null && (
              <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-lg bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <Droplets size={12} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    HR moy:
                  </span>
                </div>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                  {averageHumidity.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          {/* Density footer */}
          <div className="pt-2 border-t border-white/40 dark:border-white/20">
            <p className="text-[10px] font-semibold text-center text-gray-600 dark:text-gray-400">
              Densité: {(airMass / airVolume).toFixed(3)} kg/m³
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};