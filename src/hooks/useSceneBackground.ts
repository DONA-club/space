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
  isDarkMode: boolean;
}

export const useSceneBackground = ({
  scene,
  outdoorData,
  currentTimestamp,
  selectedMetric,
  interpolationRange,
  hasOutdoorData,
  dataReady,
  isDarkMode
}: UseSceneBackgroundProps) => {
  useEffect(() => {
    if (!scene) return;

    // Couleur par défaut adaptée au thème
    const defaultColor = isDarkMode
      ? new THREE.Color(0x1a1a2e) // Bleu très sombre pour mode sombre
      : new THREE.Color(0xf0f4f8); // Gris clair pour mode clair
    
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
    
    // Adaptation du fond selon le thème
    let backgroundColor: THREE.Color;
    if (isDarkMode) {
      // Mode sombre : fond sombre avec une légère teinte de la couleur métrique
      backgroundColor = new THREE.Color(color).lerp(new THREE.Color(0x0a0a15), 0.85);
    } else {
      // Mode clair : fond très clair avec une légère teinte de la couleur métrique
      backgroundColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.85);
    }
    
    scene.background = backgroundColor;
    scene.fog = new THREE.Fog(backgroundColor.getHex(), 20, 100);
  }, [scene, outdoorData, currentTimestamp, selectedMetric, interpolationRange, hasOutdoorData, dataReady, isDarkMode]);
};