"use client";

import React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/FixedTooltip";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { useSmoothedValue } from "@/hooks/useSmoothedValue";
import { useAppStore } from "@/store/appStore";

type ChartPoint = {
  name: string;
  temperature: number;        // °C
  absoluteHumidity: number;   // g/m³
  color?: string;             // hex color string (e.g. "#34d399")
};

type Props = {
  points: ChartPoint[];
  outdoorTemp?: number | null;
  animationMs?: number;
  airSpeed?: number | null; // vitesse d'air en m/s (0–1.5)
};

// ============================================================================
// CONSTANTES DU DIAGRAMME PSYCHROMÉTRIQUE
// ============================================================================

const X_MIN = -15;
const X_MAX = 40;
const X_AT_MIN = 20;
const X_AT_40 = 880.9;
const X_PER_DEG = (X_AT_40 - X_AT_MIN) / (X_MAX - X_MIN);

const Y_AT_0_GKG = 691;
const Y_PER_GKG = 19.727272727272727;

const R_v = 461.5;
const P_ATM = 101325;

// Constantes pour les zones de Givoni
const SHIFT_REF = 25; // Température de référence pour le décalage
const SHIFT_FACTOR = 0.6; // Facteur de décalage par degré

// ============================================================================
// FONCTIONS DE CONVERSION COORDONNÉES
// ============================================================================

function tempToX(t: number): number {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, t));
  return X_AT_MIN + (clamped - X_MIN) * X_PER_DEG;
}

function gkgToY(wGkg: number): number {
  const clamped = Math.max(0, Math.min(60, wGkg));
  return Y_AT_0_GKG - clamped * Y_PER_GKG;
}

// ============================================================================
// FONCTIONS PSYCHROMÉTRIQUES DE BASE
// ============================================================================

/**
 * Convertit l'humidité absolue (g/m³) en rapport de mélange (g/kg d'air sec)
 * en utilisant la loi des gaz parfaits pour la vapeur d'eau.
 */
function ahGm3ToMixingRatioGkg(
  absoluteHumidityGm3: number,
  temperatureC: number,
  pressurePa: number = P_ATM
): number {
  if (!Number.isFinite(absoluteHumidityGm3) || !Number.isFinite(temperatureC)) return NaN;
  const rho_v = absoluteHumidityGm3 / 1000;
  const T_K = temperatureC + 273.15;
  const P_v = rho_v * R_v * T_K;
  if (P_v <= 0 || P_v >= pressurePa) return NaN;
  const w_kgkg = 0.62198 * P_v / (pressurePa - P_v);
  return w_kgkg * 1000;
}

/**
 * Pression de vapeur saturante (formule de Tetens) en Pa
 */
function saturationVaporPressurePa(temperatureC: number): number {
  return 610.94 * Math.exp((17.625 * temperatureC) / (temperatureC + 243.04));
}

/**
 * Calcule le rapport de mélange (g/kg) à partir de T (°C) et RH (%)
 */
function mixingRatioFromRH(
  temperatureC: number,
  rhPercent: number,
  pressurePa: number = P_ATM
): number {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(rhPercent)) return NaN;
  const es = saturationVaporPressurePa(temperatureC);
  const rh = Math.max(0, Math.min(100, rhPercent)) / 100;
  const Pv = rh * es;
  if (Pv <= 0 || Pv >= pressurePa) return NaN;
  const w_kgkg = 0.62198 * Pv / (pressurePa - Pv);
  return w_kgkg * 1000;
}

/**
 * Calcule l'enthalpie de l'air humide (kJ/kg d'air sec)
 * h = Cp_air * T + w * (Lv + Cp_vapor * T)
 */
function airEnthalpy(temperatureC: number, wGkg: number): number {
  const Cp_air = 1.006; // kJ/(kg·K)
  const Lv = 2501; // kJ/kg (chaleur latente de vaporisation à 0°C)
  const Cp_vapor = 1.86; // kJ/(kg·K)
  const w_kgkg = wGkg / 1000;
  return Cp_air * temperatureC + w_kgkg * (Lv + Cp_vapor * temperatureC);
}

/**
 * Résout w tel que airEnthalpy(T, w) = h_target
 * Utilise une méthode de Newton-Raphson simplifiée
 */
