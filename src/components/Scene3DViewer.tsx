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
import { useSceneBackground } from "@/hooks/useSceneBackground";
import { useSensorMeshUpdates } from "@/hooks/useSensorMeshUpdates";
import { getColorFromValueSaturated, createCircleTexture } from "@/utils/colorUtils";
import { findClosestDataPoint, calculateIndoorAverage } from "@/utils/sensorUtils";
import { getMetricValue } from "@/utils/metricUtils";
import { createSensorSpheres } from "./scene3d/SensorSpheres";
import { createScene, createCamera, createRenderer, setupLights, createControls } from "./scene3d/SceneSetup";
import { SceneRef, ModelBounds } from "@/types/scene.types";
import { INTERPOLATION_OFFSET, INTERPOLATION_DEFAULTS, VISUALIZATION_DEFAULTS } from "@/constants/interpolation";

export const Scene3DViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRef | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelBounds, setModelBounds] = useState<ModelBounds | null>(null);
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

  useSceneBackground({
    scene: sceneRef.current?.scene || null,
    outdoorData,
    currentTimestamp,
    selectedMetric,
    interpolationRange,
    hasOutdoorData,
    dataReady
  });

  useEffect(() => {
    if (!dataReady || sensorData.size === 0) return;

    const average = calculateIndoorAverage(sensorData, sensors, currentTimestamp);
    setIndoorAverage(average);

    if (outdoorData.length > 0) {
      const closestData = findClosestDataPoint(outdoorData, currentTimestamp);
      setCurrentOutdoorData(closestData);
      setOutdoorData(closestData);
    }
  }, [currentTimestamp, dataReady, hasOutdoorData, setOutdoorData, sensors, sensorData, outdoorData]);

  useSensorMeshUpdates({
    sensorMeshes: sceneRef.current?.sensorMeshes || null,
    sensors,
    sensorData,
    currentTimestamp,
    selectedMetric,
    interpolationRange,
    dataReady
  });

  useEffect(() => {
    if (!sceneRef.current || !dataReady || !meshingEnabled || !modelBounds || sensorData.size === 0) {
      if (sceneRef.current?.interpolationMesh) {
        sceneRef.current.scene.remove(sceneRef.current.interpolationMesh);
        disposeInterpolationMesh(sceneRef.current.interpolationMesh);
        sceneRef.current.interpolationMesh = null;
      }
      setInterpolationRange(null);
      return;
    }

    const { scene, interpolationMesh, modelScale, originalCenter } = sceneRef.current;

    if (interpolationMesh) {
      scene.remove(interpolationMesh);
      disposeInterpolationMesh(interpolationMesh);
    }

    const points = buildInterpolationPoints(sensors, sensorData, currentTimestamp, selectedMetric, modelScale, originalCenter);
    if (points.length === 0) return;

    const { min: minValue, max: maxValue } = getValueRange(points);
    const validGridPoints = getValidGridPoints(modelBounds, meshResolution, filteredPointCloud, setUnfilteredPointCloud);
    const gridValues = interpolateGridValues(points, validGridPoints, interpolationMethod, rbfKernel, idwPower, minValue, maxValue);

    setInterpolationRange({ min: minValue, max: maxValue });

    const newMesh = createVisualizationMesh(
      gridValues,
      minValue,
      maxValue,
      selectedMetric,
      visualizationType,
      modelBounds,
      meshResolution,
      filteredPointCloud
    );
    
    scene.add(newMesh);
    sceneRef.current.interpolationMesh = newMesh;
  }, [
    dataReady,
    meshingEnabled,
    modelBounds,
    currentTimestamp,
    selectedMetric,
    interpolationMethod,
    rbfKernel,
    idwPower,
    meshResolution,
    visualizationType,
    sensors,
    modelLoaded,
    filteredPointCloud,
    setUnfilteredPointCloud,
    setInterpolationRange,
    sensorData
  ]);

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

    const loader = new GLTFLoader();
    let boundingSphere = new THREE.Sphere();
    let modelScale = 1;
    let originalCenter: THREE.Vector3 | null = null;

    loader.load(
      gltfModel,
      (gltf) => {
        setError(null);
        setLoading(false);
        
        const { bounds, scale, center } = processLoadedModel(gltf, scene);
        modelScale = scale;
        originalCenter = center;
        setModelBounds(bounds);
        
        // Create sensor spheres with correct transformation
        const sensorMeshes = createSensorSpheres(sensors, modelScale, originalCenter);
        
        // Add sensor meshes to scene
        sensorMeshes.forEach((meshes) => {
          scene.add(meshes.sphere);
          scene.add(meshes.glow);
          scene.add(meshes.sprite);
        });
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        box.getBoundingSphere(boundingSphere);
        boundingSphere.radius *= modelScale;
        
        positionCamera(camera, controls, boundingSphere, width, height);
        setModelLoaded(true);

        sceneRef.current = {
          renderer,
          scene,
          camera,
          controls,
          animationId: 0,
          sensorMeshes,
          boundingSphere,
          interpolationMesh: null,
          modelScale,
          modelGroup: gltf.scene,
          originalCenter
        };

        startAnimationLoop(sceneRef, controls, renderer, scene, camera);
      },
      undefined,
      (err) => {
        setError("Erreur lors du chargement du modèle 3D.");
        setLoading(false);
      }
    );

    return () => {
      if (sceneRef.current) {
        cleanupScene(sceneRef.current, container);
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

const disposeInterpolationMesh = (mesh: THREE.Points | THREE.Group | THREE.Mesh) => {
  if (mesh instanceof THREE.Points || mesh instanceof THREE.Mesh) {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }
  } else if (mesh instanceof THREE.Group) {
    mesh.traverse((child) => {
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
};

const buildInterpolationPoints = (
  sensors: any[],
  sensorData: Map<number, any[]>,
  currentTimestamp: number,
  selectedMetric: string,
  modelScale: number,
  originalCenter: THREE.Vector3 | null
): Point3D[] => {
  const points: Point3D[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;
    
    const data = sensorData.get(sensor.id)!;
    const closestData = findClosestDataPoint(data, currentTimestamp);
    const value = getMetricValue(closestData, selectedMetric as any);
    
    const xScene = (sensor.position[0] - (originalCenter?.x || 0)) * modelScale;
    const yScene = (sensor.position[1] - (originalCenter?.y || 0)) * modelScale;
    const zScene = (sensor.position[2] - (originalCenter?.z || 0)) * modelScale;
    
    points.push({ x: xScene, y: yScene, z: zScene, value });
  });

  return points;
};

const getValueRange = (points: Point3D[]): { min: number; max: number } => {
  return {
    min: Math.min(...points.map(p => p.value)),
    max: Math.max(...points.map(p => p.value))
  };
};

const getValidGridPoints = (
  modelBounds: ModelBounds,
  meshResolution: number,
  filteredPointCloud: Float32Array | null,
  setUnfilteredPointCloud: (points: Float32Array) => void
): { x: number; y: number; z: number }[] => {
  const validGridPoints: { x: number; y: number; z: number }[] = [];
  
  if (filteredPointCloud && filteredPointCloud.length > 0) {
    for (let i = 0; i < filteredPointCloud.length; i += 3) {
      validGridPoints.push({
        x: filteredPointCloud[i] + INTERPOLATION_OFFSET.X,
        y: filteredPointCloud[i + 1] + INTERPOLATION_OFFSET.Y,
        z: filteredPointCloud[i + 2] + INTERPOLATION_OFFSET.Z,
      });
    }
  } else {
    const stepX = (modelBounds.max.x - modelBounds.min.x) / (meshResolution - 1);
    const stepY = (modelBounds.max.y - modelBounds.min.y) / (meshResolution - 1);
    const stepZ = (modelBounds.max.z - modelBounds.min.z) / (meshResolution - 1);

    for (let i = 0; i < meshResolution; i++) {
      for (let j = 0; j < meshResolution; j++) {
        for (let k = 0; k < meshResolution; k++) {
          const x = modelBounds.min.x + i * stepX + INTERPOLATION_OFFSET.X;
          const y = modelBounds.min.y + j * stepY + INTERPOLATION_OFFSET.Y;
          const z = modelBounds.min.z + k * stepZ + INTERPOLATION_OFFSET.Z;
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

  return validGridPoints;
};

const interpolateGridValues = (
  points: Point3D[],
  gridPoints: { x: number; y: number; z: number }[],
  method: string,
  rbfKernel: string,
  idwPower: number,
  minValue: number,
  maxValue: number
): { x: number; y: number; z: number; value: number }[] => {
  let rbfInterpolator: RBFInterpolator | null = null;
  if (method === 'rbf') {
    rbfInterpolator = new RBFInterpolator(points, rbfKernel as any, 1.0);
  }
  
  return gridPoints.map(({ x, y, z }) => {
    let value: number;
    if (method === 'idw') {
      value = interpolateIDW(points, { x, y, z }, idwPower);
    } else {
      value = rbfInterpolator!.interpolate({ x, y, z });
    }
    value = Math.max(minValue, Math.min(maxValue, value));
    return { x, y, z, value };
  });
};

const createVisualizationMesh = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  minValue: number,
  maxValue: number,
  selectedMetric: string,
  visualizationType: string,
  modelBounds: ModelBounds,
  meshResolution: number,
  filteredPointCloud: Float32Array | null
): THREE.Points | THREE.Group | THREE.Mesh => {
  const positions: number[] = [];
  const colors: number[] = [];
  
  gridValues.forEach(({ x, y, z, value }) => {
    positions.push(x, y, z);
    const color = getColorFromValueSaturated(value, minValue, maxValue, selectedMetric as any);
    colors.push(color.r, color.g, color.b);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const avgDim = (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3;
  const pointSize = filteredPointCloud 
    ? avgDim / VISUALIZATION_DEFAULTS.POINT_SIZE_DIVISOR 
    : avgDim / meshResolution * 0.5;

  const material = new THREE.PointsMaterial({
    size: pointSize,
    vertexColors: true,
    transparent: true,
    opacity: INTERPOLATION_DEFAULTS.POINT_OPACITY,
    sizeAttenuation: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    map: createCircleTexture(),
  });

  return new THREE.Points(geometry, material);
};

const processLoadedModel = (gltf: any, scene: THREE.Scene) => {
  const originalBox = new THREE.Box3().setFromObject(gltf.scene);
  const originalCenter = originalBox.getCenter(new THREE.Vector3());
  const originalSize = originalBox.getSize(new THREE.Vector3());
  
  gltf.scene.position.sub(originalCenter);
  
  const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);
  const modelScale = maxDim > 0 ? 10 / maxDim : 1;
  gltf.scene.scale.multiplyScalar(modelScale);
  
  const bounds: ModelBounds = {
    min: originalBox.min.clone().sub(originalCenter).multiplyScalar(modelScale),
    max: originalBox.max.clone().sub(originalCenter).multiplyScalar(modelScale),
    center: new THREE.Vector3(0, 0, 0),
    size: originalSize.clone().multiplyScalar(modelScale)
  };
  
  scene.add(gltf.scene);
  
  return { bounds, scale: modelScale, center: originalCenter };
};

const positionCamera = (
  camera: THREE.PerspectiveCamera,
  controls: any,
  boundingSphere: THREE.Sphere,
  width: number,
  height: number
) => {
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
};

const startAnimationLoop = (
  sceneRef: React.MutableRefObject<SceneRef | null>,
  controls: any,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) => {
  const animate = () => {
    const animationId = requestAnimationFrame(animate);
    if (sceneRef.current) {
      sceneRef.current.animationId = animationId;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  animate();
};

const cleanupScene = (sceneRef: SceneRef, container: HTMLElement) => {
  const { renderer, scene, controls, animationId } = sceneRef;
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
};