import { useEffect } from 'react';
import * as THREE from 'three';
import { Sensor, SensorDataPoint, MetricType } from '@/types/sensor.types';
import { SensorMeshes } from '@/types/scene.types';
import { getColorFromValue } from '@/utils/colorUtils';
import { findClosestDataPoint, getAverageDataPointInWindow } from '@/utils/sensorUtils';
import { getMetricValue, formatMetricValue } from '@/utils/metricUtils';

interface UseSensorMeshUpdatesProps {
  sensorMeshes: Map<number, SensorMeshes> | null;
  sensors: Sensor[];
  sensorData: Map<number, SensorDataPoint[]>;
  currentTimestamp: number;
  selectedMetric: MetricType;
  interpolationRange: { min: number; max: number } | null;
  dataReady: boolean;
  smoothingWindowSec: number;
}

export const useSensorMeshUpdates = ({
  sensorMeshes,
  sensors,
  sensorData,
  currentTimestamp,
  selectedMetric,
  interpolationRange,
  dataReady,
  smoothingWindowSec
}: UseSensorMeshUpdatesProps) => {
  // Update colors
  useEffect(() => {
    if (!sensorMeshes || !dataReady || !interpolationRange || sensorData.size === 0) return;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes || !sensorData.has(sensor.id)) return;

      const data = sensorData.get(sensor.id)!;
      const averaged = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowSec * 1000);
      const value = getMetricValue(averaged, selectedMetric);

      const color = getColorFromValue(value, interpolationRange.min, interpolationRange.max, selectedMetric);
      const emissiveColor = new THREE.Color(color).multiplyScalar(0.5);

      (meshes.sphere.material as THREE.MeshStandardMaterial).color.setHex(color);
      (meshes.sphere.material as THREE.MeshStandardMaterial).emissive.setHex(emissiveColor.getHex());
      (meshes.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    });
  }, [sensorMeshes, sensors, sensorData, currentTimestamp, selectedMetric, interpolationRange, dataReady, smoothingWindowSec]);

  // Update labels
  useEffect(() => {
    if (!sensorMeshes || sensorData.size === 0) return;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes) return;

      if (dataReady && sensorData.has(sensor.id)) {
        const data = sensorData.get(sensor.id)!;
        const averaged = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowSec * 1000);
        const value = getMetricValue(averaged, selectedMetric);
        
        const decimals = selectedMetric === 'absoluteHumidity' ? 2 : 1;
        const formatted = formatMetricValue(value, selectedMetric, decimals);
        
        updateSpriteLabel(meshes.sprite, formatted);
      }
    });
  }, [sensorMeshes, sensors, sensorData, currentTimestamp, selectedMetric, dataReady, smoothingWindowSec]);
};

const updateSpriteLabel = (sprite: THREE.Sprite, text: string) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) return;

  canvas.width = 128;
  canvas.height = 48;
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(0, 0, 0, 0.8)';
  context.shadowBlur = 4;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;
  context.fillStyle = '#ffffff';
  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 64, 24);
  
  const texture = new THREE.CanvasTexture(canvas);
  (sprite.material as THREE.SpriteMaterial).map = texture;
  (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
};