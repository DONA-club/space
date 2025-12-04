"use client";

import React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/FixedTooltip";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { useSmoothedValue } from "@/hooks/useSmoothedValue";

type ChartPoint = {
  name: string;
  temperature: number;        // °C
  absoluteHumidity: number;   // g/m³
  color?: string;             // hex color string (e.g. "#34d399")
};

type Props = {
  points: ChartPoint[];
  outdoorTemp?: number | null;
  animationMs?: number; // durée des transitions des points (ms)
  airSpeed?: number | null; // vitesse d'air en m/s (0–1.5), étend la T max confortable
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

// Saturation vapor pressure (Tetens) in Pa
function saturationVaporPressurePa(temperatureC: number): number {
  // 610.94 Pa * exp(17.625*T / (T + 243.04))
  return 610.94 * Math.exp((17.625 * temperatureC) / (temperatureC + 243.04));
}

// Mixing ratio from RH (%) and T (°C) → g/kg
function mixingRatioFromRH(temperatureC: number, rhPercent: number, pressurePa: number = P_ATM): number {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(rhPercent)) return NaN;
  const es = saturationVaporPressurePa(temperatureC);
  const rh = Math.max(0, Math.min(100, rhPercent)) / 100;
  const Pv = rh * es;
  if (Pv <= 0 || Pv >= pressurePa) return NaN;
  const w_kgkg = 0.62198 * Pv / (pressurePa - Pv);
  return w_kgkg * 1000;
}

// RH max de confort en fonction de la température (≈80% à 18°C → ≈60% à 28°C)
function rhMaxComfortPercentAtT(tC: number): number {
  if (tC <= 18) return 80;
  if (tC >= 28) return 60;
  // interpolation linéaire entre 18 et 28°C
  return 80 - ((tC - 18) * 2); // 2 %RH par °C
}