function solveHumidityForEnthalpy(temperatureC: number, h_target: number): number {
  const Cp_air = 1.006;
  const Lv = 2501;
  const Cp_vapor = 1.86;
  
  // Résolution analytique: h = Cp_air * T + w * (Lv + Cp_vapor * T)
  // => w = (h - Cp_air * T) / (Lv + Cp_vapor * T)
  const w_kgkg = (h_target - Cp_air * temperatureC) / (Lv + Cp_vapor * temperatureC);
  const w_gkg = w_kgkg * 1000;
  
  // Vérifier que w est physiquement possible (pas au-delà de la saturation)
  const w_sat = mixingRatioFromRH(temperatureC, 100, P_ATM);
  if (w_gkg > w_sat || w_gkg < 0) return NaN;
  
  return w_gkg;
}

/**
 * Humidité relative maximale de confort en fonction de la température
 * Interpolation linéaire: 80% à 18°C → 60% à 28°C
 */
function rhMaxComfortPercentAtT(tC: number): number {
  if (tC <= 18) return 80;
  if (tC >= 28) return 60;
  return 80 - ((tC - 18) * 2);
}

// ============================================================================
// CALCUL DES ZONES DE GIVONI DYNAMIQUES
// ============================================================================

type ZonePoint = { x: number; y: number };

/**
 * Calcule la zone de confort thermique en fonction de la température extérieure.
 * 
 * Principe physique:
 * - Plage de base: 19-26°C pour T_ext ≈ 20°C
 * - Adaptation physiologique: +0.2°C par °C au-dessus de 20°C extérieur
 * - Limites d'humidité: 20% à 70% RH (avec plafond à 12 g/kg et plancher à 5 g/kg)
 * - Extension possible avec ventilation (airSpeed)
 */
function computeComfortZone(T_ext: number, airSpeed: number = 0): ZonePoint[] {
  // 1. Déterminer les bornes de température de confort
  let T_comfort_min = 19;
  let T_comfort_max = 26;
  
  // Adaptation en climat chaud (décalage de 0.2°C par °C au-dessus de 20°C)
  if (T_ext > 20) {
    const delta = 0.2 * (T_ext - 20);
    T_comfort_min += delta;
    T_comfort_max += delta;
  }
  
  // Extension du confort avec ventilation (≈+3°C par m/s, max 1.5 m/s)
  const fanBoost = Math.min(Math.max(airSpeed, 0), 1.5) * 3;
  T_comfort_max += fanBoost;
  
  // 2. Limites d'humidité absolue pour le confort
  const W_MAX_COMFORT_GKG = 12; // ≃0.012 kg/kg
  const W_MIN_COMFORT_GKG = 5;  // ≃0.005 kg/kg
  
  const points: ZonePoint[] = [];
  const step = 0.5;
  
  // Tracer la limite supérieure (air humide, RH variable selon T)
  for (let T = T_comfort_min; T <= T_comfort_max + 1e-6; T += step) {
    const rhMax = rhMaxComfortPercentAtT(T);
    const wTopRaw = mixingRatioFromRH(T, rhMax, P_ATM);
    const wTop = Math.min(wTopRaw, W_MAX_COMFORT_GKG);
    if (!Number.isFinite(wTop)) continue;
    points.push({ x: tempToX(T), y: gkgToY(wTop) });
  }
  
  // Tracer la limite inférieure (air sec, RH min 20%)
  for (let T = T_comfort_max; T >= T_comfort_min - 1e-6; T -= step) {
    const wBotRaw = mixingRatioFromRH(T, 20, P_ATM);
    const wBot = Math.max(wBotRaw, W_MIN_COMFORT_GKG);
    if (!Number.isFinite(wBot)) continue;
    points.push({ x: tempToX(T), y: gkgToY(wBot) });
  }
  
  return points;
}

/**
 * Calcule la zone de ventilation naturelle.
 * 
 * Principe physique:
 * - Extension jusqu'à +10°C au-dessus du confort en air sec (20% RH)
 * - Gain décroissant linéairement jusqu'à 0°C à 100% RH
 * - L'efficacité du vent diminue avec l'humidité (transpiration moins efficace)
 */
