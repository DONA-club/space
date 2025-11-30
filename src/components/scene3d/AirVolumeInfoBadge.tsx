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

  const textStyle = {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3), 0 -1px 0 rgba(255, 255, 255, 0.5)',
    color: 'rgba(0, 0, 0, 0.65)'
  };

  const valueStyle = {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.4)',
    color: 'rgba(0, 0, 0, 0.75)'
  };

  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="space-y-2">
        {/* Title with icon */}
        <div className="flex items-center gap-2">
          <Wind size={16} className="opacity-60" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
          <span className="text-xs font-bold tracking-wide" style={textStyle}>
            Espace
          </span>
        </div>
        
        {/* Measurements */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Wind size={12} className="opacity-50" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
            <span className="text-[10px] font-medium" style={textStyle}>
              Volume:
            </span>
            <span className="text-[11px] font-bold ml-auto" style={valueStyle}>
              {airVolume.toFixed(2)} m³
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Scale size={12} className="opacity-50" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
            <span className="text-[10px] font-medium" style={textStyle}>
              Masse air:
            </span>
            <span className="text-[11px] font-bold ml-auto" style={valueStyle}>
              {airMass.toFixed(2)} kg
            </span>
          </div>
          
          {waterMass !== null && (
            <div className="flex items-center gap-2">
              <CloudRain size={12} className="opacity-50" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
              <span className="text-[10px] font-medium" style={textStyle}>
                Masse H₂O:
              </span>
              <span className="text-[11px] font-bold ml-auto" style={valueStyle}>
                {waterMass.toFixed(1)} g
              </span>
            </div>
          )}
          
          {averageTemperature !== null && (
            <div className="flex items-center gap-2">
              <Thermometer size={12} className="opacity-50" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
              <span className="text-[10px] font-medium" style={textStyle}>
                T° moyenne:
              </span>
              <span className="text-[11px] font-bold ml-auto" style={valueStyle}>
                {averageTemperature.toFixed(1)}°C
              </span>
            </div>
          )}
          
          {averageHumidity !== null && (
            <div className="flex items-center gap-2">
              <Droplets size={12} className="opacity-50" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
              <span className="text-[10px] font-medium" style={textStyle}>
                HR moyenne:
              </span>
              <span className="text-[11px] font-bold ml-auto" style={valueStyle}>
                {averageHumidity.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Density */}
        <div className="pt-1.5 border-t border-black/10">
          <p className="text-[10px] font-bold text-center" style={valueStyle}>
            ρ: {(airMass / airVolume).toFixed(3)} kg/m³
          </p>
        </div>
      </div>
    </div>
  );
};