const PsychrometricSvgChart: React.FC<Props> = ({ points, outdoorTemp, animationMs, airSpeed = 0 }) => {
  const { theme } = useTheme();
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [svgContent, setSvgContent] = React.useState<string | null>(null);
  const durationSec = (animationMs ?? 250) / 1000;

  function injectStyle(svg: string): string {
    const overrideStyle = `
      <style id="theme-overrides">
        /* Traits principaux et secondaires adaptés au thème */
        #chart-psychro .st1,
        #chart-psychro .st2,
        #chart-psychro .st5 {
          stroke: hsl(var(--muted-foreground));
        }

        #chart-psychro .st3,
        #chart-psychro .st4 {
          stroke: hsl(var(--border));
        }

        /* Inscriptions sur les axes : couleur, police + léger halo pour la lisibilité */
        #chart-psychro .st6,
        #chart-psychro .st7 {
          fill: hsl(var(--muted-foreground));
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
          stroke: hsl(var(--background));
          stroke-width: 0.4;
          paint-order: stroke;
        }

        /* Neutraliser le fond interne du SVG: on gère déjà le fond via le rect Tailwind */
        #chart-psychro .st8 {
          fill: none;
        }
      </style>
    `;
    if (svg.includes('</defs>')) {
      return svg.replace('</defs>', `</defs>${overrideStyle}`);
    }
    return svg.replace('</svg>', `${overrideStyle}</svg>`);
  }

  React.useEffect(() => {
    fetch('/psychrometric_template.svg')
      .then((res) => res.text())
      .then((text) => setSvgContent(injectStyle(text)));
  }, [isDarkMode]);

  const circles = React.useMemo(() => {
    return points
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
  }, [points]);

  const outdoorX = typeof outdoorTemp === "number" ? tempToX(outdoorTemp) : null;

  // Température de la moyenne volumétrique (si disponible dans les points)
  const volumetricTempRaw = React.useMemo(() => {
    const vol = points.find((p) => p.name.toLowerCase().includes("moyenne volumétrique"));
    return typeof vol?.temperature === "number" ? vol.temperature : null;
  }, [points]);

  const volumetricTemp = useSmoothedValue(volumetricTempRaw, { stiffness: 160, damping: 24, enabled: true });

  // Zones de Givoni (simplifiées) avec plages de T (°C) et RH (%)
  type ZoneDef = {
    id: string;
    name: string;
    tMin: number;
    tMax: number;
    rhMin: number;
    rhMax: number;
    color: string; // "r,g,b"
    labelOffsetY?: number;
  };

  const ZONES: ZoneDef[] = [
    { id: "comfort", name: "Confort", tMin: 20, tMax: 27, rhMin: 30, rhMax: 70, color: "59,130,246", labelOffsetY: -6 },
    { id: "nat-vent", name: "Ventilation naturelle", tMin: 27, tMax: 32, rhMin: 30, rhMax: 70, color: "34,197,94", labelOffsetY: -6 },
    { id: "passive-solar", name: "Chauffage solaire passif", tMin: 18, tMax: 20, rhMin: 30, rhMax: 70, color: "245,158,11", labelOffsetY: -6 },
    { id: "active-solar", name: "Chauffage solaire actif", tMin: 15, tMax: 18, rhMin: 30, rhMax: 70, color: "251,191,36", labelOffsetY: -6 },
    { id: "evap-cool", name: "Refroidissement évaporatif", tMin: 27, tMax: 35, rhMin: 40, rhMax: 85, color: "16,185,129", labelOffsetY: -6 },
    { id: "mass-cool", name: "Refroidissement inertiel", tMin: 25, tMax: 32, rhMin: 30, rhMax: 60, color: "14,165,233", labelOffsetY: -6 },
    { id: "night-vent", name: "Refroidissement + Ventilation nocturne", tMin: 25, tMax: 32, rhMin: 60, rhMax: 80, color: "99,102,241", labelOffsetY: -6 },
    { id: "dehumidif-ac", name: "Climatisation & déshumidification", tMin: 25, tMax: 40, rhMin: 70, rhMax: 100, color: "168,85,247", labelOffsetY: -6 },
    { id: "humidification", name: "Humidification", tMin: 10, tMax: 20, rhMin: 0, rhMax: 30, color: "6,182,212", labelOffsetY: -6 },
  ];

  // Décalage des zones de Givoni selon la température extérieure moyenne
  // Référence 25°C, facteur 0.6 (même logique que le composant Recharts)
  const SHIFT_REF = 25;
  const SHIFT_FACTOR = 0.6;
  const shift = React.useMemo(() => (
    typeof outdoorTemp === "number" ? (outdoorTemp - SHIFT_REF) * SHIFT_FACTOR : 0
  ), [outdoorTemp]);

  const shiftedZones: ZoneDef[] = React.useMemo(() => ZONES.map((z) => {
    // Extension du confort vers des T plus élevées si la vitesse d’air augmente (≈+3°C par m/s, limité à 1.5 m/s)
    const fanBoost = z.id === "comfort" ? Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3 : 0;
    return {
      ...z,
      tMin: z.tMin + shift,
      tMax: z.tMax + shift + fanBoost,
    };
  }), [shift, airSpeed]);

  function buildZonePolygonPoints(z: ZoneDef): { points: string; labelX: number; labelY: number } {
    const step = 0.5;
    const top: string[] = [];
    const W_MAX_COMFORT_GKG = 12; // ≃0.012 kg/kg
    const W_MIN_COMFORT_GKG = 5;  // ≃0.005 kg/kg

    for (let t = z.tMin; t <= z.tMax + 1e-6; t += step) {
      // RH max variable pour la zone de confort, sinon RH max fixe de la zone
      const rhMax = z.id === "comfort" ? rhMaxComfortPercentAtT(t) : z.rhMax;
      const wTopRaw = mixingRatioFromRH(t, rhMax, P_ATM);
      const wTop = z.id === "comfort" ? Math.min(wTopRaw, W_MAX_COMFORT_GKG) : wTopRaw;
      if (!Number.isFinite(wTop)) continue;
      top.push(`${tempToX(t)},${gkgToY(wTop)}`);
    }

    const bottom: string[] = [];
    for (let t = z.tMax; t >= z.tMin - 1e-6; t -= step) {
      // RH min fixe pour la plupart des zones; pour “Confort” appliquer plancher W
      const wBotRaw = mixingRatioFromRH(t, z.rhMin, P_ATM);
      const wBot = z.id === "comfort" ? Math.max(wBotRaw, W_MIN_COMFORT_GKG) : wBotRaw;
      if (!Number.isFinite(wBot)) continue;
      bottom.push(`${tempToX(t)},${gkgToY(wBot)}`);
    }

    const points = [...top, ...bottom].join(" ");

    // Label au centre (utilise RH mid moyenne pour le positionner)
    const tMid = (z.tMin + z.tMax) / 2;
    const rhMid = (z.rhMin + z.rhMax) / 2;
    const wMidRaw = mixingRatioFromRH(tMid, rhMid, P_ATM);
    const wMid = z.id === "comfort"
      ? Math.max(Math.min(wMidRaw, W_MAX_COMFORT_GKG), W_MIN_COMFORT_GKG)
      : wMidRaw;
    const labelX = tempToX(tMid);
    const labelY = Number.isFinite(wMid) ? gkgToY(wMid) + (z.labelOffsetY ?? 0) : 120;

    return { points, labelX, labelY };
  }

  const computedZones = React.useMemo(() => shiftedZones.map((z) => {
    const poly = buildZonePolygonPoints(z);
    return { ...z, ...poly };
  }), [shiftedZones]);

  // Hystérésis pour éviter les bascules rapides (clignotements) aux bords des zones
  const ACTIVE_HYST = 0.4; // marge en °C
  const [activeZoneIds, setActiveZoneIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setActiveZoneIds((prev) => {
      const next = new Set(prev);
      if (typeof volumetricTemp !== "number") {
        next.clear();
        return next;
      }
      shiftedZones.forEach((z) => {
        const wasActive = prev.has(z.id);
        if (wasActive) {
          // Ne désactiver qu'en sortant vraiment de la zone (avec marge)
          if (volumetricTemp < z.tMin - ACTIVE_HYST || volumetricTemp > z.tMax + ACTIVE_HYST) {
            next.delete(z.id);
          }
        } else {
          // N'activer qu'après être bien entré dans la zone (avec marge)
          if (volumetricTemp >= z.tMin + ACTIVE_HYST && volumetricTemp <= z.tMax - ACTIVE_HYST) {
            next.add(z.id);
          }
        }
      });
      return next;
    });
  }, [volumetricTemp, shiftedZones]);

  return (
    <div className="relative w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        {svgContent ? (
          <svg
            x={-15}
            y={0}
            width={1000}
            height={730}
            viewBox="0 0 1000 730"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <image
            href="/psychrometric_template.svg"
            x={-15}
            y={0}
            width={1000}
            height={730}
            style={{
              filter: isDarkMode ? "brightness(1.15) contrast(1.2)" : "none",
              opacity: 1
            }}
          />
        )}
        {/* Fond de la zone du graphique (adaptatif au thème) */}
        <rect
          x={0}
          y={40}
          width={960}
          height={651}
          fill="hsl(var(--muted))"
          fillOpacity={isDarkMode ? 0.12 : 0.18}
          style={{ pointerEvents: 'none' }}
        />


        {/* Zones de Givoni pilotées par la température extérieure */}
        <g>
          {computedZones.map((z) => {
            if (!z.points || z.points.length === 0) return null;
            const isActive = activeZoneIds.has(z.id);
            const fillOpacity = isActive ? 0.18 : 0.06;
            const strokeOpacity = isActive ? 0.9 : 0.35;
            const strokeWidth = isActive ? 1.8 : 1;

            return (
              <g key={z.id}>
                <polygon
                  points={z.points}
                  fill={`rgba(${z.color},${fillOpacity})`}
                  stroke={`rgba(${z.color},${strokeOpacity})`}
                  strokeWidth={strokeWidth}
                />
                <text
                  x={z.labelX}
                  y={z.labelY}
                  fontSize={10}
                  textAnchor="middle"
                  fill={`rgba(${z.color},${isActive ? 0.95 : 0.55})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {z.name}
                </text>
              </g>
            );
          })}
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
            const isOutdoor = c.name.toLowerCase().includes("ext");
            const fillColor = c.color ?? (isOutdoor ? "rgba(59,130,246,0.95)" : "rgba(16,185,129,0.92)");
            return (
              <TooltipProvider delayDuration={150} key={`${c.name}-${i}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.circle
                      animate={{ cx: c.cx, cy: c.cy }}
                      initial={false}
                      transition={{ duration: durationSec, ease: "easeInOut" }}
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