function computeVentilationZone(T_ext: number, T_comfort_max: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  const deltaT_max = 10; // +10°C possible en air sec
  const RH_values = [0.20, 0.40, 0.60, 0.80, 1.0];
  
  // Tracer la limite supérieure de la zone de ventilation
  RH_values.forEach(RH => {
    // Interpolation linéaire du gain en température
    const gain = deltaT_max * (1 - (RH - 0.20) / (1.0 - 0.20));
    const T_limit = T_comfort_max + Math.max(gain, 0);
    const w = mixingRatioFromRH(T_limit, RH * 100, P_ATM);
    if (Number.isFinite(w)) {
      points.push({ x: tempToX(T_limit), y: gkgToY(w) });
    }
  });
  
  // Fermer le polygone en revenant à la zone de confort
  const w_base = mixingRatioFromRH(T_comfort_max, 20, P_ATM);
  if (Number.isFinite(w_base)) {
    points.push({ x: tempToX(T_comfort_max), y: gkgToY(w_base) });
  }
  
  return points;
}

/**
 * Calcule la zone à forte inertie thermique (masse thermique).
 * 
 * Principe physique:
 * - Un bâtiment lourd peut encaisser les pics chauds si la température moyenne reste proche du confort
 * - Extension de +5°C à 50% RH, +2°C à 100% RH
 * - Plus efficace en air moyennement humide
 */
function computeHighMassZone(T_comfort_max: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  const T_gain_mid = 5;
  const T_gain_highRH = 2;
  
  // Point à humidité modérée (50% RH)
  let T_limit = T_comfort_max + T_gain_mid;
  let w = mixingRatioFromRH(T_limit, 50, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_limit), y: gkgToY(w) });
  
  // Point à humidité élevée (100% RH)
  T_limit = T_comfort_max + T_gain_highRH;
  w = mixingRatioFromRH(T_limit, 100, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_limit), y: gkgToY(w) });
  
  // Point côté sec (30% RH, +7°C)
  T_limit = T_comfort_max + 7;
  w = mixingRatioFromRH(T_limit, 30, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_limit), y: gkgToY(w) });
  
  // Fermer vers la zone de confort
  w = mixingRatioFromRH(T_comfort_max, 70, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_comfort_max), y: gkgToY(w) });
  
  return points;
}

/**
 * Calcule la zone inertie + ventilation nocturne.
 * 
 * Principe physique:
 * - En climat chaud et sec, la combinaison inertie + ventilation nocturne permet
 *   de tolérer des journées très chaudes si les nuits sont fraîches
 * - Extension jusqu'à +12°C en air très sec (20% RH)
 * - +5°C à 50% RH
 */
function computeHighMassNightZone(T_comfort_max: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  
  // Point en air très sec (20% RH, +12°C)
  let T_limit = T_comfort_max + 12;
  let w = mixingRatioFromRH(T_limit, 20, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_limit), y: gkgToY(w) });
  
  // Point à humidité moyenne (50% RH, +5°C)
  T_limit = T_comfort_max + 5;
  w = mixingRatioFromRH(T_limit, 50, P_ATM);
  if (Number.isFinite(w)) points.push({ x: tempToX(T_limit), y: gkgToY(w) });
  
  // Connecter à la zone haute inertie
  points.push({ x: tempToX(T_comfort_max + 5), y: gkgToY(mixingRatioFromRH(T_comfort_max + 5, 50, P_ATM)) });
  
  return points;
}

/**
 * Calcule la zone de refroidissement par évaporation.
 * 
 * Principe physique:
 * - Frontière définie par l'enthalpie constante (température humide constante)
 * - Prend le point le plus chaud/humide de la zone de confort comme référence
 * - Au-delà de cette courbe, même saturer l'air ne permet pas d'atteindre le confort
 */
function computeEvapCoolingZone(T_comfort_max: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  
  // Point de référence: limite supérieure de confort (T_max, 70% RH)
  const T_ref = T_comfort_max;
  const RH_ref = 70;
  const w_ref = mixingRatioFromRH(T_ref, RH_ref, P_ATM);
  const h_ref = airEnthalpy(T_ref, w_ref);
  
  // Balayer des températures au-dessus de T_ref
  for (let T = T_ref; T <= 45; T += 1) {
    const w = solveHumidityForEnthalpy(T, h_ref);
    if (Number.isFinite(w) && w >= 0) {
      points.push({ x: tempToX(T), y: gkgToY(w) });
    }
  }
  
  // Fermer vers le point de référence
  if (Number.isFinite(w_ref)) {
    points.push({ x: tempToX(T_ref), y: gkgToY(w_ref) });
  }
  
  return points;
}

/**
 * Calcule la limite de chauffage solaire passif.
 * 
 * Principe physique:
 * - Ligne à ~10°C sous la zone de confort
 * - En-dessous, même le soleil ne suffit pas, il faut un chauffage d'appoint
 */
