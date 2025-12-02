"use client";

import React from "react";

type ChartPoint = {
  name: string;
  temperature: number;        // °C
  absoluteHumidity: number;   // g/m³ (entrée depuis nos données CSV/DB)
};

type Props = {
  points: ChartPoint[];
  outdoorTemp?: number | null;
};

// Repère X (Température sèche en °C)
const X_MIN = -15;
const X_MAX = 40;
const X_AT_MIN = 5;                 // -15°C est à x=5 dans le SVG
const X_AT_40 = 865.9333333333334;  // 40°C est à x≈865.93
const X_PER_DEG = (X_AT_40 - X_AT_MIN) / (X_MAX - X_MIN); // ≈ 15.6533 px/°C

// Repère Y (Humidité absolue en g/kg)
const Y_AT_0_GKG = 691;                 // 0 g/kg est à y=691
const Y_PER_GKG = 19.727272727272727;   // ≈ 19.7273 px par 1 g/kg (espacement des lignes horizontales)

// Constantes physiques
const R_v = 461.5;         // J/(kg·K) - constante spécifique de la vapeur d'eau
const P_ATM = 101325;      // Pa - pression atmosphérique par défaut

function tempToX(t: number): number {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, t));
  return X_AT_MIN + (clamped - X_MIN) * X_PER_DEG;
}

// Convertit AH (g/m³) + T (°C) → rapport de mélange w (g/kg)
// Étapes :
// 1) AH_gm3 → ρ_v (kg/m³)
// 2) P_v = ρ_v * R_v * T_K
// 3) w (kg/kg) = 0.62198 * P_v / (P - P_v) → g/kg
function ahGm3ToMixingRatioGkg(absoluteHumidityGm3: number, temperatureC: number, pressurePa: number = P_ATM): number {
  if (!Number.isFinite(absoluteHumidityGm3) || !Number.isFinite(temperatureC)) return NaN;
  const rho_v = absoluteHumidityGm3 / 1000;           // kg/m³
  const T_K = temperatureC + 273.15;                  // K
  const P_v = rho_v * R_v * T_K;                      // Pa
  if (P_v <= 0 || P_v >= pressurePa) return NaN;      // éviter divisions invalides
  const w_kgkg = 0.62198 * P_v / (pressurePa - P_v);  // kg/kg
  return w_kgkg * 1000;                               // g/kg
}

function gkgToY(wGkg: number): number {
  const clamped = Math.max(0, Math.min(60, wGkg)); // le diagramme supporte jusqu’à ~60 g/kg en haut
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
      };
    })
    .filter(Boolean) as { name: string; cx: number; cy: number }[];

  const outdoorX = typeof outdoorTemp === "number" ? tempToX(outdoorTemp) : null;

  return (
    <div className="w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        {/* Fond : SVG exact fourni */}
        <image href="/psychrometric_template.svg" x={-15} y={0} width={1000} height={730} />

        {/* Ligne verticale pour la température extérieure (si disponible) */}
        {typeof outdoorX === "number" && (
          <line
            x1={outdoorX}
            y1={40}
            x2={outdoorX}
            y2={691}
            stroke="rgba(59,130,246,0.9)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}

        {/* Points capteurs superposés */}
        <g>
          {circles.map((c, i) => (
            <circle
              key={`${c.name}-${i}`}
              cx={c.cx}
              cy={c.cy}
              r={4.5}
              fill="rgba(34,197,94,0.85)"
              stroke="white"
              strokeWidth={1}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default PsychrometricSvgChart;