"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPsychroLib, isPsychroLoaded } from "@/lib/psychro/loader";

/* Conversions identiques à celles du composant SVG */
const X_MIN = -15;
const X_MAX = 40;
const X_AT_MIN = 5;
const X_AT_40 = 865.9333333333334;
const X_PER_DEG = (X_AT_40 - X_AT_MIN) / (X_MAX - X_MIN);

const Y_AT_0_GKG = 691;
const Y_PER_GKG = 19.727272727272727;

const P_ATM = 101325;

function tempToX(t: number): number {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, t));
  return X_AT_MIN + (clamped - X_MIN) * X_PER_DEG;
}

function gkgToY(wGkg: number): number {
  const clamped = Math.max(0, Math.min(60, wGkg));
  return Y_AT_0_GKG - clamped * Y_PER_GKG;
}

// Tetens
function saturationVaporPressurePa(tC: number): number {
  return 610.94 * Math.exp((17.625 * tC) / (tC + 243.04));
}

// RH% + T -> w (g/kg)
function mixingRatioFromRH(rhPercent: number, tC: number, pressurePa: number = P_ATM): number {
  const rh = Math.max(0, Math.min(100, rhPercent)) / 100;
  const e_s = saturationVaporPressurePa(tC);
  const e = rh * e_s;
  if (e <= 0 || e >= pressurePa) return NaN;
  return (0.62198 * e / (pressurePa - e)) * 1000;
}

type ZoneResult = {
  id: string;
  label?: string;
  points: string; // "x,y x,y ..."
  centroid?: { x: number; y: number };
  fill?: string;
  stroke?: string;
};

type TRH = { T: number; RH: number };

function toTRHVertices(unknown: any): TRH[] {
  if (!unknown) return [];
  if (Array.isArray(unknown)) {
    if (unknown.length > 0 && Array.isArray(unknown[0]) && unknown[0].length >= 2) {
      return (unknown as any[]).map((p) => ({ T: Number(p[0]), RH: Number(p[1]) }))
        .filter((v) => Number.isFinite(v.T) && Number.isFinite(v.RH));
    }
    if (unknown.length > 0 && typeof unknown[0] === "object") {
      return (unknown as any[]).map((p) => {
        const T = Number((p as any).T ?? (p as any).t ?? (p as any).temp ?? (p as any).temperature);
        const RH = Number((p as any).RH ?? (p as any).rh ?? (p as any).rel_hum ?? (p as any).humidity);
        return { T, RH };
      }).filter((v) => Number.isFinite(v.T) && Number.isFinite(v.RH));
    }
  }
  return [];
}

const DEFAULT_COLORS = [
  { fill: "rgba(34,197,94,0.18)", stroke: "rgba(34,197,94,0.8)" },  // green
  { fill: "rgba(59,130,246,0.15)", stroke: "rgba(59,130,246,0.6)" }, // blue
  { fill: "rgba(234,179,8,0.15)", stroke: "rgba(234,179,8,0.6)" },   // amber
  { fill: "rgba(244,63,94,0.15)", stroke: "rgba(244,63,94,0.6)" },   // rose
  { fill: "rgba(132,204,22,0.15)", stroke: "rgba(132,204,22,0.6)" }, // lime
  { fill: "rgba(14,165,233,0.15)", stroke: "rgba(14,165,233,0.6)" }, // sky
];

export default function usePsychroZones(outdoorTemp: number | null) {
  const [apiReady, setApiReady] = useState<boolean>(isPsychroLoaded());
  const [zonesRaw, setZonesRaw] = useState<any[] | null>(null);

  useEffect(() => {
    let active = true;
    if (apiReady) return;
    loadPsychroLib().then(() => {
      if (active) setApiReady(true);
    });
    return () => { active = false; };
  }, [apiReady]);

  useEffect(() => {
    if (!apiReady) return;
    const api: any = (window as any).PsychroChart2D;
    if (!api) return;

    const Tout = typeof outdoorTemp === "number" ? outdoorTemp : 20;

    let z: any[] | null = null;
    try {
      if (typeof api.zonesForOutdoor === "function") {
        z = api.zonesForOutdoor(Tout);
      } else if (typeof api.getZones === "function") {
        z = api.getZones({ outdoorTempC: Tout });
      } else if (typeof api.givoniZones === "function") {
        z = api.givoniZones(Tout);
      }
    } catch {
      z = null;
    }
    if (Array.isArray(z)) {
      setZonesRaw(z);
    } else {
      setZonesRaw(null);
    }
  }, [apiReady, outdoorTemp]);

  const zones: ZoneResult[] = useMemo(() => {
    if (!zonesRaw || zonesRaw.length === 0) return [];
    return zonesRaw.map((zr: any, idx: number) => {
      const label: string | undefined = zr.label ?? zr.name ?? zr.id ?? undefined;
      const id: string = String(zr.id ?? zr.name ?? `zone-${idx}`);
      const vertsTRH = toTRHVertices(zr.vertices ?? zr.points ?? zr.polygon ?? zr.coords);
      const vertsXY = vertsTRH.map(({ T, RH }) => {
        const w = mixingRatioFromRH(RH, T);
        const x = tempToX(T);
        const y = gkgToY(w);
        return Number.isFinite(x) && Number.isFinite(y) ? [x, y] as [number, number] : null;
      }).filter(Boolean) as [number, number][];

      const points = vertsXY.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      const centroid = vertsXY.length > 0
        ? { x: vertsXY.reduce((a, p) => a + p[0], 0) / vertsXY.length, y: vertsXY.reduce((a, p) => a + p[1], 0) / vertsXY.length }
        : undefined;

      const color = zr.color ?? zr.fill ?? undefined;
      const stroke = zr.stroke ?? zr.border ?? undefined;
      const palette = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

      return {
        id,
        label,
        points,
        centroid,
        fill: color ?? palette.fill,
        stroke: stroke ?? palette.stroke,
      };
    }).filter((z: ZoneResult) => z.points.length > 0);
  }, [zonesRaw]);

  return { zones, ready: apiReady };
}