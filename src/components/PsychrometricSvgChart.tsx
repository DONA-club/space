"use client";

import React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/FixedTooltip";

type ChartPoint = {
  name: string;
  temperature: number;        // °C
  absoluteHumidity: number;   // g/m³
  color?: string;             // hex color string (e.g. "#34d399")
};

type Props = {
  points: ChartPoint[];
  outdoorTemp?: number | null;
};

const X_MIN = -15;
const X_MAX = 40;
const X_AT_MIN = 5;
const X_AT_40 = 865.9333333333334;
const X_PER_DEG = (X_AT_40 - X_AT_MIN) / (X_MAX - X_MIN);

const Y_AT_0_GKG = 691;
const Y_PER_GKG = 19.727272727272727;

const R_v = 461.5;
const P_ATM = 101325;

function tempToX(t: number): number {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, t));
  return X_AT_MIN + (clamped - X_MIN) * X_PER_DEG;
}

// AH (g/m³) + T (°C) -> w (g/kg)
function ahGm3ToMixingRatioGkg(absoluteHumidityGm3: number, temperatureC: number, pressurePa: number = P_ATM): number {
  if (!Number.isFinite(absoluteHumidityGm3) || !Number.isFinite(temperatureC)) return NaN;
  const rho_v = absoluteHumidityGm3 / 1000;
  const T_K = temperatureC + 273.15;
  const P_v = rho_v * R_v * T_K;
  if (P_v <= 0 || P_v >= pressurePa) return NaN;
  const w_kgkg = 0.62198 * P_v / (pressurePa - P_v);
  return w_kgkg * 1000;
}

function gkgToY(wGkg: number): number {
  const clamped = Math.max(0, Math.min(60, wGkg));
  return Y_AT_0_GKG - clamped * Y_PER_GKG;
}

const PsychrometricSvgChart: React.FC<Props> = ({ points, outdoorTemp }) => {
  const circles = points
    .map(p => {
      const wGkg = ahGm3ToMixingRatioGkg(p.absoluteHumidity, p.temperature);
      if (!Number.isFinite(wGkg)) return null;
      return {
        name: p.name,
        cx: tempToX(p.temperature),
        cy: gkgToY(wGkg),
        color: p.color
      };
    })
    .filter(Boolean) as { name: string; cx: number; cy: number; color?: string }[];

  const outdoorX = typeof outdoorTemp === "number" ? tempToX(outdoorTemp) : null;

  return (
    <div className="relative w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        <image href="/psychrometric_template.svg" x={-15} y={0} width={1000} height={730} />

        {typeof outdoorX === "number" && (
          <line
            x1={outdoorX}
            y1={40}
            x2={outdoorX}
            y2={691}
            stroke="hsl(var(--primary))"
            strokeOpacity={0.9}
            strokeDasharray="4 3"
            strokeWidth={2}
          />
        )}

        <g>
          {circles.map((c, i) => (
            <circle
              key={`${c.name}-${i}`}
              cx={c.cx}
              cy={c.cy}
              r={6.5}
              fill={c.color ?? "rgba(16,185,129,0.92)"}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            />
          ))}
        </g>
      </svg>

      {/* Tooltips axes (overlay discrets) */}
      <TooltipProvider delayDuration={200}>
        {/* Axe X: Température du bulbe sec */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute left-0 right-0 bottom-0 h-7" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Température du bulbe sec (°C)</p>
          </TooltipContent>
        </Tooltip>

        {/* Axe Y (colonne droite des valeurs g/kg) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute right-0 top-10 bottom-0 w-14" />
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">Humidité Absolue (g/kg)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default PsychrometricSvgChart;