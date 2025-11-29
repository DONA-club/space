"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AlertCircle } from "lucide-react";
import { interpolateIDW, RBFInterpolator, type Point3D } from "@/utils/interpolation";
import { ColorLegend } from "./ColorLegend";
import { OutdoorBadge } from "./scene3d/OutdoorBadge";
import { useSensorData } from "@/hooks/useSensorData";
import { getColorFromValue, getColorFromValueSaturated, createCircleTexture } from "@/utils/colorUtils";
import { findClosestDataPoint, getMetricValue, calculateIndoorAverage } from "@/utils/sensorUtils";
import { createSensorSpheres, updateSensorLabel, type SensorMeshes } from "./scene3d/SensorSpheres";
import { createScene, createCamera, createRenderer, setupLights, createControls } from "./scene3d/SceneSetup";

// Fixed offsets from calibration
const INTERPOLATION_OFFSET_X = 0;
const INTERPOLATION_OFFSET_Y = 0.6;
const INTERPOLATION_OFFSET_Z = 0.9;

interface SceneRef {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: any;
  animationId: number;
  sensorMeshes: Map<number, SensorMeshes>;
  boundingSphere: THREE.Sphere;
  interpolationMesh: THREE.Points | THREE.Group | THREE.Mesh | null;
  modelScale: number;
  modelGroup: THREE.Group | null;
  originalCenter: THREE.Vector3 | null;
}

