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
} from "recharts";

type Point = {
  name: string;
  temperature: number;        // °C (dry-bulb)
  absoluteHumidity: number;   // g/m³
};

type Props = {
  points: Point[];
};

const PsychrometricChart: React.FC<Props> = ({ points }) => {
  const { xDomain, yDomain } = useMemo(() => {
    const temps = points.map(p => p.temperature);
    const hums = points.map(p => p.absoluteHumidity);
    const tMin = Math.min(...temps, 0);
    const tMax = Math.max(...temps, 30);
    const hMin = Math.min(...hums, 0);
    const hMax = Math.max(...hums, 30);

    // léger padding
    return {
      xDomain: [Math.floor(tMin - 1), Math.ceil(tMax + 1)],
      yDomain: [Math.floor(hMin - 1), Math.ceil(hMax + 1)],
    };
  }, [points]);

  const data = points.map(p => ({ x: p.temperature, y: p.absoluteHumidity, name: p.name }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Température sèche"
          unit="°C"
          domain={xDomain as [number, number]}
          tick={{ fontSize: 12, fill: "currentColor" }}
          label={{ value: "Température sèche (°C)", position: "bottom", fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Humidité absolue"
          unit=" g/m³"
          domain={yDomain as [number, number]}
          tick={{ fontSize: 12, fill: "currentColor" }}
          label={{ value: "Humidité absolue (g/m³)", angle: -90, position: "insideLeft", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value: any, name: string, props: any) => {
            if (name === "x") return [`${value.toFixed(1)} °C`, "Température"];
            if (name === "y") return [`${value.toFixed(1)} g/m³`, "Humidité absolue"];
            return [value, name];
          }}
          labelFormatter={(label: any) => `Capteur`}
          contentStyle={{ fontSize: 12 }}
        />
        <Scatter name="Capteurs" data={data} fill="rgba(59,130,246,0.8)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default PsychrometricChart;