function computeSolarHeatingLimit(T_comfort_min: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  const T_limit = T_comfort_min - 10;
  
  // Ligne horizontale de T_limit à différentes humidités
  for (let RH = 20; RH <= 100; RH += 20) {
    const w = mixingRatioFromRH(T_limit, RH, P_ATM);
    if (Number.isFinite(w)) {
      points.push({ x: tempToX(T_limit), y: gkgToY(w) });
    }
  }
  
  return points;
}

/**
 * Calcule la limite de chauffage mécanique.
 * 
 * Principe physique:
 * - En-dessous de la limite solaire passive, chauffage actif requis
 */
function computeMechanicalHeatingLimit(T_comfort_min: number): ZonePoint[] {
  const points: ZonePoint[] = [];
  const T_limit = T_comfort_min - 10;
  
  // Ligne verticale le long de la saturation
  for (let T = -15; T <= T_limit; T += 2) {
    const w = mixingRatioFromRH(T, 100, P_ATM);
    if (Number.isFinite(w)) {
      points.push({ x: tempToX(T), y: gkgToY(w) });
    }
  }
  
  return points;
}

/**
 * Calcule la limite de climatisation mécanique.
 * 
 * Principe physique:
 * - Au-delà de la zone évaporative, aucune technique passive ne suffit
 * - Ligne verticale à la température maximale de la zone évaporative
 */
