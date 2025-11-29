import * as THREE from 'three';

export const getColorFromValue = (
  value: number,
  minValue: number,
  maxValue: number,
  metric: string
): number => {
  const normalized = (value - minValue) / (maxValue - minValue);
  const color = new THREE.Color();
  
  switch (metric) {
    case 'temperature':
      if (normalized < 0.5) {
        const hue = 0.667 - (normalized * 2) * 0.5;
        color.setHSL(hue, 1.0, 0.5);
      } else {
        const hue = 0.167 - ((normalized - 0.5) * 2) * 0.167;
        color.setHSL(hue, 1.0, 0.5);
      }
      break;
    case 'humidity':
      const humHue = 0.05 + normalized * 0.55;
      color.setHSL(humHue, 1.0, 0.5);
      break;
    case 'absoluteHumidity':
      const absHumHue = 0.15 + normalized * 0.35;
      color.setHSL(absHumHue, 1.0, 0.5);
      break;
    case 'dewPoint':
      const dpHue = 0.75 - normalized * 0.25;
      color.setHSL(dpHue, 1.0, 0.5);
      break;
  }
  
  return color.getHex();
};

export const getColorFromValueSaturated = (
  value: number,
  minValue: number,
  maxValue: number,
  metric: string
): THREE.Color => {
  const normalized = (value - minValue) / (maxValue - minValue);
  const color = new THREE.Color();
  
  switch (metric) {
    case 'temperature':
      if (normalized < 0.5) {
        const hue = 0.667 - (normalized * 2) * 0.5;
        color.setHSL(hue, 1.0, 0.45);
      } else {
        const hue = 0.167 - ((normalized - 0.5) * 2) * 0.167;
        color.setHSL(hue, 1.0, 0.45);
      }
      break;
    case 'humidity':
      const humHue = 0.05 + normalized * 0.55;
      color.setHSL(humHue, 1.0, 0.45);
      break;
    case 'absoluteHumidity':
      const absHumHue = 0.15 + normalized * 0.35;
      color.setHSL(absHumHue, 1.0, 0.45);
      break;
    case 'dewPoint':
      const dpHue = 0.75 - normalized * 0.25;
      color.setHSL(dpHue, 1.0, 0.45);
      break;
  }
  
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