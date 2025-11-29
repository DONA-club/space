import * as THREE from 'three';
import { MetricType } from '@/types/sensor.types';
import { INTERPOLATION_DEFAULTS } from '@/constants/interpolation';

const calculateHue = (normalized: number, metric: MetricType): number => {
  switch (metric) {
    case 'temperature':
      if (normalized < 0.5) {
        return 0.667 - (normalized * 2) * 0.5;
      } else {
        return 0.167 - ((normalized - 0.5) * 2) * 0.167;
      }
    case 'humidity':
      return 0.05 + normalized * 0.55;
    case 'absoluteHumidity':
      return 0.15 + normalized * 0.35;
    case 'dewPoint':
      return 0.75 - normalized * 0.25;
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