export const Scene3DViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRef | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelBounds, setModelBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);
  const [currentOutdoorData, setCurrentOutdoorData] = useState<any>(null);
  const [indoorAverage, setIndoorAverage] = useState<any>(null);
  
  const gltfModel = useAppStore((state) => state.gltfModel);
  const sensors = useAppStore((state) => state.sensors);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const dataReady = useAppStore((state) => state.dataReady);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const visualizationType = useAppStore((state) => state.visualizationType);
  const filteredPointCloud = useAppStore((state) => state.filteredPointCloud);
  const setUnfilteredPointCloud = useAppStore((state) => state.setUnfilteredPointCloud);
  const interpolationRange = useAppStore((state) => state.interpolationRange);
  const setInterpolationRange = useAppStore((state) => state.setInterpolationRange);
  const hasOutdoorData = useAppStore((state) => state.hasOutdoorData);
  const setOutdoorData = useAppStore((state) => state.setOutdoorData);

  const { sensorData, outdoorData } = useSensorData(currentSpace, sensors, hasOutdoorData);

  // Calculate indoor average and update outdoor data
  useEffect(() => {
    if (!dataReady || sensorData.size === 0) {
      if (sceneRef.current?.scene) {
        sceneRef.current.scene.background = new THREE.Color(0xf0f4f8);
        sceneRef.current.scene.fog = new THREE.Fog(0xf0f4f8, 20, 100);
      }
      return;
    }

    const average = calculateIndoorAverage(sensorData, sensors, currentTimestamp);
    setIndoorAverage(average);

    if (outdoorData.length > 0) {
      const closestData = findClosestDataPoint(outdoorData, currentTimestamp);
      setCurrentOutdoorData(closestData);
      setOutdoorData(closestData);

      if (sceneRef.current?.scene && interpolationRange) {
        const value = getMetricValue(closestData, selectedMetric);
        const color = getColorFromValue(value, interpolationRange.min, interpolationRange.max, selectedMetric);
        const lightColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.7);
        sceneRef.current.scene.background = lightColor;
        sceneRef.current.scene.fog = new THREE.Fog(lightColor.getHex(), 20, 100);
      }
    } else if (sceneRef.current?.scene) {
      sceneRef.current.scene.background = new THREE.Color(0xf0f4f8);
      sceneRef.current.scene.fog = new THREE.Fog(0xf0f4f8, 20, 100);
    }
  }, [currentTimestamp, dataReady, selectedMetric, hasOutdoorData, setOutdoorData, sensors, interpolationRange, sensorData, outdoorData]);

  // Update sensor sphere colors
  useEffect(() => {
    if (!sceneRef.current || !dataReady || !interpolationRange || sensorData.size === 0) return;

    const { sensorMeshes } = sceneRef.current;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes || !sensorData.has(sensor.id)) return;

      const data = sensorData.get(sensor.id)!;
      const closestData = findClosestDataPoint(data, currentTimestamp);
      const value = getMetricValue(closestData, selectedMetric);

      const color = getColorFromValue(value, interpolationRange.min, interpolationRange.max, selectedMetric);
      const emissiveColor = new THREE.Color(color).multiplyScalar(0.5);

      (meshes.sphere.material as THREE.MeshStandardMaterial).color.setHex(color);
      (meshes.sphere.material as THREE.MeshStandardMaterial).emissive.setHex(emissiveColor.getHex());
      (meshes.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    });
  }, [dataReady, selectedMetric, currentTimestamp, sensors, interpolationRange, sensorData]);

  // Update sensor labels
  useEffect(() => {
    if (!sceneRef.current || sensorData.size === 0) return;

    const { sensorMeshes } = sceneRef.current;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes) return;

      if (dataReady && sensorData.has(sensor.id)) {
        const data = sensorData.get(sensor.id)!;
        const closestData = findClosestDataPoint(data, currentTimestamp);
        
        let value = '';
        let unit = '';
        
        switch (selectedMetric) {
          case 'temperature':
            value = closestData.temperature.toFixed(1);
            unit = '°C';
            break;
          case 'humidity':
            value = closestData.humidity.toFixed(1);
            unit = '%';
            break;
          case 'absoluteHumidity':
            value = closestData.absoluteHumidity.toFixed(2);
            unit = 'g/m³';
            break;
          case 'dewPoint':
            value = closestData.dewPoint.toFixed(1);
            unit = '°C';
            break;
        }
        
        updateSensorLabel(meshes.sprite, value, unit);
      }
    });
  }, [dataReady, selectedMetric, currentTimestamp, sensors, sensorData]);

  // Interpolation mesh generation
  useEffect(() => {
    if (!sceneRef.current || !dataReady || !meshingEnabled || !modelBounds || sensorData.size === 0) {
      if (sceneRef.current?.interpolationMesh) {
        sceneRef.current.scene.remove(sceneRef.current.interpolationMesh);
        if (sceneRef.current.interpolationMesh instanceof THREE.Points) {
          sceneRef.current.interpolationMesh.geometry.dispose();
          (sceneRef.current.interpolationMesh.material as THREE.PointsMaterial).dispose();
        } else if (sceneRef.current.interpolationMesh instanceof THREE.Mesh) {
          sceneRef.current.interpolationMesh.geometry.dispose();
          (sceneRef.current.interpolationMesh.material as THREE.Material).dispose();
        } else if (sceneRef.current.interpolationMesh instanceof THREE.Group) {
          sceneRef.current.interpolationMesh.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
        sceneRef.current.interpolationMesh = null;
      }
      setInterpolationRange(null);
      return;
    }

    const { scene, interpolationMesh, modelScale, originalCenter } = sceneRef.current;

    if (interpolationMesh) {
      scene.remove(interpolationMesh);
      if (interpolationMesh instanceof THREE.Points) {
        interpolationMesh.geometry.dispose();
        (interpolationMesh.material as THREE.PointsMaterial).dispose();
      } else if (interpolationMesh instanceof THREE.Mesh) {
        interpolationMesh.geometry.dispose();
        (interpolationMesh.material as THREE.Material).dispose();
      } else if (interpolationMesh instanceof THREE.Group) {
        interpolationMesh.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    }

    const points: Point3D[] = [];
    
    sensors.forEach((sensor) => {
      if (!sensorData.has(sensor.id)) return;
      
      const data = sensorData.get(sensor.id)!;
      const closestData = findClosestDataPoint(data, currentTimestamp);
      const value = getMetricValue(closestData, selectedMetric);
      
      const xScene = (sensor.position[0] - (originalCenter?.x || 0)) * modelScale;
      const yScene = (sensor.position[1] - (originalCenter?.y || 0)) * modelScale;
      const zScene = (sensor.position[2] - (originalCenter?.z || 0)) * modelScale;
      
      points.push({ x: xScene, y: yScene, z: zScene, value });
    });

    if (points.length === 0) return;

    let minValue = Math.min(...points.map(p => p.value));
    let maxValue = Math.max(...points.map(p => p.value));

    const positions: number[] = [];
    const colors: number[] = [];
    
    let validGridPoints: { x: number; y: number; z: number }[] = [];
    
    if (filteredPointCloud && filteredPointCloud.length > 0) {
      for (let i = 0; i < filteredPointCloud.length; i += 3) {
        validGridPoints.push({
          x: filteredPointCloud[i] + INTERPOLATION_OFFSET_X,
          y: filteredPointCloud[i + 1] + INTERPOLATION_OFFSET_Y,
          z: filteredPointCloud[i + 2] + INTERPOLATION_OFFSET_Z,
        });
      }
    } else {
      const stepX = (modelBounds.max.x - modelBounds.min.x) / (meshResolution - 1);
      const stepY = (modelBounds.max.y - modelBounds.min.y) / (meshResolution - 1);
      const stepZ = (modelBounds.max.z - modelBounds.min.z) / (meshResolution - 1);

      for (let i = 0; i < meshResolution; i++) {
        for (let j = 0; j < meshResolution; j++) {
          for (let k = 0; k < meshResolution; k++) {
            const x = modelBounds.min.x + i * stepX + INTERPOLATION_OFFSET_X;
            const y = modelBounds.min.y + j * stepY + INTERPOLATION_OFFSET_Y;
            const z = modelBounds.min.z + k * stepZ + INTERPOLATION_OFFSET_Z;
            validGridPoints.push({ x, y, z });
          }
        }
      }
      
      const unfilteredArray = new Float32Array(validGridPoints.length * 3);
      validGridPoints.forEach((p, i) => {
        unfilteredArray[i * 3] = p.x;
        unfilteredArray[i * 3 + 1] = p.y;
        unfilteredArray[i * 3 + 2] = p.z;
      });
      setUnfilteredPointCloud(unfilteredArray);
    }

    let rbfInterpolator: RBFInterpolator | null = null;
    if (interpolationMethod === 'rbf') {
      rbfInterpolator = new RBFInterpolator(points, rbfKernel, 1.0);
    }
    
    const gridValues: { x: number; y: number; z: number; value: number }[] = [];
    
    validGridPoints.forEach(({ x, y, z }) => {
      let value: number;
      if (interpolationMethod === 'idw') {
        value = interpolateIDW(points, { x, y, z }, idwPower);
      } else {
        value = rbfInterpolator!.interpolate({ x, y, z });
      }
      value = Math.max(minValue, Math.min(maxValue, value));
      gridValues.push({ x, y, z, value });
    });

    setInterpolationRange({ min: minValue, max: maxValue });

    let newMesh: THREE.Points | THREE.Group | THREE.Mesh;

    if (visualizationType === 'points') {
      gridValues.forEach(({ x, y, z, value }) => {
        positions.push(x, y, z);
        const color = getColorFromValueSaturated(value, minValue, maxValue, selectedMetric);
        colors.push(color.r, color.g, color.b);
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const avgDim = (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3;
      const pointSize = filteredPointCloud ? avgDim / 50 : avgDim / meshResolution * 0.5;

      const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        map: createCircleTexture(),
      });

      newMesh = new THREE.Points(geometry, material);
    } else {
      // Other visualization types...
      newMesh = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    }
    
    scene.add(newMesh);
    sceneRef.current.interpolationMesh = newMesh;
  }, [dataReady, meshingEnabled, modelBounds, currentTimestamp, selectedMetric, interpolationMethod, rbfKernel, idwPower, meshResolution, visualizationType, sensors, modelLoaded, filteredPointCloud, setUnfilteredPointCloud, setInterpolationRange, sensorData]);

  // Scene initialization
  useLayoutEffect(() => {
    if (!containerRef.current || !gltfModel) {
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    setLoading(true);
    setError(null);

    const scene = createScene();
    const camera = createCamera(width, height);
    const renderer = createRenderer(width, height);
    container.appendChild(renderer.domElement);

    setupLights(scene);
    const controls = createControls(camera, renderer.domElement);

    const sensorMeshes = new Map<number, SensorMeshes>();
    const loader = new GLTFLoader();

    let boundingSphere = new THREE.Sphere();
    let modelScale = 1;
    let modelGroup: THREE.Group | null = null;
    let originalCenter: THREE.Vector3 | null = null;

    loader.load(
      gltfModel,
      (gltf) => {
        setError(null);
        setLoading(false);
        
        const originalBox = new THREE.Box3().setFromObject(gltf.scene);
        originalCenter = originalBox.getCenter(new THREE.Vector3());
        const originalSize = originalBox.getSize(new THREE.Vector3());
        
        gltf.scene.position.sub(originalCenter);
        
        const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);
        modelScale = maxDim > 0 ? 10 / maxDim : 1;
        gltf.scene.scale.multiplyScalar(modelScale);
        
        const scaledBounds = {
          min: originalBox.min.clone().sub(originalCenter).multiplyScalar(modelScale),
          max: originalBox.max.clone().sub(originalCenter).multiplyScalar(modelScale),
          center: new THREE.Vector3(0, 0, 0),
          size: originalSize.clone().multiplyScalar(modelScale)
        };
        
        setModelBounds(scaledBounds);
        modelGroup = gltf.scene;
        scene.add(gltf.scene);
        
        const meshes = createSensorSpheres(sensors, modelScale);
        meshes.forEach((value, key) => sensorMeshes.set(key, value));
        
        originalBox.getBoundingSphere(boundingSphere);
        boundingSphere.radius *= modelScale;
        
        const fov = camera.fov * (Math.PI / 180);
        const aspectRatio = width / height;
        const verticalFit = boundingSphere.radius / Math.tan(fov / 2);
        const horizontalFit = boundingSphere.radius / Math.tan(fov / 2) / aspectRatio;
        const distance = Math.max(verticalFit, horizontalFit) * 1.5;
        
        camera.position.set(distance, distance * 0.75, distance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.minDistance = boundingSphere.radius * 1.2;
        controls.maxDistance = boundingSphere.radius * 5;
        controls.update();
        
        setModelLoaded(true);
      },
      undefined,
      (err) => {
        console.error("Error loading GLTF:", err);
        setError("Erreur lors du chargement du modèle 3D.");
        setLoading(false);
      }
    );

    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    const firstAnimationId = requestAnimationFrame(animate);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      animationId: firstAnimationId,
      sensorMeshes,
      boundingSphere,
      interpolationMesh: null,
      modelScale,
      modelGroup: null,
      originalCenter: null,
    };

    return () => {
      if (sceneRef.current) {
        const { renderer, scene, controls, animationId } = sceneRef.current;
        cancelAnimationFrame(animationId);
        controls.dispose();
        
        scene.traverse((object: any) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m: any) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
        sceneRef.current = null;
      }
    };
  }, [gltfModel, sensors]);

  return (
    <div ref={containerRef} className="absolute inset-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
      <ColorLegend />
      
      <OutdoorBadge
        currentOutdoorData={currentOutdoorData}
        indoorAverage={indoorAverage}
        selectedMetric={selectedMetric}
        interpolationRange={interpolationRange}
        hasOutdoorData={hasOutdoorData}
        dataReady={dataReady}
      />
      
      {!gltfModel && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>Chargez un modèle 3D pour commencer</p>
          </div>
        </div>
      )}
      
      {gltfModel && loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Chargement du modèle 3D...
            </p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 z-10">
          <div className="text-center text-red-600 dark:text-red-400 max-w-md">
            <AlertCircle size={48} className="mx-auto mb-4" />
            <p className="font-medium mb-2">Erreur de chargement</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};