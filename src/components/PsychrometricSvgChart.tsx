"use client";

import React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/FixedTooltip";
import { motion } from "framer-motion";
import usePsychroZones from "@/hooks/usePsychroZones";

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

// Saturation vapor pressure over water (Pa) using Tetens formula
function saturationVaporPressurePa(tC: number): number {
  return 610.94 * Math.exp((17.625 * tC) / (tC + 243.04));
}

// Mixing ratio (g/kg) for a given RH% and temperature (°C)
function mixingRatioFromRH(rhPercent: number, tC: number, pressurePa: number = P_ATM): number {
  const rh = Math.max(0, Math.min(100, rhPercent)) / 100;
  const e_s = saturationVaporPressurePa(tC);
  const e = rh * e_s;
  if (e <= 0 || e >= pressurePa) return NaN;
  return 0.62198 * e / (pressurePa - e) * 1000;
}

// Approximate local angle of the RH curve at temperature tC (degrees)
function rhCurveAngleDeg(rhPercent: number, tC: number): number {
  const t1 = tC;
  const t2 = tC + 1; // 1°C step for slope
  const w1 = mixingRatioFromRH(rhPercent, t1);
  const w2 = mixingRatioFromRH(rhPercent, t2);
  if (!Number.isFinite(w1) || !Number.isFinite(w2)) return 0;
  const x1 = tempToX(t1);
  const x2 = tempToX(t2);
  const y1 = gkgToY(w1);
  const y2 = gkgToY(w2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const PsychrometricSvgChart: React.FC<Props> = ({ points, outdoorTemp }) => {
  const { zones } = usePsychroZones(typeof outdoorTemp === "number" ? outdoorTemp : null);

  const circles = points
    .map(p => {
      const wGkg = ahGm3ToMixingRatioGkg(p.absoluteHumidity, p.temperature);
      if (!Number.isFinite(wGkg)) return null;
      return {
        name: p.name,
        temperature: p.temperature,
        absoluteHumidity: p.absoluteHumidity,
        cx: tempToX(p.temperature),
        cy: gkgToY(wGkg),
        color: p.color
      };
    })
    .filter(Boolean) as { name: string; temperature: number; absoluteHumidity: number; cx: number; cy: number; color?: string }[];

  const outdoorX = typeof outdoorTemp === "number" ? tempToX(outdoorTemp) : null;

  // Compute label positions for RH% curves (10% to 100%)
  const RH_LEVELS = [10,20,30,40,50,60,70,80,90,100];
  const rhLabels = RH_LEVELS.map((rh) => {
    // Try several candidate temperatures to place the label inside the visible area
    const candidates = [30, 24, 18, 12, 6, 0, 35];
    for (const tC of candidates) {
      const w = mixingRatioFromRH(rh, tC);
      if (!Number.isFinite(w)) continue;
      const x = tempToX(tC);
      const y = gkgToY(w);
      if (x >= X_AT_MIN - 5 && x <= X_AT_40 + 5 && y >= 40 && y <= 691) {
        const angle = rhCurveAngleDeg(rh, tC);
        return { rh, x, y, angle };
      }
    }
    return null;
  }).filter(Boolean) as { rh: number; x: number; y: number; angle: number }[];

  // Givoni comfort zone (adaptive, driven by outdoor temperature)
  const meanOutdoor = typeof outdoorTemp === "number" ? outdoorTemp : 20; // fallback
  const baseT = Math.max(X_MIN, Math.min(X_MAX - 5, 17.6 + 0.31 * meanOutdoor - 3.5)); // o .. o+5
  const topT = baseT + 5;

  function pointFor(Tc: number, rhPercent: number) {
    const w = mixingRatioFromRH(rhPercent, Tc);
    if (!Number.isFinite(w)) return null;
    return [tempToX(Tc), gkgToY(w)] as [number, number];
  }

  // Bornes RH inspirées de Givoni: RH haute décroît, RH basse croît légèrement
  const RH_UP_LOW = 80; // à T_base
  const RH_UP_HIGH = Math.max(50, RH_UP_LOW - 3 * (topT - baseT)); // ~65% à +5°C
  const RH_LOW_LOW = 20; // à T_base
  const RH_LOW_HIGH = Math.min(40, RH_LOW_LOW + 2 * (topT - baseT)); // ~30% à +5°C

  const gP1 = pointFor(baseT, RH_UP_LOW);
  const gP2 = pointFor(topT, RH_UP_HIGH);
  const gP3 = pointFor(topT, RH_LOW_HIGH);
  const gP4 = pointFor(baseT, RH_LOW_LOW);

  const givoniPts = [gP1, gP2, gP3, gP4].filter(Boolean) as [number, number][];
  const givoniPolygon = givoniPts.length === 4
    ? givoniPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
    : null;
  const givoniLabel = givoniPts.length === 4
    ? { x: (givoniPts[0][0] + givoniPts[1][0] + givoniPts[2][0] + givoniPts[3][0]) / 4,
        y: (givoniPts[0][1] + givoniPts[1][1] + givoniPts[2][1] + givoniPts[3][1]) / 4 }
    : null;

  return (
    <div className="relative w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        <image href="/psychrometric_template.svg" x={-15} y={0} width={1000} height={730} />

        {/* Enveloppe psychrométrique pour clipper les zones (forme exacte) */}
        <defs>
          <clipPath id="psychroClipPath">
            <path fill="black" d="M5.0,671.0 L20.7,669.0 L36.3,666.9 L52.0,664.6 L67.6,662.2 L83.3,659.5 L98.9,656.5 L114.6,653.4 L130.2,649.9 L145.9,646.2 L161.5,642.2 L177.2,637.8 L192.8,633.1 L208.5,628.0 L224.1,622.5 L239.8,616.6 L255.5,610.9 L271.1,605.0 L286.8,598.6 L302.4,591.7 L318.1,584.5 L333.7,576.7 L349.4,568.5 L365.0,559.8 L380.7,550.4 L396.3,540.5 L412.0,530.0 L427.6,518.8 L443.3,507.0 L458.9,494.4 L474.6,481.0 L490.3,466.9 L505.9,451.9 L521.6,435.9 L537.2,419.1 L552.9,401.2 L568.5,382.3 L584.2,362.3 L599.8,341.1 L615.5,318.7 L631.1,295.0 L646.8,270.0 L662.4,243.5 L678.1,215.5 L693.7,185.9 L709.4,154.6 L725.1,121.6 L740.7,86.7 L756.4,49.8 L760.0,40.0 L944.2,40.0 L944.2,691.0 L5.0,691.0 Z"></path>
          </clipPath>
        </defs>

        {/* Library-driven Givoni/comfort zones (exact shapes) */}
        {zones && zones.length > 0 && (
          <g aria-label="Psychrometric comfort zones (library)" clipPath="url(#psychroClipPath)">
            {zones.map((z, idx) => (
              <g key={z.id ?? idx}>
                <polygon
                  points={z.points}
                  fill={z.fill ?? "rgba(59,130,246,0.15)"}
                  stroke={z.stroke ?? "rgba(59,130,246,0.6)"}
                  strokeWidth={1}
                />
                {z.label && z.centroid && (
                  <text
                    x={z.centroid.x}
                    y={z.centroid.y}
                    textAnchor="middle"
                    dy="-0.3em"
                    fontSize={11}
                    fill="hsl(var(--foreground))"
                  >
                    {z.label}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}

        {/* Givoni comfort zone (fallback when library zones aren't available) */}
        {(!zones || zones.length === 0) && givoniPolygon && (
          <g aria-label="Givoni comfort zone" clipPath="url(#psychroClipPath)">
            <polygon
              points={givoniPolygon}
              fill="rgba(34,197,94,0.18)"   /* green-500 with alpha */
              stroke="rgba(34,197,94,0.8)"
              strokeWidth={1}
            />
            {givoniLabel && (
              <text
                x={givoniLabel.x}
                y={givoniLabel.y}
                textAnchor="middle"
                dy="-0.4em"
                fontSize={12}
                fill="hsl(var(--foreground))"
              >
                Zone de confort (Givoni)
              </text>
            )}
          </g>
        )}

        {/* RH% labels overlay */}
        <g aria-label="Relative Humidity labels">
          {rhLabels.map((lbl) => (
            <g key={`rh-${lbl.rh}`}>
              {/* Outline for readability on any background */}
              <text
                x={lbl.x}
                y={lbl.y}
                fontSize={12}
                transform={`rotate(${lbl.angle.toFixed(2)}, ${lbl.x}, ${lbl.y})`}
                fill="hsl(var(--foreground))"
                stroke="hsl(var(--background))"
                strokeWidth={2}
                strokeOpacity={0.85}
                style={{ paintOrder: 'stroke' }}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {lbl.rh}%
              </text>
              {/* Fill on top to sharpen the text */}
              <text
                x={lbl.x}
                y={lbl.y}
                fontSize={12}
                transform={`rotate(${lbl.angle.toFixed(2)}, ${lbl.x}, ${lbl.y})`}
                fill="hsl(var(--foreground))"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {lbl.rh}%
              </text>
            </g>
          ))}
        </g>

        {typeof outdoorX === "number" && (
          <>
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
            <text
              x={outdoorX + 8}
              y={52}
              fontSize={12}
              fill="hsl(var(--primary))"
              style={{ paintOrder: 'stroke' }}
            >
              {typeof outdoorTemp === "number" ? `${outdoorTemp.toFixed(1)}°C` : ''}
            </text>
          </>
        )}

        <g>
          {circles.map((c, i) => {
            const isVolumetric = c.name.toLowerCase().includes("moyenne volumétrique");
            const fillColor = c.color ?? "rgba(16,185,129,0.92)";
            return (
              <TooltipProvider delayDuration={150} key={`${c.name}-${i}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.circle
                      animate={{ cx: c.cx, cy: c.cy }}
                      initial={false}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      r={7}
                      fill={fillColor}
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isVolumetric ? (
                      <div className="text-xs font-medium" style={{ color: fillColor }}>
                        Moyenne volumétrique
                        <div className="text-[11px] opacity-85">
                          {c.temperature.toFixed(1)}°C • {c.absoluteHumidity.toFixed(2)} g/m³
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <span className="font-medium">{c.name}</span>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </g>
      </svg>

      {/* Tooltips axes (overlay discrets) */}
      <TooltipProvider delayDuration={200}>
        {/* Axe X: Température du bulbe sec */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute left-0 right-0 bottom-0 h-8" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Température du bulbe sec (°C)</p>
          </TooltipContent>
        </Tooltip>

        {/* Axe Y (colonne droite des valeurs g/kg) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute right-0 top-10 bottom-0 w-16" />
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