import { useEffect } from 'react';
import * as THREE from 'three';
import { SensorDataPoint, MetricType } from '@/types/sensor.types';
import { getColorFromValue } from '@/utils/colorUtils';
import { findClosestDataPoint } from '@/utils/sensorUtils';
import { getMetricValue } from '@/utils/metricUtils';

interface UseSceneBackgroundProps {
  scene: THREE.Scene | null;
  outdoorData: SensorDataPoint[];
  currentTimestamp: number;
  selectedMetric: MetricType;
  interpolationRange: { min: number; max: number } | null;
  hasOutdoorData: boolean;
  dataReady: boolean;
}

export const useSceneBackground = ({
  scene,
  outdoorData,
  currentTimestamp,
  selectedMetric,
  interpolationRange,
  hasOutdoorData,
  dataReady
}: UseSceneBackgroundProps) => {
  useEffect(() => {
    if (!scene) return;

    const defaultColor = new THREE.Color(0xf0f4f8);
    
    if (!dataReady || !hasOutdoorData || outdoorData.length === 0 || !interpolationRange) {
      scene.background = defaultColor;
      scene.fog = new THREE.Fog(defaultColor.getHex(), 20, 100);
      return;
    }

    const closestData = findClosestDataPoint(outdoorData, currentTimestamp);
    const outdoorValue = getMetricValue(closestData, selectedMetric);
    
    // Clamp outdoor value to indoor range for color calculation
    const clampedValue = Math.max(
      interpolationRange.min,
      Math.min(interpolationRange.max, outdoorValue)
    );
    
    const color = getColorFromValue(clampedValue, interpolationRange.min, interpolationRange.max, selectedMetric);
    const lightColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.7);
    
    scene.background = lightColor;
    scene.fog = new THREE.Fog(lightColor.getHex(), 20, 100);
  }, [scene, outdoorData, currentTimestamp, selectedMetric, interpolationRange, hasOutdoorData, dataReady]);
};