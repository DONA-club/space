"use client";

export type AdjustParams = {
  xShiftDeg: number;
  widthScale: number;
  heightScale: number;
  zoomScale: number;
  yOffsetPx: number;
  curvatureGain: number;
};

const DEFAULT_ADJUST: AdjustParams = {
  xShiftDeg: 0,
  widthScale: 1,
  heightScale: 1,
  zoomScale: 1,
  yOffsetPx: 0,
  curvatureGain: 0,
};

export const CALIBRATIONS: { t: number; adjust: AdjustParams }[] = [
  { t: 5.4, adjust: { xShiftDeg: 2.8, widthScale: 0.72, heightScale: 0.84, zoomScale: 0.8, yOffsetPx: 35.5, curvatureGain: 0 } },
  { t: 8.6, adjust: { xShiftDeg: 2.5, widthScale: 0.73, heightScale: 0.91, zoomScale: 0.8, yOffsetPx: 34,   curvatureGain: 0 } },
  { t: 11.0, adjust: { xShiftDeg: 1.6, widthScale: 0.75, heightScale: 0.94, zoomScale: 0.8, yOffsetPx: 38,   curvatureGain: 0.2 } },
];

export function interpolateAdjust(outT?: number): AdjustParams {
  const arr = CALIBRATIONS;
  const midIndex = Math.floor(arr.length / 2);
  const mid = arr[midIndex]?.adjust ?? DEFAULT_ADJUST;

  if (typeof outT !== "number") return mid;

  const sorted = arr.slice().sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return DEFAULT_ADJUST;

  if (outT <= sorted[0].t) return sorted[0].adjust;
  if (outT >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].adjust;

  let a = sorted[0], b = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (outT >= sorted[i].t && outT <= sorted[i + 1].t) {
      a = sorted[i]; b = sorted[i + 1]; break;
    }
  }

  const ratio = (outT - a.t) / (b.t - a.t);
  const lerp = (pA: number, pB: number) => pA + (pB - pA) * ratio;

  return {
    xShiftDeg: lerp(a.adjust.xShiftDeg, b.adjust.xShiftDeg),
    widthScale: lerp(a.adjust.widthScale, b.adjust.widthScale),
    heightScale: lerp(a.adjust.heightScale, b.adjust.heightScale),
    zoomScale: lerp(a.adjust.zoomScale, b.adjust.zoomScale),
    yOffsetPx: lerp(a.adjust.yOffsetPx, b.adjust.yOffsetPx),
    curvatureGain: lerp(a.adjust.curvatureGain, b.adjust.curvatureGain),
  };
}