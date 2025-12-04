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
// Aligner avec les ticks du SVG: -15°C à x=20, 40°C à x=959.2
const X_AT_MIN = 20;
const X_AT_40 = 959.2;
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

  // Convertir x (coord. SVG) -> Température (°C), via le mapping utilisé dans tempToX
  function xToTemp(x: number): number {
    const t = X_MIN + (x - X_AT_MIN) / X_PER_DEG;
    return t;
  }

  // Ancres extraites des polygones fournis (x extrêmes confort) pour les 3 cas:
  // 14.5°C → [482.6, 662.4] ; 25.5°C → [570.0, 749.7] ; 38.5°C → [672.7, 852.4]
  const comfortAnchors = React.useMemo(() => {
    const cases = [
      { tout: 14.5, xMin: 482.6, xMax: 662.4 },
      { tout: 25.5, xMin: 570.0, xMax: 749.7 },
      { tout: 38.5, xMin: 672.7, xMax: 852.4 },
    ];
    return cases.map(c => ({
      tout: c.tout,
      tMin: xToTemp(c.xMin),
      tMax: xToTemp(c.xMax),
      width: xToTemp(c.xMax) - xToTemp(c.xMin),
    }));
  }, []);

  // Interpoler linéairement entre les ancres selon outdoorTemp
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

  function interpolateComfortBounds(outT: number | undefined): { tMin: number; tMax: number; width: number } | null {
    if (typeof outT !== "number") return null;
    const a0 = comfortAnchors[0], a1 = comfortAnchors[1], a2 = comfortAnchors[2];
    if (outT <= a0.tout) return { tMin: a0.tMin, tMax: a0.tMax, width: a0.width };
    if (outT >= a2.tout) return { tMin: a2.tMin, tMax: a2.tMax, width: a2.width };
    // Interpérer entre segments [a0..a1] ou [a1..a2]
    if (outT <= a1.tout) {
      const t = clamp01((outT - a0.tout) / (a1.tout - a0.tout));
      const tMin = lerp(a0.tMin, a1.tMin, t);
      const tMax = lerp(a0.tMax, a1.tMax, t);
      return { tMin, tMax, width: tMax - tMin };
    } else {
      const t = clamp01((outT - a1.tout) / (a2.tout - a1.tout));
      const tMin = lerp(a1.tMin, a2.tMin, t);
      const tMax = lerp(a1.tMax, a2.tMax, t);
      return { tMin, tMax, width: tMax - tMin };
    }
  }

  const shiftedZones: ZoneDef[] = React.useMemo(() => {
    // Base width du confort (avant ajustement dynamique)
    const baseComfort = ZONES.find(z => z.id === "comfort")!;
    const baseWidth = baseComfort.tMax - baseComfort.tMin;

    const interp = interpolateComfortBounds(outdoorTemp);
    // Extension du confort vers des T plus élevées si la vitesse d’air augmente (≈+3°C par m/s, limité à 1.5 m/s)
    const fanBoost = Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3;

    return ZONES.map((z) => {
      if (z.id === "comfort" && interp) {
        // Appliquer les bornes interpolées + décalage + boost ventilateur
        const tMin = interp.tMin;
        const tMax = interp.tMax + fanBoost;
        return { ...z, tMin, tMax };
      } else {
        // Les autres zones: appliquer le décalage + homogénéiser la largeur via un facteur
        // pour suivre l’élargissement relatif observé sur la zone de confort.
        const widthFactor = interp ? (interp.width / baseWidth) : 1;
        const mid = (z.tMin + z.tMax) / 2;
        const half = (z.tMax - z.tMin) / 2;
        const newHalf = half * widthFactor;
        const tMin = (mid - newHalf) + shift;
        const tMax = (mid + newHalf) + shift;
        return { ...z, tMin, tMax };
      }
    });
  }, [outdoorTemp, airSpeed, shift]);

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

  type OverlayShape = { kind: 'polygon' | 'polyline'; id: string; points: string; fill?: boolean };

  const colorById: Record<string, string> = {
    comfort: "59,130,246",
    "nat-vent": "34,197,94",
    "passive-solar": "245,158,11",
    "active-solar": "251,191,36",
    "evap-cool": "16,185,129",
    "mass-cool": "14,165,233",
    "night-vent": "99,102,241",
    "dehumidif-ac": "168,85,247",
    humidification: "6,182,212",
  };

  const overlayCases: Record<"14.5" | "25.5" | "38.5", OverlayShape[]> = React.useMemo(() => ({
    "14.5": [
      { kind: "polygon", id: "comfort", fill: true, points: "482.6,668.5 504.0,653.2 525.4,637.3 546.8,620.6 568.2,603.0 589.6,584.6 611.0,565.3 662.4,677.1 662.4,839.1 662.4,839.1 636.7,845.5 611.0,851.6 585.4,857.3 559.7,862.8 534.0,867.9 508.3,872.8 482.6,877.4" },
      { kind: "polygon", id: "nat-vent", points: "482.6,598.8 508.3,575.9 534.0,551.6 559.7,525.9 585.4,498.7 611.0,469.9 636.7,439.5 662.4,407.3 790.8,581.8 790.8,800.9 790.8,800.9 765.1,809.4 739.4,817.4 713.8,825.1 688.1,832.3 662.4,839.1 636.7,845.5 611.0,851.6 585.4,857.3 559.7,862.8 534.0,867.9 508.3,872.8 482.6,877.4" },
      { kind: "polyline", id: "passive-solar", points: "572.5,947.0 174.5,947.0 174.5,790.5 174.5,790.5 200.2,779.3 225.8,767.3 251.5,754.6 277.2,741.2 302.9,726.8 328.6,711.6 354.2,695.5 379.9,678.3 405.6,660.2 431.3,640.9 457.0,620.5" },
      { kind: "polyline", id: "active-solar", points: "148.8,947.0 71.8,947.0 71.8,829.0 71.8,829.0 84.6,824.7 97.4,820.3 110.3,815.7 123.1,811.0 136.0,806.1 148.8,801.0" },
      { kind: "polyline", id: "evap-cool", points: "611.0,565.3 893.5,669.4 970.6,726.5 1021.9,823.3 1021.9,947.0 651.9,947.0 482.6,877.4" },
      { kind: "polyline", id: "mass-cool", points: "611.0,565.3 816.5,565.3 919.2,652.6 919.2,877.4 482.6,877.4" },
      { kind: "polyline", id: "night-vent", points: "816.5,565.3 996.2,565.3 1099.0,653.1 1099.0,877.4 482.6,877.4" },
      { kind: "polyline", id: "dehumidif-ac", points: "996.2,565.3 1289.0,565.3 1289.0,947.0 1021.9,947.0" },
    ],
    "25.5": [
      { kind: "polygon", id: "comfort", fill: true, points: "570.0,601.6 591.4,583.1 612.8,563.8 634.2,543.5 645.4,532.4 655.6,532.4 677.0,532.4 698.4,532.4 749.7,615.2 749.7,814.3 749.7,814.3 724.0,822.1 698.4,829.4 672.7,836.4 647.0,843.0 621.3,849.2 595.6,855.1 570.0,860.6" },
      { kind: "polygon", id: "nat-vent", points: "570.0,515.2 595.6,487.4 621.3,458.0 647.0,426.8 672.7,393.9 698.4,359.1 724.0,322.3 749.7,283.4 878.1,500.3 878.1,768.3 878.1,768.3 852.4,778.5 826.8,788.2 801.1,797.4 775.4,806.1 749.7,814.3 724.0,822.1 698.4,829.4 672.7,836.4 647.0,843.0 621.3,849.2 595.6,855.1 570.0,860.6" },
      { kind: "polyline", id: "passive-solar", points: "659.8,947.0 261.8,947.0 261.8,749.4 261.8,749.4 287.5,735.5 313.2,720.9 338.8,705.3 364.5,688.7 390.2,671.2 415.9,652.6 441.6,632.9 467.2,611.9 492.9,589.8 518.6,566.3 544.3,541.5" },
      { kind: "polyline", id: "active-solar", points: "236.1,947.0 159.1,947.0 159.1,796.9 159.1,796.9 171.9,791.6 184.8,786.1 197.6,780.4 210.4,774.6 223.3,768.6 236.1,762.4" },
      { kind: "polyline", id: "evap-cool", points: "698.4,532.4 980.8,608.5 1057.9,678.8 1109.2,796.6 1109.2,947.0 779.9,947.0 570.0,860.6" },
      { kind: "polyline", id: "mass-cool", points: "698.4,532.4 903.8,532.4 1006.5,588.4 1006.5,860.6 570.0,860.6" },
      { kind: "polyline", id: "night-vent", points: "903.8,532.4 1083.6,532.4 1186.3,590.4 1186.3,860.6 570.0,860.6" },
      { kind: "polyline", id: "dehumidif-ac", points: "1083.6,532.4 1289.0,532.4 1289.0,947.0 1109.2,947.0" },
    ],
    "38.5": [
      { kind: "polyline", id: "comfort", fill: true, points: "672.7,532.4 694.1,532.4 715.5,532.4 736.9,532.4 758.3,532.4 779.7,532.4 801.1,532.4 852.4,532.4 852.4,778.5 852.4,778.5 826.8,788.2 801.1,797.4 775.4,806.1 749.7,814.3 724.0,822.1 698.4,829.4 672.7,836.4 672.7,504.5" },
      { kind: "polygon", id: "nat-vent", points: "672.7,393.9 698.4,359.1 724.0,322.3 749.7,283.4 775.4,242.4 801.1,199.0 826.8,153.1 852.4,104.7 980.8,382.9 980.8,721.4 980.8,721.4 955.2,734.1 929.5,746.1 903.8,757.5 878.1,768.3 852.4,778.5 826.8,788.2 801.1,797.4 775.4,806.1 749.7,814.3 724.0,822.1 698.4,829.4 672.7,836.4" },
      { kind: "polyline", id: "passive-solar", points: "762.6,947.0 364.5,947.0 364.5,688.7 364.5,688.7 390.2,671.2 415.9,652.6 441.6,632.9 467.2,611.9 492.9,589.8 518.6,566.3 544.3,541.5 570.0,515.2 595.6,487.4 621.3,458.0 647.0,426.8" },
      { kind: "polyline", id: "active-solar", points: "338.8,947.0 261.8,947.0 261.8,749.4 261.8,749.4 274.6,742.5 287.5,735.5 300.3,728.3 313.2,720.9 326.0,713.2 338.8,705.3" },
      { kind: "polyline", id: "evap-cool", points: "801.1,532.4 1083.6,532.4 1160.6,610.0 1212.0,758.3 1212.0,947.0 941.6,947.0 672.7,836.4" },
      { kind: "polyline", id: "mass-cool", points: "801.1,532.4 1006.5,532.4 1109.2,532.4 1109.2,836.4 672.7,836.4" },
      { kind: "polyline", id: "night-vent", points: "1006.5,532.4 1186.3,532.4 1289.0,532.4 1289.0,836.4 672.7,836.4" },
      { kind: "polyline", id: "dehumidif-ac", points: "1186.3,532.4 1327.5,532.4 1327.5,947.0 1212.0,947.0" },
    ],
  }), []);

  function pickOverlayCase(t?: number): "14.5" | "25.5" | "38.5" {
    if (typeof t !== "number") return "25.5";
    if (t < 20) return "14.5";
    if (t > 32) return "38.5";
    return "25.5";
  }

  const overlayShapes: OverlayShape[] = React.useMemo(
    () => overlayCases[pickOverlayCase(outdoorTemp)],
    [outdoorTemp, overlayCases]
  );

  // Translation horizontale continue des zones selon la température extérieure (shift en °C converti en pixels)
  const dx = React.useMemo(() => shift * X_PER_DEG, [shift]);

  // Pas de re-scaling Y: on rend les polygones dans le repère du SVG et on les clippe sur la zone du graphe.

  // Décalage du repère interne: le SVG template est inséré à x=-15, on compense pour l'overlay
  const OFFSET_X = -15;

  function transformPointsString(points: string, dx: number): string {
    if (!points) return points;
    return points
      .trim()
      .split(/\s+/)
      .map(pair => {
        const [xs, ys] = pair.split(',');
        const x = parseFloat(xs);
        const y = parseFloat(ys);
        const tx = x + OFFSET_X + dx; // translation horizontale + compensation de l'offset du template
        const ty = y;                 // on garde Y tel quel et on clippe visuellement
        return `${tx.toFixed(1)},${ty.toFixed(1)}`;
      })
      .join(' ');
  }

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
        {/* Clip path pour contraindre les overlays à la zone du graphe */}
        <defs>
          <clipPath id="dyad-psychro-clip">
            <rect x={0} y={40} width={960} height={651} />
          </clipPath>
        </defs>


        {/* Zones de Givoni: polygones/polylines transformés et translatés (suivi continu de T ext), clipés à la zone */}
        <g clipPath="url(#dyad-psychro-clip)">
          {overlayShapes.map((s, idx) => {
            const col = colorById[s.id] ?? "59,130,246";
            const stroke = `rgba(${col},0.85)`;
            const fillCol = s.fill ? `rgba(${col},0.2)` : "none";
            const pts = transformPointsString(s.points, dx);

            if (s.kind === "polygon") {
              return (
                <polygon
                  key={`${s.id}-${idx}`}
                  points={pts}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  fill={fillCol}
                />
              );
            }
            return (
              <polyline
                key={`${s.id}-${idx}`}
                points={pts}
                stroke={stroke}
                strokeWidth={3}
                strokeLinejoin="round"
                fill="none"
              />
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