function computeMechanicalCoolingLimit(): ZonePoint[] {
  const points: ZonePoint[] = [];
  const T_limit = 40; // Température limite approximative
  
  // Ligne verticale de la saturation vers le haut
  for (let RH = 60; RH <= 100; RH += 10) {
    const w = mixingRatioFromRH(T_limit, RH, P_ATM);
    if (Number.isFinite(w)) {
      points.push({ x: tempToX(T_limit), y: gkgToY(w) });
    }
  }
  
  return points;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const PsychrometricSvgChart: React.FC<Props> = ({ 
  points, 
  outdoorTemp, 
  animationMs, 
  airSpeed = 0 
}) => {
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
        #chart-psychro .st1,
        #chart-psychro .st2,
        #chart-psychro .st5 {
          stroke: hsl(var(--muted-foreground));
        }
        #chart-psychro .st3,
        #chart-psychro .st4 {
          stroke: hsl(var(--border));
        }
        #chart-psychro .st6,
        #chart-psychro .st7 {
          fill: hsl(var(--muted-foreground));
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
          stroke: hsl(var(--background));
          stroke-width: 0.4;
          paint-order: stroke;
        }
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

  // Calcul des cercles de données
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

  // Température volumétrique moyenne (lissée)
  const volumetricTempRaw = React.useMemo(() => {
    const vol = points.find((p) => p.name.toLowerCase().includes("moyenne volumétrique"));
    return typeof vol?.temperature === "number" ? vol.temperature : null;
  }, [points]);

  const volumetricTemp = useSmoothedValue(volumetricTempRaw, { 
    stiffness: 160, 
    damping: 24, 
    enabled: true 
  });

  // ============================================================================
  // CALCUL DES ZONES DYNAMIQUES DE GIVONI
  // ============================================================================

  const givoniZones = React.useMemo(() => {
    if (typeof outdoorTemp !== "number") return null;
    
    // Calculer la zone de confort (base pour toutes les autres zones)
    const comfortZone = computeComfortZone(outdoorTemp, airSpeed ?? 0);
    
    // Extraire T_comfort_min et T_comfort_max de la zone de confort
    let T_comfort_min = 19;
    let T_comfort_max = 26;
    if (outdoorTemp > 20) {
      const delta = 0.2 * (outdoorTemp - 20);
      T_comfort_min += delta;
      T_comfort_max += delta;
    }
    const fanBoost = Math.min(Math.max(airSpeed ?? 0, 0), 1.5) * 3;
    T_comfort_max += fanBoost;
    
    return {
      comfort: comfortZone,
      ventilation: computeVentilationZone(outdoorTemp, T_comfort_max),
      highMass: computeHighMassZone(T_comfort_max),
      highMassNight: computeHighMassNightZone(T_comfort_max),
      evapCooling: computeEvapCoolingZone(T_comfort_max),
      solarHeating: computeSolarHeatingLimit(T_comfort_min),
      mechHeating: computeMechanicalHeatingLimit(T_comfort_min),
      mechCooling: computeMechanicalCoolingLimit(),
    };
  }, [outdoorTemp, airSpeed]);

  // Fonction utilitaire pour convertir les points en string SVG
  const pointsToString = (pts: ZonePoint[]): string => {
    return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  };

  // Détection des zones actives avec hystérésis
  const ACTIVE_HYST = 0.4;
  const [activeZoneIds, setActiveZoneIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!givoniZones || typeof volumetricTemp !== "number") {
      setActiveZoneIds(new Set());
      return;
    }

    setActiveZoneIds((prev) => {
      const next = new Set(prev);
      
      // Logique simplifiée de détection (à affiner selon les besoins)
      // Pour l'instant, on active "comfort" si la température est dans la plage
      let T_comfort_min = 19;
      let T_comfort_max = 26;
      if (typeof outdoorTemp === "number" && outdoorTemp > 20) {
        const delta = 0.2 * (outdoorTemp - 20);
        T_comfort_min += delta;
        T_comfort_max += delta;
      }
      
      const wasComfortActive = prev.has("comfort");
      if (wasComfortActive) {
        if (volumetricTemp < T_comfort_min - ACTIVE_HYST || volumetricTemp > T_comfort_max + ACTIVE_HYST) {
          next.delete("comfort");
        }
      } else {
        if (volumetricTemp >= T_comfort_min + ACTIVE_HYST && volumetricTemp <= T_comfort_max - ACTIVE_HYST) {
          next.add("comfort");
        }
      }
      
      return next;
    });
  }, [volumetricTemp, givoniZones, outdoorTemp]);

  return (
    <div className="relative w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        {/* Fond du diagramme psychrométrique */}
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

        {/* Fond de la zone du graphique */}
        <rect
          x={0}
          y={40}
          width={960}
          height={651}
          fill="hsl(var(--muted))"
          fillOpacity={isDarkMode ? 0.12 : 0.18}
          style={{ pointerEvents: 'none' }}
        />

        {/* Clip path pour les zones */}
        <defs>
          <clipPath id="dyad-psychro-clip">
            <rect x={0} y={40} width={960} height={651} />
          </clipPath>
        </defs>

        {/* Calque des zones de Givoni dynamiques */}
        {givoniZones && (
          <g id="zones-layer" clipPath="url(#dyad-psychro-clip)">
            {/* Zone de confort (remplie) */}
            <polygon
              points={pointsToString(givoniZones.comfort)}
              fill="rgba(59,130,246,0.22)"
              stroke="rgba(59,130,246,0.88)"
              strokeWidth={3}
              strokeLinejoin="round"
            />

            {/* Zone de ventilation naturelle */}
            <polygon
              points={pointsToString(givoniZones.ventilation)}
              fill="none"
              stroke="rgba(34,197,94,0.85)"
              strokeWidth={3}
              strokeLinejoin="round"
            />

            {/* Zone à forte inertie thermique */}
            <polygon
              points={pointsToString(givoniZones.highMass)}
              fill="none"
              stroke="rgba(14,165,233,0.85)"
              strokeWidth={3}
              strokeLinejoin="round"
            />

            {/* Zone inertie + ventilation nocturne */}
            <polygon
              points={pointsToString(givoniZones.highMassNight)}
              fill="none"
              stroke="rgba(99,102,241,0.85)"
              strokeWidth={3}
              strokeLinejoin="round"
            />

            {/* Zone de refroidissement évaporatif */}
            <polygon
              points={pointsToString(givoniZones.evapCooling)}
              fill="none"
              stroke="rgba(16,185,129,0.85)"
              strokeWidth={3}
              strokeLinejoin="round"
            />

            {/* Limite chauffage solaire passif */}
            <polyline
              points={pointsToString(givoniZones.solarHeating)}
              fill="none"
              stroke="rgba(245,158,11,0.85)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {/* Limite chauffage mécanique */}
            <polyline
              points={pointsToString(givoniZones.mechHeating)}
              fill="none"
              stroke="rgba(251,191,36,0.85)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {/* Limite climatisation mécanique */}
            <polyline
              points={pointsToString(givoniZones.mechCooling)}
              fill="none"
              stroke="rgba(168,85,247,0.85)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Ligne de température extérieure */}
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

        {/* Points de données */}
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

      {/* Tooltips axes */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute left-0 right-0 bottom-0 h-8" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Température du bulbe sec (°C)</p>
          </TooltipContent>
        </Tooltip>

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