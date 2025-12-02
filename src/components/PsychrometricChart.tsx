"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

type Point = {
  name: string;
  temperature: number;        // °C (dry-bulb)
  absoluteHumidity: number;   // g/m³
};

type Props = {
  points: Point[];
  outdoorTemp?: number | null;
};

// Approx: absolute humidity (g/m³) from dry-bulb temp (°C) and relative humidity (%)
// AH = 216.7 * (RH/100 * 6.112 * exp(17.67*T/(T+243.5))) / (T+273.15)
const absHumidityFromTempRH = (tC: number, rhPct: number) => {
  const es = 6.112 * Math.exp((17.67 * tC) / (tC + 243.5)); // hPa
  const e = (rhPct / 100) * es;
  const ah = (216.7 * e) / (tC + 273.15);
  return ah;
};

const buildIsoRHSeries = (rhPct: number, tMin = 0, tMax = 45, step = 1) => {
  const data: { x: number; y: number }[] = [];
  for (let t = tMin; t <= tMax; t += step) {
    data.push({ x: t, y: absHumidityFromTempRH(t, rhPct) });
  }
  return data;
};

const PsychrometricChart: React.FC<Props> = ({ points, outdoorTemp }) => {
  const { xDomain, yDomain } = useMemo(() => {
    const temps = points.map(p => p.temperature);
    const hums = points.map(p => p.absoluteHumidity);
    const baseT = [0, 45];
    const baseH = [0, 30];
    const tMin = Math.min(...temps, baseT[0]);
    const tMax = Math.max(...temps, baseT[1]);
    const hMin = Math.min(...hums, baseH[0]);
    const hMax = Math.max(...hums, baseH[1]);

    return {
      xDomain: [Math.floor(tMin - 1), Math.ceil(tMax + 1)],
      yDomain: [Math.floor(hMin - 1), Math.ceil(hMax + 1)],
    };
  }, [points]);

  // Givoni overlay (approximate zones)
  const zones = [
    {
      key: "comfort",
      label: "COMFORT ZONE",
      // Approx polygon simplified as a rectangle for clarity
      x1: 20, x2: 27,
      y1: 7, y2: 12,
      fill: "rgba(134, 239, 172, 0.35)", // green-300
      stroke: "rgba(16, 185, 129, 0.9)",
    },
    {
      key: "natural_vent",
      label: "NATURAL VENTILATION",
      x1: 22, x2: 32,
      y1: 9, y2: 16,
      fill: "rgba(147, 197, 253, 0.22)", // blue-300
      stroke: "rgba(59, 130, 246, 0.9)",
    },
    {
      key: "humidification",
      label: "HUMIDIFICATION",
      x1: 5, x2: 18,
      y1: 8, y2: 20,
      fill: "rgba(192, 132, 252, 0.18)", // purple-400
      stroke: "rgba(126, 34, 206, 0.9)",
    },
    {
      key: "evap_cooling",
      label: "EVAPORATIVE COOLING",
      x1: 30, x2: 40,
      y1: 6, y2: 12,
      fill: "rgba(252, 165, 165, 0.18)", // red-300
      stroke: "rgba(220, 38, 38, 0.9)",
    },
    {
      key: "heating",
      label: "HEATING",
      x1: 0, x2: 12,
      y1: 0, y2: 10,
      fill: "rgba(253, 230, 138, 0.18)", // yellow-300
      stroke: "rgba(202, 138, 4, 0.9)",
    },
    {
      key: "mass_cooling",
      label: "MASS COOLING",
      x1: 34, x2: 45,
      y1: 8, y2: 18,
      fill: "rgba(251, 191, 36, 0.18)", // amber-400
      stroke: "rgba(217, 119, 6, 0.9)",
    },
  ];

  const isoRHs = [20, 30, 40, 50, 60, 70, 80, 90, 100].map(pct => ({
    pct,
    data: buildIsoRHSeries(pct, xDomain[0], xDomain[1], 1),
  }));

  const scatterData = points.map(p => ({ x: p.temperature, y: p.absoluteHumidity, name: p.name }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 24, bottom: 24, left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Dry-Bulb Temp."
          unit="°C"
          domain={xDomain as [number, number]}
          tick={{ fontSize: 11, fill: "currentColor" }}
          label={{ value: "Dry Bulb Temperature (°C)", position: "bottom", fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Absolute Humidity"
          unit=" g/m³"
          domain={yDomain as [number, number]}
          tick={{ fontSize: 11, fill: "currentColor" }}
          label={{ value: "Absolute Humidity (g/m³)", angle: -90, position: "insideLeft", fontSize: 12 }}
        />

        {/* Givoni zones (simplifiées en rectangles) */}
        {zones.map(z => (
          <ReferenceArea
            key={z.key}
            x1={z.x1} x2={z.x2}
            y1={z.y1} y2={z.y2}
            ifOverflow="extendDomain"
            fill={z.fill}
            stroke={z.stroke}
            strokeOpacity={0.9}
          />
        ))}

        {/* Ligne verticale température extérieure (si disponible) */}
        {typeof outdoorTemp === "number" && (
          <ReferenceLine
            x={outdoorTemp}
            stroke="rgba(59,130,246,0.9)"
            strokeDasharray="4 3"
            label={{ value: `Mean Outdoor Temp: ${outdoorTemp.toFixed(1)}°C`, position: "top", fontSize: 11, fill: "rgba(59,130,246,0.9)" }}
          />
        )}

        {/* Courbes d'humidité relative */}
        {isoRHs.map(({ pct, data }) => (
          <Scatter
            key={`iso-${pct}`}
            name={`${pct}% RH`}
            data={data}
            line
            lineType="monotone"
            fill="none"
            stroke="rgba(100,116,139,0.6)"
            strokeWidth={1}
          />
        ))}

        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value: any, name: string, entry: any) => {
            if (name === "x") return [`${Number(value).toFixed(1)} °C`, "Dry Bulb Temp."];
            if (name === "y") return [`${Number(value).toFixed(2)} g/m³`, "Absolute Humidity"];
            return [value, name];
          }}
          labelFormatter={(label: any) => `Point`}
          contentStyle={{ fontSize: 12 }}
        />

        {/* Points capteurs */}
        <Scatter name="Sensors" data={scatterData} fill="rgba(34,197,94,0.85)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default PsychrometricChart;