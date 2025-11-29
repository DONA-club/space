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
      <div className="backdrop-blur-xl rounded-xl p-3 shadow-lg border border-white/40 bg-white/10 dark:bg-black/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-white/20">
            <Wind size={16} className="text-cyan-600" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Volume d'air
            </span>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">Volume:</span>
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                {airVolume.toFixed(2)} m³
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Scale size={10} className="text-purple-600" />
                <span className="text-[10px] text-gray-600 dark:text-gray-400">Masse air:</span>
              </div>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                {airMass.toFixed(2)} kg
              </span>
            </div>
            
            {waterMass !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <CloudRain size={10} className="text-blue-600" />
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">Masse H₂O:</span>
                </div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {waterMass.toFixed(1)} g
                </span>
              </div>
            )}
            
            {averageTemperature !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Thermometer size={10} className="text-red-600" />
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">T° moy:</span>
                </div>
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {averageTemperature.toFixed(1)}°C
                </span>
              </div>
            )}
            
            {averageHumidity !== null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Droplets size={10} className="text-blue-600" />
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">HR moy:</span>
                </div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {averageHumidity.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-white/20">
            <p className="text-[9px] text-gray-500 dark:text-gray-400 text-center">
              Densité: {(airMass / airVolume).toFixed(3)} kg/m³
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};