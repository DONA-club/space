"use client";

import { Scale, Thermometer, Droplets, CloudRain } from 'lucide-react';

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
    textShadow: '0 1px 1px rgba(0, 0, 0, 0.15), 0 -1px 0 rgba(255, 255, 255, 0.3)',
    color: 'rgba(0, 0, 0, 0.4)'
  };

  const valueStyle = {
    textShadow: '0 1px 1px rgba(0, 0, 0, 0.2), 0 -1px 0 rgba(255, 255, 255, 0.25)',
    color: 'rgba(0, 0, 0, 0.5)'
  };

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div className="space-y-1.5">
        {/* Measurements */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale size={11} className="opacity-40" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }} />
            <span className="text-[10px] font-medium" style={textStyle}>
              Volume:
            </span>
            <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
              {airVolume.toFixed(2)} m³
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Scale size={11} className="opacity-40" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }} />
            <span className="text-[10px] font-medium" style={textStyle}>
              Masse air:
            </span>
            <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
              {airMass.toFixed(2)} kg
            </span>
          </div>
          
          {waterMass !== null && (
            <div className="flex items-center gap-2">
              <CloudRain size={11} className="opacity-40" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }} />
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
              <Thermometer size={11} className="opacity-40" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }} />
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
              <Droplets size={11} className="opacity-40" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }} />
              <span className="text-[10px] font-medium" style={textStyle}>
                HR moyenne:
              </span>
              <span className="text-[10px] font-bold ml-auto" style={valueStyle}>
                {averageHumidity.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Density */}
        <div className="pt-1 border-t border-black/5">
          <p className="text-[10px] font-bold text-center" style={valueStyle}>
            ρ: {(airMass / airVolume).toFixed(3)} kg/m³
          </p>
        </div>
      </div>
    </div>
  );
};