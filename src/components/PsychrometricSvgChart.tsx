"use client";

import React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { useSmoothedValue } from "@/hooks/useSmoothedValue";
import { useAppStore } from "@/store/appStore";
import { interpolateAdjust } from "@/utils/psychroAdjust";

const DEBUG_ENABLED = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

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
// Aligner avec les ticks du SVG: -15°C à x=20, 40°C à x=880.9
const X_AT_MIN = 20;
const X_AT_40 = 880.9;
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

const AnimatedCircle: React.FC<{ cx: number; cy: number; r: number; fill: string; stroke: string; strokeWidth: number; durationSec: number }> = (props) => {
  const [motionModule, setMotionModule] = React.useState<any>(null);
  const noMotion = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debugNoMotion");

  React.useEffect(() => {
    let mounted = true;
    if (noMotion) return;
    import("framer-motion")
      .then((mod) => {
        if (mounted) setMotionModule(mod.motion);
      })
      .catch((err) => {
        console.error("[PsychroSvg] Failed to load framer-motion module", err);
      });
    return () => {
      mounted = false;
    };
  }, [noMotion]);

  if (!motionModule) {
    return (
      <circle
        cx={props.cx}
        cy={props.cy}
        r={props.r}
        fill={props.fill}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
      />
    );
  }

  const Motion = motionModule;
  return (
    <Motion.circle
      animate={{ cx: props.cx, cy: props.cy }}
      initial={false}
      transition={{ duration: props.durationSec, ease: "easeInOut" }}
      r={props.r}
      fill={props.fill}
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
    />
  );
};

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
  // Abonnement aux réglages d'ajustement pour provoquer un re-render quand les sliders changent
  const psychroAdjust = useAppStore((s) => s.psychroAdjust);

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
    if (DEBUG_ENABLED) {
      console.groupCollapsed("[PsychroSvg] circles from points");
      console.debug("points.length", points.length);
      console.debug("first point", points[0]);
      console.groupEnd();
    }
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

  React.useEffect(() => {
    if (DEBUG_ENABLED) {
      console.groupCollapsed("[PsychroSvg] volumetric temperature");
      console.debug("volumetricTempRaw", volumetricTempRaw);
      console.debug("volumetricTemp (smoothed)", volumetricTemp);
      console.groupEnd();
    }
  }, [volumetricTempRaw, volumetricTemp]);

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
    const baseComfort = ZONES.find(z => z.id === "comfort")!;
    const fanBoost = Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3;

    // Ajustement combiné (calibrations + sliders)
    const baseAdj = interpolateAdjust(typeof outdoorTemp === "number" ? outdoorTemp : undefined);
    const userAdj = psychroAdjust;
    const adj = {
      xShiftDeg: (baseAdj.xShiftDeg ?? 0) + (userAdj.xShiftDeg ?? 0),
      widthScale: (baseAdj.widthScale ?? 1) * (userAdj.widthScale ?? 1),
      heightScale: (baseAdj.heightScale ?? 1) * (userAdj.heightScale ?? 1),
      zoomScale: (baseAdj.zoomScale ?? 1) * (userAdj.zoomScale ?? 1),
      yOffsetPx: (baseAdj.yOffsetPx ?? 0) + (userAdj.yOffsetPx ?? 0),
      curvatureGain: (baseAdj.curvatureGain ?? 0) + (userAdj.curvatureGain ?? 0),
    };

    const T_PIVOT = 25.5;

    const result = ZONES.map((z) => {
      const mid = (z.tMin + z.tMax) / 2;
      const half = (z.tMax - z.tMin) / 2;

      // Élargissement/rétrécissement autour du pivot puis déplacement horizontal
      const scaledMin = T_PIVOT + (z.tMin - T_PIVOT) * (adj.widthScale > 0 ? adj.widthScale : 1) * (adj.zoomScale > 0 ? adj.zoomScale : 1);
      const scaledMax = T_PIVOT + (z.tMax - T_PIVOT) * (adj.widthScale > 0 ? adj.widthScale : 1) * (adj.zoomScale > 0 ? adj.zoomScale : 1);

      let tMin = scaledMin + (Number.isFinite(adj.xShiftDeg) ? adj.xShiftDeg : 0);
      let tMax = scaledMax + (Number.isFinite(adj.xShiftDeg) ? adj.xShiftDeg : 0);

      // Boost ventilateur seulement pour la zone Confort
      if (z.id === "comfort") {
        tMax += fanBoost;
      }

      return { ...z, tMin, tMax };
    });

    if (DEBUG_ENABLED) {
      const comfort = result.find((z) => z.id === "comfort");
      console.groupCollapsed("[PsychroSvg] shiftedZones");
      console.debug("outdoorTemp", outdoorTemp, "fanBoost", fanBoost);
      console.debug("adj", adj);
      console.debug("comfort range", comfort?.tMin, "→", comfort?.tMax);
      console.groupEnd();
    }

    return result;
  }, [outdoorTemp, airSpeed, psychroAdjust]);

  function buildZonePolygonPoints(z: ZoneDef): { points: string; labelX: number; labelY: number } {
    const step = 0.5;
    const top: string[] = [];
    const W_MAX_COMFORT_GKG = 12;
    const W_MIN_COMFORT_GKG = 5;

    // Ajustement combiné: calibrations (en fonction de T ext) + sliders (psychroAdjust)
    const baseAdj = interpolateAdjust(typeof outdoorTemp === "number" ? outdoorTemp : undefined);
    const userAdj = psychroAdjust;
    const adj = {
      xShiftDeg: (baseAdj.xShiftDeg ?? 0) + (userAdj.xShiftDeg ?? 0),
      widthScale: (baseAdj.widthScale ?? 1) * (userAdj.widthScale ?? 1),
      heightScale: (baseAdj.heightScale ?? 1) * (userAdj.heightScale ?? 1),
      zoomScale: (baseAdj.zoomScale ?? 1) * (userAdj.zoomScale ?? 1),
      yOffsetPx: (baseAdj.yOffsetPx ?? 0) + (userAdj.yOffsetPx ?? 0),
      curvatureGain: (baseAdj.curvatureGain ?? 0) + (userAdj.curvatureGain ?? 0),
    };

    const T_PIVOT = 25.5;
    const W_PIVOT = 8.5;

    function curvatureOffsetPxAtTemp(t: number): number {
      const yA = gkgToY(mixingRatioFromRH(t - 0.5, 100, P_ATM));
      const yB = gkgToY(mixingRatioFromRH(t + 0.5, 100, P_ATM));
      const slope = Math.abs(yB - yA);
      const base = 3;
      const max = 7;
      const gain = Number.isFinite(adj.curvatureGain) ? adj.curvatureGain : 0;
      return -Math.min(max, base + gain * slope);
    }

    // Parcours des T avec zoom horizontal déjà pris en compte dans shiftedZones (éviter double-zoom X)
    for (let t = z.tMin; t <= z.tMax + 1e-6; t += step) {
      const rhMax = z.id === "comfort" ? rhMaxComfortPercentAtT(t) : z.rhMax;
      const wTopRaw = mixingRatioFromRH(t, rhMax, P_ATM);
      const wScaled = W_PIVOT + (wTopRaw - W_PIVOT) * (adj.heightScale > 0 ? adj.heightScale : 1) * (adj.zoomScale > 0 ? adj.zoomScale : 1);
      const wTop = z.id === "comfort" ? Math.min(wScaled, W_MAX_COMFORT_GKG) : wScaled;
      if (!Number.isFinite(wTop)) continue;

      const x = tempToX(t);
      const y = gkgToY(wTop) + curvatureOffsetPxAtTemp(t) + (Number.isFinite(adj.yOffsetPx) ? adj.yOffsetPx : 0);
      top.push(`${x},${y}`);
    }

    const bottom: string[] = [];
    for (let t = z.tMax; t >= z.tMin - 1e-6; t -= step) {
      const wBotRaw = mixingRatioFromRH(t, z.rhMin, P_ATM);
      const wScaled = W_PIVOT + (wBotRaw - W_PIVOT) * (adj.heightScale > 0 ? adj.heightScale : 1) * (adj.zoomScale > 0 ? adj.zoomScale : 1);
      const wBot = z.id === "comfort" ? Math.max(wScaled, W_MIN_COMFORT_GKG) : wScaled;
      if (!Number.isFinite(wBot)) continue;

      const x = tempToX(t);
      const y = gkgToY(wBot) + curvatureOffsetPxAtTemp(t) + (Number.isFinite(adj.yOffsetPx) ? adj.yOffsetPx : 0);
      bottom.push(`${x},${y}`);
    }

    const points = [...top, ...bottom].join(" ");
    const tMid = (z.tMin + z.tMax) / 2;
    const rhMid = (z.rhMin + z.rhMax) / 2;
    const wMidRaw = mixingRatioFromRH(tMid, rhMid, P_ATM);
    const wMidScaled = W_PIVOT + (wMidRaw - W_PIVOT) * (adj.heightScale > 0 ? adj.heightScale : 1) * (adj.zoomScale > 0 ? adj.zoomScale : 1);
    const wMid = z.id === "comfort" ? Math.max(Math.min(wMidScaled, W_MAX_COMFORT_GKG), W_MIN_COMFORT_GKG) : wMidScaled;

    const labelX = tempToX(tMid);
    const labelY = Number.isFinite(wMid)
      ? gkgToY(wMid) + curvatureOffsetPxAtTemp(tMid) + (z.labelOffsetY ?? 0)
      : 120;

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

  // Zones exactes fournies par l'utilisateur (dans son repère x:-15..45°C, y:0..33 g/kg)
  const overlayShapes: OverlayShape[] = [
    // Confort (rempli)
    { kind: "polygon", id: "comfort", fill: true, points: "531.6,580.6 543.5,561.1 555.4,540.5 567.2,519.0 573.4,507.2 579.1,507.2 590.9,507.2 602.8,507.2 631.3,595.1 631.3,806.2 631.3,806.2 617.0,814.5 602.8,822.3 588.6,829.7 574.3,836.7 560.1,843.3 545.9,849.5 531.6,855.4" },
    // Ventilation naturelle
    { kind: "polygon", id: "nat-vent", points: "531.6,489.0 545.9,459.5 560.1,428.3 574.3,395.3 588.6,360.4 602.8,323.5 617.0,284.5 631.3,243.2 702.4,473.2 702.4,757.5 702.4,757.5 688.2,768.3 674.0,778.6 659.7,788.3 645.5,797.5 631.3,806.2 617.0,814.5 602.8,822.3 588.6,829.7 574.3,836.7 560.1,843.3 545.9,849.5 531.6,855.4" },
    // Chauffage solaire passif
    { kind: "polyline", id: "passive-solar", points: "581.4,947.0 360.8,947.0 360.8,737.4 360.8,737.4 375.1,722.7 389.3,707.2 403.5,690.6 417.8,673.1 432.0,654.5 446.2,634.7 460.5,613.8 474.7,591.6 488.9,568.2 503.2,543.3 517.4,516.9" },
    // Chauffage solaire actif
    { kind: "polyline", id: "active-solar", points: "346.6,947.0 303.9,947.0 303.9,787.8 303.9,787.8 311.0,782.2 318.1,776.3 325.3,770.3 332.4,764.1 339.5,757.8 346.6,751.2" },
    // Refroidissement évaporatif
    { kind: "polyline", id: "evap-cool", points: "602.8,507.2 759.4,588.0 802.1,662.5 830.5,787.5 830.5,947.0 648.0,947.0 531.6,855.4" },
    // Refroidissement inertiel (mass cooling)
    { kind: "polyline", id: "mass-cool", points: "602.8,507.2 716.7,507.2 773.6,566.7 773.6,855.4 531.6,855.4" },
    // Refroidissement + ventilation nocturne
    { kind: "polyline", id: "night-vent", points: "716.7,507.2 816.3,507.2 873.2,568.8 873.2,855.4 531.6,855.4" },
    // Climatisation & déshumidification
    { kind: "polyline", id: "dehumidif-ac", points: "816.3,507.2 894.6,507.2 894.6,947.0 830.5,947.0" },
  ];

  function pickOverlayCase(t?: number): "14.5" | "25.5" | "38.5" {
    if (typeof t !== "number") return "25.5";
    if (t < 20) return "14.5";
    if (t > 32) return "38.5";
    return "25.5";
  }

  // Ajustements calibrés déplacés vers utilitaire: src/utils/psychroAdjust.ts

  // Calibrations déplacées vers utilitaire: src/utils/psychroAdjust.ts

  // interpolateAdjust importé depuis utilitaire: src/utils/psychroAdjust.ts

  // Transformation dédiée pour le calque figé: utilise ancre o(T_out) + paramètres calibrés
  function transformOverlayCalibrated(points: string, zoneId?: string): string {
    if (!points) return points;

    if (DEBUG_ENABLED) {
      console.groupCollapsed("[PsychroSvg] transformOverlayCalibrated");
      console.debug("zoneId", zoneId);
      console.debug("outdoorTemp", outdoorTemp);
      console.groupEnd();
    }

    const adj = interpolateAdjust(typeof outdoorTemp === "number" ? outdoorTemp : undefined);

    // Repère source (template SVG fourni)
    const SRC_X_MIN = 5;
    const SRC_X_MAX = 859;
    const SRC_Y_BOTTOM = 947;
    const SRC_Y_TOP = 40;
    const SRC_W_MAX = 33;

    // Ancre horizontale dépendante de la T extérieure (d’après ton code)
    function anchorT(tOut?: number): number {
      const tRef = 25.5;
      const base = 17.6 + 0.31 * tRef - 3.5; // o0 à 25.5°C
      if (typeof tOut !== "number") return base;
      return 17.6 + 0.31 * tOut - 3.5;
    }
    const o = anchorT(typeof outdoorTemp === "number" ? outdoorTemp : undefined);
    const o0 = anchorT(25.5);
    const anchorDelta = o - o0;

    // Correction verticale dynamique liée à la courbure 100% RH (contrôlée par le gain calibré)
    function curvatureOffsetPxAtTemp(t: number): number {
      const yA = gkgToY(mixingRatioFromRH(t - 0.5, 100, P_ATM));
      const yB = gkgToY(mixingRatioFromRH(t + 0.5, 100, P_ATM));
      const slope = Math.abs(yB - yA);
      const base = 3;
      const gain = Number.isFinite(adj.curvatureGain) ? adj.curvatureGain : 0;
      const max = 7;
      return -Math.min(max, base + gain * slope);
    }

    const T_PIVOT = 25.5;

    // Extension du confort si ventilateur (≈+3°C par m/s, max 1.5 m/s)
    const fanBoost = zoneId === "comfort" ? Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3 : 0;

    return points
      .trim()
      .split(/\s+/)
      .map(pair => {
        const [xs, ys] = pair.split(',');
        const x = parseFloat(xs);
        const y = parseFloat(ys);

        // Température en °C dans le repère source
        const xClamped = Math.max(SRC_X_MIN, Math.min(SRC_X_MAX, x));
        const tC = -15 + ((xClamped - SRC_X_MIN) * 60) / (SRC_X_MAX - SRC_X_MIN);

        // Humidité absolue en g/kg dans le repère source
        const yClamped = Math.max(SRC_Y_TOP, Math.min(SRC_Y_BOTTOM, y));
        const wGkg = ((SRC_Y_BOTTOM - yClamped) / (SRC_Y_BOTTOM - SRC_Y_TOP)) * SRC_W_MAX;
        const wGkgAdj = wGkg * ((Number.isFinite(adj.heightScale) && adj.heightScale > 0) ? adj.heightScale : 1);

        // Déformation/translation sur la température:
        // - élargissement/rétrécissement autour du pivot
        // - déplacement par ancreDelta lié à T extérieure (o(T_out))
        // - décalage manuel xShift + boost ventilateur dans la zone confort
        const widthFactor = (Number.isFinite(adj.widthScale) && adj.widthScale > 0) ? adj.widthScale : 1;
        const tCAdjBase = T_PIVOT + (tC - T_PIVOT) * widthFactor;
        const tCAdj = tCAdjBase + anchorDelta + (Number.isFinite(adj.xShiftDeg) ? adj.xShiftDeg : 0) + fanBoost;

        // Zoom uniforme autour des pivots (température et humidité)
        const z = (Number.isFinite(adj.zoomScale) && adj.zoomScale > 0) ? adj.zoomScale : 1;
        const W_PIVOT = 8.5; // g/kg
        const tZoomed = T_PIVOT + (tCAdj - T_PIVOT) * z;
        const wZoomed = W_PIVOT + (wGkgAdj - W_PIVOT) * z;

        // Conversion vers notre SVG courant
        const tx = tempToX(tZoomed);
        const yOffsetDyn = curvatureOffsetPxAtTemp(tZoomed);
        const extraY = Number.isFinite(adj.yOffsetPx) ? adj.yOffsetPx : 0;
        const ty = gkgToY(wZoomed) + yOffsetDyn + extraY;

        return `${tx.toFixed(1)},${ty.toFixed(1)}`;
      })
      .join(' ');
  }

  // Polygones dynamiques des zones (désactivés pour stabilité; on utilise le calque figé calibré)
  type ZonePoly = { id: string; points: string; labelX: number; labelY: number; fill: boolean };
  const zonePolys: ZonePoly[] = React.useMemo(() => [], []);

  // Translation horizontale continue des zones selon la température extérieure (shift en °C converti en pixels)
  const dx = React.useMemo(() => shift * X_PER_DEG, [shift]);

  // Pas de re-scaling Y: on rend les polygones dans le repère du SVG et on les clippe sur la zone du graphe.

  // Décalage du repère interne: le SVG template est inséré à x=-15, on compense pour l'overlay
  const OFFSET_X = -15;

  // Transformer les points depuis le repère fourni (x:-15..45°C, y:0..33 g/kg) vers notre graphe,
  // en appliquant un léger offset vertical et une déformation/translation liées à la T extérieure.
  function transformOverlayPoints(points: string, zoneId?: string): string {
    if (!points) return points;

    // Réglages utilisateurs (panneau sliders)
    const { xShiftDeg, widthScale, yOffsetPx, curvatureGain, heightScale, zoomScale } = psychroAdjust;

    // Repère source (ton chart)
    const SRC_X_MIN = 5;
    const SRC_X_MAX = 859;
    const SRC_Y_BOTTOM = 947;
    const SRC_Y_TOP = 40;
    const SRC_W_MAX = 33;

    // Correction verticale dynamique pour coller à la courbure (référence 100% RH)
    function curvatureOffsetPxAtTemp(t: number): number {
      const yA = gkgToY(mixingRatioFromRH(t - 0.5, 100, P_ATM));
      const yB = gkgToY(mixingRatioFromRH(t + 0.5, 100, P_ATM));
      const slope = Math.abs(yB - yA); // pente locale (px par °C)
      const base = 3;       // correction minimale
      const gain = Number.isFinite(curvatureGain) ? curvatureGain : 0.7; // amplification liée à la pente (via slider)
      const max = 7;        // limite supérieure
      return -Math.min(max, base + gain * slope);
    }

    // Déplacement horizontal en fonction de la T extérieure + ajustement manuel
    const tShiftBase = typeof outdoorTemp === "number" ? (outdoorTemp - SHIFT_REF) * SHIFT_FACTOR : 0;
    const tShift = tShiftBase + (Number.isFinite(xShiftDeg) ? xShiftDeg : 0);

    // Déformation horizontale (élargissement/rétrécissement) autour d’un pivot
    const T_PIVOT = 25.5;
    const baseComfort = ZONES.find(z => z.id === "comfort")!;
    const baseWidth = baseComfort.tMax - baseComfort.tMin;
    const interp = interpolateComfortBounds(outdoorTemp);
    const widthFactorBase = interp ? (interp.width / baseWidth) : 1;
    const widthFactor = widthFactorBase * (Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1);

    // Extension de confort si ventilateur (≈+3°C par m/s, max 1.5 m/s)
    const fanBoost = zoneId === "comfort" ? Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3 : 0;

    return points
      .trim()
      .split(/\s+/)
      .map(pair => {
        const [xs, ys] = pair.split(',');
        const x = parseFloat(xs);
        const y = parseFloat(ys);

        // Température en °C dans le repère source
        const xClamped = Math.max(SRC_X_MIN, Math.min(SRC_X_MAX, x));
        const tC = -15 + ((xClamped - SRC_X_MIN) * 60) / (SRC_X_MAX - SRC_X_MIN);

        // Humidité absolue en g/kg dans le repère source
        const yClamped = Math.max(SRC_Y_TOP, Math.min(SRC_Y_BOTTOM, y));
        const wGkg = ((SRC_Y_BOTTOM - yClamped) / (SRC_Y_BOTTOM - SRC_Y_TOP)) * SRC_W_MAX;
        const wGkgAdj = wGkg * ((Number.isFinite(heightScale) && heightScale > 0) ? heightScale : 1);

        // Appliquer déformation/translation sur la température
        const tCAdj = T_PIVOT + (tC - T_PIVOT) * widthFactor + tShift + fanBoost;

        // Zoom uniforme autour des pivots (température et humidité)
        const z = (Number.isFinite(zoomScale) && zoomScale > 0) ? zoomScale : 1;
        const W_PIVOT = 8.5; // g/kg
        const tZoomed = T_PIVOT + (tCAdj - T_PIVOT) * z;
        const wZoomed = W_PIVOT + (wGkgAdj - W_PIVOT) * z;

        // Conversion vers notre SVG courant
        const tx = tempToX(tZoomed);
        const yOffsetDyn = curvatureOffsetPxAtTemp(tZoomed);
        const extraY = Number.isFinite(yOffsetPx) ? yOffsetPx : 0;
        const ty = gkgToY(wZoomed) + yOffsetDyn + extraY;

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


        {/* Calque figé (overlays fournis) transformé avec l’ancre et tes calibrations */}
        <g clipPath="url(#dyad-psychro-clip)">
          {overlayShapes.map((s, idx) => {
            const col = colorById[s.id] ?? "59,130,246";
            const stroke = `rgba(${col},0.9)`;
            const fillCol = s.fill ? `rgba(${col},0.22)` : "none";
            const ptsFixed = transformOverlayCalibrated(s.points, s.id);

            if (s.kind === "polygon") {
              return (
                <polygon
                  key={`fixed-${s.id}-${idx}`}
                  points={ptsFixed}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  fill={fillCol}
                />
              );
            }

            return (
              <polyline
                key={`fixed-${s.id}-${idx}`}
                points={ptsFixed}
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
                    <AnimatedCircle
                      cx={c.cx}
                      cy={c.cy}
                      r={7}
                      fill={fillColor}
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      durationSec={durationSec}
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