import * as THREE from 'three';
import { MetricType } from '@/types/sensor.types';
import { INTERPOLATION_DEFAULTS } from '@/constants/interpolation';

const calculateHue = (normalized: number, metric: MetricType): number => {
  switch (metric) {
    case 'temperature':
      // Bleu (0.667) -> Cyan (0.5) -> Vert (0.333) -> Jaune (0.167) -> Orange (0.083) -> Rouge (0)
      if (normalized < 0.2) {
        return 0.667 - (normalized / 0.2) * 0.167; // Bleu -> Cyan
      } else if (normalized < 0.4) {
        return 0.5 - ((normalized - 0.2) / 0.2) * 0.167; // Cyan -> Vert
      } else if (normalized < 0.6) {
        return 0.333 - ((normalized - 0.4) / 0.2) * 0.166; // Vert -> Jaune
      } else if (normalized < 0.8) {
        return 0.167 - ((normalized - 0.6) / 0.2) * 0.084; // Jaune -> Orange
      } else {
        return 0.083 - ((normalized - 0.8) / 0.2) * 0.083; // Orange -> Rouge
      }
    case 'humidity':
      // Jaune (0.167) -> Orange (0.083) -> Rouge (0) -> Magenta (0.833) -> Violet (0.75) -> Bleu (0.667)
      if (normalized < 0.2) {
        return 0.167 - (normalized / 0.2) * 0.084;
      } else if (normalized < 0.4) {
        return 0.083 - ((normalized - 0.2) / 0.2) * 0.083;
      } else if (normalized < 0.6) {
        return 1.0 - ((normalized - 0.4) / 0.2) * 0.167; // Wrap around: 0 -> 0.833
      } else if (normalized < 0.8) {
        return 0.833 - ((normalized - 0.6) / 0.2) * 0.083;
      } else {
        return 0.75 - ((normalized - 0.8) / 0.2) * 0.083;
      }
    case 'absoluteHumidity':
      // Jaune (0.167) -> Orange (0.083) -> Rouge (0) -> Magenta (0.833) -> Violet (0.75)
      if (normalized < 0.25) {
        return 0.167 - (normalized / 0.25) * 0.084;
      } else if (normalized < 0.5) {
        return 0.083 - ((normalized - 0.25) / 0.25) * 0.083;
      } else if (normalized < 0.75) {
        return 1.0 - ((normalized - 0.5) / 0.25) * 0.167;
      } else {
        return 0.833 - ((normalized - 0.75) / 0.25) * 0.083;
      }
    case 'dewPoint':
      // Violet (0.75) -> Indigo (0.708) -> Bleu (0.667) -> Bleu clair (0.583) -> Cyan (0.5)
      if (normalized < 0.25) {
        return 0.75 - (normalized / 0.25) * 0.042;
      } else if (normalized < 0.5) {
        return 0.708 - ((normalized - 0.25) / 0.25) * 0.041;
      } else if (normalized < 0.75) {
        return 0.667 - ((normalized - 0.5) / 0.25) * 0.084;
      } else {
        return 0.583 - ((normalized - 0.75) / 0.25) * 0.083;
      }
    case 'vpd':
      // Même palette que la température: faible VPD = humide (bleu) → fort VPD = sec (rouge)
      if (normalized < 0.2) {
        return 0.667 - (normalized / 0.2) * 0.167;
      } else if (normalized < 0.4) {
        return 0.5 - ((normalized - 0.2) / 0.2) * 0.167;
      } else if (normalized < 0.6) {
        return 0.333 - ((normalized - 0.4) / 0.2) * 0.166;
      } else if (normalized < 0.8) {
        return 0.167 - ((normalized - 0.6) / 0.2) * 0.084;
      } else {
        return 0.083 - ((normalized - 0.8) / 0.2) * 0.083;
      }
  }
};

export const getColorFromValue = (
  value: number,
  minValue: number,
  maxValue: number,
  metric: MetricType
): number => {
  const normalized = (value - minValue) / (maxValue - minValue);
  const hue = calculateHue(normalized, metric);
  const color = new THREE.Color();
  color.setHSL(hue, 1.0, 0.5);
  return color.getHex();
};

export const getColorFromValueSaturated = (
  value: number,
  minValue: number,
  maxValue: number,
  metric: MetricType
): THREE.Color => {
  const normalized = (value - minValue) / (maxValue - minValue);
  const hue = calculateHue(normalized, metric);
  const color = new THREE.Color();
  color.setHSL(hue, 1.0, INTERPOLATION_DEFAULTS.SATURATION_LIGHTNESS);
  return color;
};

export const createCircleTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();
  
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

export const rgbaFromColor = (color: number, alpha: number = 0.15): string => {
  const threeColor = new THREE.Color(color);
  const r = Math.round(threeColor.r * 255);
  const g = Math.round(threeColor.g * 255);
  const b = Math.round(threeColor.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};