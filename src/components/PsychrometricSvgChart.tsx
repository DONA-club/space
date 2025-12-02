"use client";

import React from "react";

type ChartPoint = {
  name: string;
  temperature: number;        // °C
  absoluteHumidity: number;   // g/kg (utilise la valeur fournie)
};

type Props = {
  points: ChartPoint[];
  outdoorTemp?: number | null;
};

const X_MIN = -15;
const X_MAX = 40;
const X_AT_MIN = 5;                 // -15°C est à x=5 dans le SVG
const X_AT_40 = 865.9333333333334;  // 40°C est à x≈865.93
const X_PER_DEG = (X_AT_40 - X_AT_MIN) / (X_MAX - X_MIN); // ≈ 15.6533 px/°C

const Y_AT_0_GKG = 691;             // 0 g/kg est à y=691
const Y_PER_GKG = 19.727272727272727; // ≈ 19.7273 px par 1 g/kg (lignes horizontales espacées)

function tempToX(t: number): number {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, t));
  return X_AT_MIN + (clamped - X_MIN) * X_PER_DEG;
}

function gkgToY(w: number): number {
  const clamped = Math.max(0, Math.min(30, w)); // le diagramme montré va jusqu'à 30 g/kg
  return Y_AT_0_GKG - clamped * Y_PER_GKG;
}

const PsychrometricSvgChart: React.FC<Props> = ({ points, outdoorTemp }) => {
  const circles = points
    .filter(p => Number.isFinite(p.temperature) && Number.isFinite(p.absoluteHumidity))
    .map(p => ({
      name: p.name,
      cx: tempToX(p.temperature),
      cy: gkgToY(p.absoluteHumidity),
    }));

  const outdoorX = typeof outdoorTemp === "number" ? tempToX(outdoorTemp) : null;

  return (
    <div className="w-full h-full">
      <svg viewBox="-15 0 1000 730" preserveAspectRatio="xMinYMin meet" className="w-full h-full">
        {/* Fond: votre SVG exact */}
        <image href="/psychrometric_template.svg" x={-15} y={0} width={1000} height={730} />

        {/* Trait vertical pour la température extérieure (optionnel) */}
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

        {/* Points capteurs (superposés) */}
        <g>
          {circles.map((c, i) => (
            <circle
              key={`${c.name}-${i}`}
              cx={c.cx}
              cy={c.cy}
              r={4.5}
              fill="rgba(34,197,94,0.85)"  // vert
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