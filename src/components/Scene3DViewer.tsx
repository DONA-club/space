"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AlertCircle } from "lucide-react";
import { interpolateIDW, RBFInterpolator, type Point3D } from "@/utils/interpolation";
import { ColorLegend } from "./ColorLegend";
import { AirVolumeInfoBadge } from "./scene3d/AirVolumeInfoBadge";
import { OutdoorBadge } from "./scene3d/OutdoorBadge";
import { useSensorData } from "@/hooks/useSensorData";
import { useSceneBackground } from "@/hooks/useSceneBackground";
import { useSensorMeshUpdates } from "@/hooks/useSensorMeshUpdates";
import { getColorFromValueSaturated, createCircleTexture } from "@/utils/colorUtils";
import { calculateIndoorAverage, getDataRange, getAverageDataPointInWindow } from "@/utils/sensorUtils";
import { getMetricValue } from "@/utils/metricUtils";
import { createSensorSpheres } from "./scene3d/SensorSpheres";
import { createScene, createCamera, createRenderer, setupLights, createControls } from "./scene3d/SceneSetup";
import { SceneRef, ModelBounds } from "@/types/scene.types";
import { VISUALIZATION_DEFAULTS } from "@/constants/interpolation";
import { calculateAirDensity, calculateWaterMass } from "@/utils/airCalculations";
import { calculateSceneVolume } from "@/utils/volumeCalculations";
import { useTheme } from "@/components/theme-provider";
import { getSunDirection, getSunPathPoints } from "@/utils/sunUtils";
import * as SunCalc from "suncalc";

export const Scene3DViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRef | null>(null);
  const pulseAnimationRef = useRef<number | null>(null);
  const { theme } = useTheme();
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelBounds, setModelBounds] = useState<ModelBounds | null>(null);
  const [originalModelBounds, setOriginalModelBounds] = useState<ModelBounds | null>(null);
  const [exactAirVolume, setExactAirVolume] = useState<number | null>(null);
  const [indoorAverage, setIndoorAverage] = useState<any>(null);
  const [volumetricAverage, setVolumetricAverage] = useState<number | null>(null);
  const [interpolationPointCount, setInterpolationPointCount] = useState<number>(0);
  const [airMass, setAirMass] = useState<number | null>(null);
  const [waterMass, setWaterMass] = useState<number | null>(null);
  const [averageTemperature, setAverageTemperature] = useState<number | null>(null);
  const [averageHumidity, setAverageHumidity] = useState<number | null>(null);
  const [currentOutdoorData, setCurrentOutdoorData] = useState<any>(null);
  
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
  const interpolationRange = useAppStore((state) => state.setInterpolationRange ? useAppStore.getState().interpolationRange : null);
  const setInterpolationRange = useAppStore((state) => state.setInterpolationRange);
  const hasOutdoorData = useAppStore((state) => state.hasOutdoorData);
  const setOutdoorData = useAppStore((state) => state.setOutdoorData);
  const sensorOffset = useAppStore((state) => state.sensorOffset);
  const smoothingWindowSec = useAppStore((state) => state.smoothingWindowSec);
  const orientationAzimuth = useAppStore((state) => state.orientationAzimuth);

  const { sensorData, outdoorData } = useSensorData(currentSpace, sensors, hasOutdoorData, currentTimestamp);

  const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useSceneBackground({
    scene: sceneRef.current?.scene || null,
    outdoorData,
    currentTimestamp,
    selectedMetric,
    interpolationRange,
    hasOutdoorData,
    dataReady,
    isDarkMode
  });

  useEffect(() => {
    if (!dataReady || sensorData.size === 0) return;

    const average = calculateIndoorAverage(sensorData, sensors, currentTimestamp, smoothingWindowSec * 1000);
    setIndoorAverage(average);

    if (outdoorData.length > 0) {
      const averagedOutdoor = getAverageDataPointInWindow(outdoorData, currentTimestamp, smoothingWindowSec * 1000);
      setOutdoorData(averagedOutdoor);
      setCurrentOutdoorData(averagedOutdoor);
    }
  }, [currentTimestamp, dataReady, hasOutdoorData, setOutdoorData, sensors, sensorData, outdoorData, smoothingWindowSec]);

  useEffect(() => {
    if (!dataReady || sensorData.size === 0) {
      setInterpolationRange(null);
      return;
    }

    const metricKey = selectedMetric === 'temperature' ? 'temperature' :
                      selectedMetric === 'humidity' ? 'humidity' :
                      selectedMetric === 'absoluteHumidity' ? 'absoluteHumidity' : 'dewPoint';

    const range = getDataRange(sensorData, sensors, currentTimestamp, metricKey, smoothingWindowSec * 1000);
    setInterpolationRange(range);
  }, [dataReady, sensorData, sensors, currentTimestamp, selectedMetric, setInterpolationRange, smoothingWindowSec]);

  useSensorMeshUpdates({
    sensorMeshes: sceneRef.current?.sensorMeshes || null,
    sensors,
    sensorData,
    currentTimestamp,
    selectedMetric,
    interpolationRange: useAppStore.getState().interpolationRange,
    dataReady,
    smoothingWindowSec
  });

  useEffect(() => {
    const handleSensorHover = (event: CustomEvent) => {
      if (!sceneRef.current) return;
      const { sensorId } = event.detail;
      const meshes = sceneRef.current.sensorMeshes.get(sensorId);
      if (meshes) {
        if (pulseAnimationRef.current !== null) {
          cancelAnimationFrame(pulseAnimationRef.current);
        }
        const startTime = Date.now();
        const pulseDuration = 1000;
        const animate = () => {
          const elapsed = (Date.now() - startTime) % pulseDuration;
          const progress = elapsed / pulseDuration;
          const scale = 1 + 0.3 * Math.sin(progress * Math.PI * 2);
          meshes.sphere.scale.setScalar(scale);
          meshes.glow.scale.setScalar(scale * 1.5);
          pulseAnimationRef.current = requestAnimationFrame(animate);
        };
        animate();
      }
    };
    const handleSensorLeave = () => {
      if (!sceneRef.current) return;
      if (pulseAnimationRef.current !== null) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      sceneRef.current.sensorMeshes.forEach((meshes) => {
        meshes.sphere.scale.setScalar(1);
        meshes.glow.scale.setScalar(1);
      });
    };
    window.addEventListener('sensorHover', handleSensorHover as EventListener);
    window.addEventListener('sensorLeave', handleSensorLeave);
    return () => {
      window.removeEventListener('sensorHover', handleSensorHover as EventListener);
      window.removeEventListener('sensorLeave', handleSensorLeave);
      if (pulseAnimationRef.current !== null) {
        cancelAnimationFrame(pulseAnimationRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (!sceneRef.current || !modelLoaded || !sceneRef.current.modelGroup) return;
    const group = sceneRef.current.modelGroup;

    group.traverse((child: any) => {
      if ((child as any).isLineSegments && child.userData?.__edgeOverlay) {
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) {
          if (Array.isArray((child as any).material)) {
            (child as any).material.forEach((m: any) => m.dispose());
          } else {
            (child as any).material.dispose();
          }
        }
        child.parent?.remove(child);
      }
    });

    group.traverse((obj: any) => {
      if ((obj as any).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as any;

        const adjustMaterial = (m: any) => {
          if ('emissive' in m) {
            m.emissive = new THREE.Color(isDarkMode ? 0x111111 : 0x000000);
            if ('emissiveIntensity' in m) m.emissiveIntensity = isDarkMode ? 0.22 : 0.0;
          }
          if ('color' in m) {
            m.color = new THREE.Color(isDarkMode ? 0xdadada : 0x6b7280);
          }
          if ('metalness' in m) m.metalness = 0.1;
          if ('roughness' in m) m.roughness = isDarkMode ? 0.7 : 0.9;
        };

        if (Array.isArray(mat)) {
          mat.forEach(adjustMaterial);
        } else {
          adjustMaterial(mat);
        }

        const edgesGeom = new THREE.EdgesGeometry(mesh.geometry);
        const lineMat = new THREE.LineBasicMaterial({
          color: isDarkMode ? 0xffffff : 0x374151,
          transparent: true,
          opacity: isDarkMode ? 0.25 : 0.5,
        });
        const edges = new THREE.LineSegments(edgesGeom, lineMat);
        edges.userData.__edgeOverlay = true;
        mesh.add(edges);
      }
    });
  }, [isDarkMode, modelLoaded]);

  useEffect(() => {
    if (!sceneRef.current || !modelLoaded) return;

    const { scene, sensorMeshes, modelScale, originalCenter, modelGroup } = sceneRef.current;
    const modelPosition = modelGroup?.position || new THREE.Vector3(0, 0, 0);

    sensorMeshes.forEach((meshes) => {
      scene.remove(meshes.sphere);
      scene.remove(meshes.glow);
      scene.remove(meshes.sprite);
    });

    const newSensorMeshes = createSensorSpheres(sensors, modelScale, originalCenter, modelPosition, sensorOffset);
    
    newSensorMeshes.forEach((meshes) => {
      scene.add(meshes.sphere);
      scene.add(meshes.glow);
      scene.add(meshes.sprite);
    });

    sceneRef.current.sensorMeshes = newSensorMeshes;
  }, [sensorOffset, sensors, modelLoaded]);

  useEffect(() => {
    if (!sceneRef.current || !dataReady || !modelBounds || !originalModelBounds || sensorData.size === 0 || exactAirVolume === null) {
      if (sceneRef.current?.interpolationMesh) {
        sceneRef.current.scene.remove(sceneRef.current.interpolationMesh);
        disposeInterpolationMesh(sceneRef.current.interpolationMesh);
        sceneRef.current.interpolationMesh = null;
      }
      setVolumetricAverage(null);
      setInterpolationPointCount(0);
      setAirMass(null);
      setWaterMass(null);
      setAverageTemperature(null);
      setAverageHumidity(null);
      return;
    }

    if (!meshingEnabled) {
      if (sceneRef.current?.interpolationMesh) {
        sceneRef.current.scene.remove(sceneRef.current.interpolationMesh);
        disposeInterpolationMesh(sceneRef.current.interpolationMesh);
        sceneRef.current.interpolationMesh = null;
      }
      setVolumetricAverage(null);
      setInterpolationPointCount(0);
      setAirMass(null);
      setWaterMass(null);
      setAverageTemperature(null);
      setAverageHumidity(null);
      return;
    }

    const { scene, interpolationMesh, modelScale, originalCenter, modelGroup } = sceneRef.current;

    if (interpolationMesh) {
      scene.remove(interpolationMesh);
      disposeInterpolationMesh(interpolationMesh);
    }

    const modelPosition = modelGroup?.position || new THREE.Vector3(0, 0, 0);

    const points = buildInterpolationPoints(sensors, sensorData, currentTimestamp, selectedMetric, modelScale, originalCenter, modelPosition, sensorOffset, smoothingWindowSec * 1000);
    if (points.length === 0) return;

    const { min: minValue, max: maxValue } = getValueRange(points);

    const validGridPoints = getValidGridPoints(modelBounds, meshResolution);
    
    const gridValues = interpolateGridValues(points, validGridPoints, interpolationMethod, rbfKernel, idwPower, minValue, maxValue);

    const average = calculateWeightedAverage(gridValues);
    setVolumetricAverage(average);
    setInterpolationPointCount(gridValues.length);

    const { mass, waterMass: calculatedWaterMass, avgTemp, avgHumidity } = calculateAirProperties(
      gridValues,
      sensors,
      sensorData,
      currentTimestamp,
      validGridPoints,
      interpolationMethod,
      rbfKernel,
      idwPower,
      modelScale,
      originalCenter,
      modelPosition,
      sensorOffset,
      smoothingWindowSec * 1000,
      exactAirVolume
    );
    
    setAirMass(mass);
    setWaterMass(calculatedWaterMass);
    setAverageTemperature(avgTemp);
    setAverageHumidity(avgHumidity);

    const newMesh = createVisualizationMesh(
      gridValues,
      minValue,
      maxValue,
      selectedMetric,
      visualizationType,
      modelBounds,
      meshResolution,
      isDarkMode
    );
    
    scene.add(newMesh);
    sceneRef.current.interpolationMesh = newMesh;
  }, [
    currentTimestamp,
    dataReady,
    meshingEnabled,
    modelBounds,
    originalModelBounds,
    exactAirVolume,
    selectedMetric,
    interpolationMethod,
    rbfKernel,
    idwPower,
    meshResolution,
    visualizationType,
    sensors,
    modelLoaded,
    sensorData,
    sensorOffset,
    isDarkMode
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
        
        const originalVolume = calculateSceneVolume(gltf.scene);
        setExactAirVolume(originalVolume);
        
        const { bounds, originalBounds, scale, center, modelPosition } = processLoadedModel(gltf, scene);
        modelScale = scale;
        originalCenter = center;
        setModelBounds(bounds);
        setOriginalModelBounds(originalBounds);
        
        const sensorMeshes = createSensorSpheres(sensors, modelScale, originalCenter, modelPosition, sensorOffset);
        
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

        // Soleil: sphère, lumière et trajectoire
        const sunRadius = boundingSphere.radius * 2;
        const sunSphereGeom = new THREE.SphereGeometry(0.25, 24, 24);
        const sunSphereMat = new THREE.MeshStandardMaterial({
          color: 0xffd166,
          emissive: 0xffc857,
          emissiveIntensity: 0.8,
          metalness: 0.3,
          roughness: 0.4,
        });
        const sunSphere = new THREE.Mesh(sunSphereGeom, sunSphereMat);
        scene.add(sunSphere);

        const sunLight = new THREE.DirectionalLight(0xfff2b2, 1.0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 200;
        scene.add(sunLight);
        const sunTarget = new THREE.Object3D();
        sunTarget.position.set(0, 0, 0);
        scene.add(sunTarget);
        sunLight.target = sunTarget;

        // Trajectoire du soleil
        let sunPath: THREE.Line | undefined;
        if (currentSpace?.latitude != null && currentSpace?.longitude != null) {
          const pathPoints = getSunPathPoints(
            currentSpace.latitude,
            currentSpace.longitude,
            new Date(currentTimestamp || Date.now()),
            sunRadius,
            new THREE.Vector3(0, 0, 0),
            30
          );
          const pathGeom = new THREE.BufferGeometry().setFromPoints(pathPoints);
          const pathMat = new THREE.LineBasicMaterial({
            color: isDarkMode ? 0xfff2b2 : 0xeea20a,
            transparent: true,
            opacity: isDarkMode ? 0.8 : 0.9,
          });
          sunPath = new THREE.Line(pathGeom, pathMat);
          scene.add(sunPath);
        }

        // Rose des vents (cachée par défaut, affichée au survol du slider)
        const windRose = createWindRose(boundingSphere.radius);
        scene.add(windRose);
        const handleShow = () => { windRose.visible = true; };
        const handleHide = () => { windRose.visible = false; };
        window.addEventListener('windRoseShow', handleShow);
        window.addEventListener('windRoseHide', handleHide);

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
          originalCenter,
          sunLight,
          sunSphere,
          sunPath,
          windRose
        };

        updateSunAndWind();

        startAnimationLoop(sceneRef, controls, renderer, scene, camera);
      },
      undefined,
      () => {
        setError("Erreur lors du chargement du modèle 3D.");
        setLoading(false);
      }
    );

    const handleResize = () => {
      if (!sceneRef.current || !containerRef.current) return;

      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      if (newWidth === 0 || newHeight === 0) return;

      sceneRef.current.camera.aspect = newWidth / newHeight;
      sceneRef.current.camera.updateProjectionMatrix();

      sceneRef.current.renderer.setSize(newWidth, newHeight);

      positionCamera(
        sceneRef.current.camera,
        sceneRef.current.controls,
        sceneRef.current.boundingSphere,
        newWidth,
        newHeight
      );
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (sceneRef.current) {
        cleanupScene(sceneRef.current, container);
        sceneRef.current = null;
      }
    };
  }, [gltfModel, sensors]);

  useEffect(() => {
    updateSunAndWind();
  }, [currentTimestamp, currentSpace, isDarkMode, orientationAzimuth]);

  const updateSunAndWind = () => {
    if (!sceneRef.current) return;
    const { sunLight, sunSphere, boundingSphere, modelGroup, windRose, sunPath, scene } = sceneRef.current;
    if (!sunLight || !sunSphere || !boundingSphere) return;
    if (currentSpace?.latitude == null || currentSpace?.longitude == null) return;

    const date = new Date(currentTimestamp || Date.now());
    const baseDir = getSunDirection(currentSpace.latitude, currentSpace.longitude, date);
    const sunRadius = boundingSphere.radius * 2;

    // Orientation (rotation inverse autour de Y)
    const azRad = THREE.MathUtils.degToRad(orientationAzimuth || 0);
    const rotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), azRad);
    const adjustedDir = baseDir.clone().applyQuaternion(rotQuat);

    // Position du soleil (sphère + lumière)
    const sunPos = new THREE.Vector3().copy(adjustedDir).multiplyScalar(sunRadius);
    sunSphere.position.copy(sunPos);
    sunLight.position.copy(sunPos);
    sunLight.target?.position.set(0, 0, 0);
    sunLight.target?.updateMatrixWorld();

    // Mettre à jour la rose des vents (affichage & rotation)
    if (windRose) {
      windRose.rotation.y = azRad;
    }

    // Recalculer la trajectoire du soleil et les marqueurs (lever, zénith, coucher)
    const pathPoints = getSunPathPoints(
      currentSpace.latitude!,
      currentSpace.longitude!,
      date,
      sunRadius,
      new THREE.Vector3(0, 0, 0),
      30
    ).map(p => p.applyQuaternion(rotQuat));

    const pathGeom = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0xeea20a,
      transparent: true,
      opacity: 0.9,
    });
    const newPathLine = new THREE.Line(pathGeom, pathMat);

    // Marqueurs: lever, zénith (solarNoon), coucher
    const times = SunCalc.getTimes(date, currentSpace.latitude!, currentSpace.longitude!);
    const sunriseDir = getSunDirection(currentSpace.latitude!, currentSpace.longitude!, times.sunrise ?? date).applyQuaternion(rotQuat);
    const sunsetDir = getSunDirection(currentSpace.latitude!, currentSpace.longitude!, times.sunset ?? date).applyQuaternion(rotQuat);
    const noonDir = getSunDirection(currentSpace.latitude!, currentSpace.longitude!, times.solarNoon ?? date).applyQuaternion(rotQuat);

    const sunrisePos = sunriseDir.clone().multiplyScalar(sunRadius);
    const sunsetPos = sunsetDir.clone().multiplyScalar(sunRadius);
    const noonPos = noonDir.clone().multiplyScalar(sunRadius);

    const markerGeom = new THREE.SphereGeometry(0.12, 24, 24);
    const sunriseMat = new THREE.MeshStandardMaterial({ color: 0xffb56b, emissive: 0xffa24a, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.6 });
    const noonMat = new THREE.MeshStandardMaterial({ color: 0xfff2b2, emissive: 0xffe78a, emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.6 });
    const sunsetMat = new THREE.MeshStandardMaterial({ color: 0xff7b6b, emissive: 0xff604a, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.6 });

    const sunriseMarker = new THREE.Mesh(markerGeom, sunriseMat);
    const noonMarker = new THREE.Mesh(markerGeom, noonMat);
    const sunsetMarker = new THREE.Mesh(markerGeom, sunsetMat);

    sunriseMarker.position.copy(sunrisePos);
    noonMarker.position.copy(noonPos);
    sunsetMarker.position.copy(sunsetPos);

    // Regrouper ligne + marqueurs
    const pathGroup = new THREE.Group();
    pathGroup.add(newPathLine, sunriseMarker, noonMarker, sunsetMarker);

    // Remplacer l'ancien chemin (s'il existe)
    if (sunPath) {
      scene.remove(sunPath);
    }
    scene.add(pathGroup);
    sceneRef.current.sunPath = pathGroup;

    // Exposition des capteurs (raycasting sur le modèle)
    if (modelGroup) {
      const ray = new THREE.Raycaster();
      const direction = adjustedDir.clone().normalize();
      sceneRef.current.sensorMeshes.forEach((meshes) => {
        const origin = meshes.sphere.position.clone();
        ray.set(origin, direction);
        const intersections = ray.intersectObject(modelGroup, true);
        const occluded = intersections.length > 0;
        const glowMat = meshes.glow.material as THREE.MeshBasicMaterial;
        const sphereMat = meshes.sphere.material as THREE.MeshStandardMaterial;

        if (occluded) {
          glowMat.opacity = 0.15;
          sphereMat.emissiveIntensity = 0.2;
        } else {
          glowMat.opacity = 0.6;
          sphereMat.emissiveIntensity = 0.7;
        }
        glowMat.needsUpdate = true;
      });
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
      <OutdoorBadge
        currentOutdoorData={currentOutdoorData}
        indoorAverage={indoorAverage}
        selectedMetric={selectedMetric}
        interpolationRange={useAppStore.getState().interpolationRange}
        hasOutdoorData={hasOutdoorData}
        dataReady={dataReady}
        volumetricAverage={volumetricAverage}
        meshingEnabled={meshingEnabled}
      />
      
      <AirVolumeInfoBadge
        airVolume={exactAirVolume}
        airMass={airMass}
        waterMass={waterMass}
        averageTemperature={averageTemperature}
        averageHumidity={averageHumidity}
        meshingEnabled={meshingEnabled}
        dataReady={dataReady}
      />
      
      <ColorLegend volumetricAverage={volumetricAverage} />
      
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

// Utils existants + helpers
const disposeInterpolationMesh = (mesh: THREE.Points | THREE.Group | THREE.Mesh) => {
  if (mesh instanceof THREE.Points || mesh instanceof THREE.Mesh) {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      (mesh.material as THREE.Material).dispose();
    }
  } else if (mesh instanceof THREE.Group) {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          (child.material as THREE.Material[]).forEach(m => m.dispose());
        } else {
          (child.material as THREE.Material).dispose();
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
  originalCenter: THREE.Vector3 | null,
  modelPosition: THREE.Vector3,
  manualOffset: { x: number; y: number; z: number },
  smoothingWindowMs: number
): Point3D[] => {
  const points: Point3D[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;
    
    const data = sensorData.get(sensor.id)!;
    const averaged = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowMs);
    const value = getMetricValue(averaged, selectedMetric as any);
    
    const xCentered = sensor.position[0] - (originalCenter?.x || 0);
    const yCentered = sensor.position[1] - (originalCenter?.y || 0);
    const zCentered = sensor.position[2] - (originalCenter?.z || 0);
    
    const xScaled = xCentered * modelScale;
    const yScaled = yCentered * modelScale;
    const zScaled = zCentered * modelScale;
    
    const xWithModel = xScaled + modelPosition.x;
    const yWithModel = yScaled + modelPosition.y;
    const zWithModel = zScaled + modelPosition.z;
    
    const xFinal = xWithModel + manualOffset.x;
    const yFinal = yWithModel + manualOffset.y;
    const zFinal = zWithModel + manualOffset.z;
    
    points.push({ x: xFinal, y: yFinal, z: zFinal, value });
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
  meshResolution: number
): { x: number; y: number; z: number }[] => {
  const validGridPoints: { x: number; y: number; z: number }[] = [];
  
  const stepX = (modelBounds.max.x - modelBounds.min.x) / (meshResolution - 1);
  const stepY = (modelBounds.max.y - modelBounds.min.y) / (meshResolution - 1);
  const stepZ = (modelBounds.max.z - modelBounds.min.z) / (meshResolution - 1);

  for (let i = 0; i < meshResolution; i++) {
    for (let j = 0; j < meshResolution; j++) {
      for (let k = 0; k < meshResolution; k++) {
        const x = modelBounds.min.x + i * stepX;
        const y = modelBounds.min.y + j * stepY;
        const z = modelBounds.min.z + k * stepZ;
        validGridPoints.push({ x, y, z });
      }
    }
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

const calculateWeightedAverage = (
  gridValues: { x: number; y: number; z: number; value: number }[]
): number => {
  if (gridValues.length === 0) return 0;
  
  const sum = gridValues.reduce((acc, point) => acc + point.value, 0);
  return sum / gridValues.length;
};

const calculateAirProperties = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  sensors: any[],
  sensorData: Map<number, any[]>,
  currentTimestamp: number,
  validGridPoints: { x: number; y: number; z: number }[],
  interpolationMethod: string,
  rbfKernel: string,
  idwPower: number,
  modelScale: number,
  originalCenter: THREE.Vector3 | null,
  modelPosition: THREE.Vector3,
  sensorOffset: { x: number; y: number; z: number },
  smoothingWindowMs: number,
  exactVolume: number
): { mass: number; waterMass: number; avgTemp: number; avgHumidity: number } => {
  const tempPoints: Point3D[] = [];
  const humidityPoints: Point3D[] = [];
  
  sensors.forEach((sensor) => {
    if (!sensorData.has(sensor.id)) return;
    
    const data = sensorData.get(sensor.id)!;
    const closestData = getAverageDataPointInWindow(data, currentTimestamp, smoothingWindowMs);
    
    const xCentered = sensor.position[0] - (originalCenter?.x || 0);
    const yCentered = sensor.position[1] - (originalCenter?.y || 0);
    const zCentered = sensor.position[2] - (originalCenter?.z || 0);
    
    const xScaled = xCentered * modelScale;
    const yScaled = yCentered * modelScale;
    const zScaled = zCentered * modelScale;
    
    const xWithModel = xScaled + modelPosition.x;
    const yWithModel = yScaled + modelPosition.y;
    const zWithModel = zScaled + modelPosition.z;
    
    const xFinal = xWithModel + sensorOffset.x;
    const yFinal = yWithModel + sensorOffset.y;
    const zFinal = zWithModel + sensorOffset.z;
    
    tempPoints.push({ 
      x: xFinal, 
      y: yFinal, 
      z: zFinal, 
      value: closestData.temperature 
    });
    
    humidityPoints.push({ 
      x: xFinal, 
      y: yFinal, 
      z: zFinal, 
      value: closestData.humidity 
    });
  });

  let rbfTempInterpolator: RBFInterpolator | null = null;
  let rbfHumidityInterpolator: RBFInterpolator | null = null;
  
  if (interpolationMethod === 'rbf') {
    rbfTempInterpolator = new RBFInterpolator(tempPoints, rbfKernel as any, 1.0);
    rbfHumidityInterpolator = new RBFInterpolator(humidityPoints, rbfKernel as any, 1.0);
  }

  let totalTemp = 0;
  let totalHumidity = 0;

  validGridPoints.forEach(({ x, y, z }) => {
    let temperature: number;
    let humidity: number;

    if (interpolationMethod === 'idw') {
      temperature = interpolateIDW(tempPoints, { x, y, z }, idwPower);
      humidity = interpolateIDW(humidityPoints, { x, y, z }, idwPower);
    } else {
      temperature = rbfTempInterpolator!.interpolate({ x, y, z });
      humidity = rbfHumidityInterpolator!.interpolate({ x, y, z });
    }

    totalTemp += temperature;
    totalHumidity += humidity;
  });

  const avgTemp = totalTemp / validGridPoints.length;
  const avgHumidity = totalHumidity / validGridPoints.length;

  const density = calculateAirDensity(avgTemp, avgHumidity);
  const totalMass = density * exactVolume;
  
  const totalWaterMass = calculateWaterMass(exactVolume, avgTemp, avgHumidity);

  return {
    mass: totalMass,
    waterMass: totalWaterMass,
    avgTemp,
    avgHumidity
  };
};

const createVisualizationMesh = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  minValue: number,
  maxValue: number,
  selectedMetric: string,
  visualizationType: string,
  modelBounds: ModelBounds,
  meshResolution: number,
  isDarkMode: boolean
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
  
  if (visualizationType === 'vectors') {
    return createVectorField(gridValues, minValue, maxValue, selectedMetric, modelBounds, meshResolution);
  } else if (visualizationType === 'isosurface') {
    return createIsosurfaces(gridValues, minValue, maxValue, selectedMetric, modelBounds, meshResolution);
  } else if (visualizationType === 'mesh') {
    return createVolumeMesh(gridValues, minValue, maxValue, selectedMetric, modelBounds, meshResolution, isDarkMode);
  }
  
  const basePointSize = avgDim / VISUALIZATION_DEFAULTS.POINT_SIZE_DIVISOR;
  const pointSize = isDarkMode ? basePointSize * 0.85 : basePointSize;

  const opacity = isDarkMode ? 0.68 : 0.75;

  const material = new THREE.PointsMaterial({
    size: pointSize,
    vertexColors: true,
    transparent: true,
    opacity: opacity,
    sizeAttenuation: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    dithering: true,
    map: createCircleTexture(),
  });

  return new THREE.Points(geometry, material);
};

const createVectorField = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  minValue: number,
  maxValue: number,
  selectedMetric: string,
  modelBounds: ModelBounds,
  meshResolution: number
): THREE.Group => {
  const group = new THREE.Group();
  const step = Math.max(1, Math.floor(meshResolution / VISUALIZATION_DEFAULTS.VECTOR_STEP_DIVISOR));
  
  for (let i = 0; i < gridValues.length; i += step) {
    const point = gridValues[i];
    
    let gradX = 0, gradY = 0, gradZ = 0;
    const neighbors = gridValues.filter(p => {
      const dist = Math.sqrt(
        Math.pow(p.x - point.x, 2) +
        Math.pow(p.y - point.y, 2) +
        Math.pow(p.z - point.z, 2)
      );
      return dist > 0 && dist < 1;
    });
    
    neighbors.forEach(n => {
      const diff = n.value - point.value;
      const dist = Math.sqrt(
        Math.pow(n.x - point.x, 2) +
        Math.pow(n.y - point.y, 2) +
        Math.pow(n.z - point.z, 2)
      );
      if (dist > 0) {
        gradX += diff * (n.x - point.x) / dist;
        gradY += diff * (n.y - point.y) / dist;
        gradZ += diff * (n.z - point.z) / dist;
      }
    });
    
    const length = Math.sqrt(gradX * gradX + gradY * gradY + gradZ * gradZ);
    if (length > 0.01) {
      const arrowLength = 0.3;
      const dir = new THREE.Vector3(gradX, gradY, gradZ).normalize();
      const origin = new THREE.Vector3(point.x, point.y, point.z);
      
      const color = getColorFromValueSaturated(point.value, minValue, maxValue, selectedMetric as any);
      const arrow = new THREE.ArrowHelper(dir, origin, arrowLength, color.getHex(), 0.1, 0.05);
      group.add(arrow);
    }
  }
  
  return group;
};

const createIsosurfaces = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  minValue: number,
  maxValue: number,
  selectedMetric: string,
  modelBounds: ModelBounds,
  meshResolution: number
): THREE.Group => {
  const group = new THREE.Group();
  const levels = VISUALIZATION_DEFAULTS.ISOSURFACE_LEVELS;
  
  for (let i = 0; i < levels; i++) {
    const isoValue = minValue + (maxValue - minValue) * (i + 1) / (levels + 1);
    const color = getColorFromValueSaturated(isoValue, minValue, maxValue, selectedMetric as any);
    
    const points = gridValues.filter(p => Math.abs(p.value - isoValue) < (maxValue - minValue) / (levels * 2));
    
    if (points.length > 0) {
      const positions: number[] = [];
      points.forEach(p => {
        positions.push(p.x, p.y, p.z);
      });
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const material = new THREE.PointsMaterial({
        size: 0.15,
        color: color.getHex(),
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      });
      
      const mesh = new THREE.Points(geometry, material);
      group.add(mesh);
    }
  }
  
  return group;
};

const createVolumeMesh = (
  gridValues: { x: number; y: number; z: number; value: number }[],
  minValue: number,
  maxValue: number,
  selectedMetric: string,
  modelBounds: ModelBounds,
  meshResolution: number,
  isDarkMode: boolean
): THREE.Mesh => {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  
  const stepX = (modelBounds.max.x - modelBounds.min.x) / (meshResolution - 1);
  const stepY = (modelBounds.max.y - modelBounds.min.y) / (meshResolution - 1);
  const stepZ = (modelBounds.max.z - modelBounds.min.z) / (meshResolution - 1);
  
  const cubeSize = Math.min(stepX, stepY, stepZ) * 0.45;
  
  let vertexIndex = 0;
  
  for (let i = 0; i < gridValues.length; i++) {
    const point = gridValues[i];
    
    const x = point.x, y = point.y, z = point.z;
    const color = getColorFromValueSaturated(point.value, minValue, maxValue, selectedMetric as any);
    
    const vertices = [
      [x - cubeSize, y - cubeSize, z - cubeSize],
      [x + cubeSize, y - cubeSize, z - cubeSize],
      [x + cubeSize, y + cubeSize, z - cubeSize],
      [x - cubeSize, y + cubeSize, z - cubeSize],
      [x - cubeSize, y - cubeSize, z + cubeSize],
      [x + cubeSize, y - cubeSize, z + cubeSize],
      [x + cubeSize, y + cubeSize, z + cubeSize],
      [x - cubeSize, y + cubeSize, z + cubeSize],
    ];
    
    vertices.forEach(v => {
      positions.push(v[0], v[1], v[2]);
      colors.push(color.r, color.g, color.b);
    });
    
    const faceIndices = [
      [0, 1, 2], [0, 2, 3],
      [4, 6, 5], [4, 7, 6],
      [0, 4, 5], [0, 5, 1],
      [2, 6, 7], [2, 7, 3],
      [0, 3, 7], [0, 7, 4],
      [1, 5, 6], [1, 6, 2],
    ];
    
    faceIndices.forEach(face => {
      indices.push(
        vertexIndex + face[0],
        vertexIndex + face[1],
        vertexIndex + face[2]
      );
    });
    
    vertexIndex += 8;
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const opacity = isDarkMode ? 0.9 : 0.7;
  
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    emissive: isDarkMode ? new THREE.Color(0x111111) : new THREE.Color(0x000000),
    emissiveIntensity: isDarkMode ? 0.2 : 0,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
};

const processLoadedModel = (gltf: any, scene: THREE.Scene) => {
  const originalBox = new THREE.Box3().setFromObject(gltf.scene);
  const originalCenter = originalBox.getCenter(new THREE.Vector3());
  const originalSize = originalBox.getSize(new THREE.Vector3());
  
  const originalBounds: ModelBounds = {
    min: originalBox.min.clone(),
    max: originalBox.max.clone(),
    center: originalCenter.clone(),
    size: originalSize.clone()
  };
  
  gltf.scene.position.sub(originalCenter);
  const modelPosition = gltf.scene.position.clone();
  
  const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);
  const modelScale = maxDim > 0 ? 10 / maxDim : 1;
  gltf.scene.scale.multiplyScalar(modelScale);
  
  scene.add(gltf.scene);
  
  const transformedBox = new THREE.Box3().setFromObject(gltf.scene);
  
  const bounds: ModelBounds = {
    min: transformedBox.min.clone(),
    max: transformedBox.max.clone(),
    center: transformedBox.getCenter(new THREE.Vector3()),
    size: transformedBox.getSize(new THREE.Vector3())
  };
  
  return { bounds, originalBounds, scale: modelScale, center: originalCenter, modelPosition };
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
  
  const distance = Math.max(verticalFit, horizontalFit) * 0.7;
  
  camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
  camera.lookAt(0, 0, 0);
  
  controls.target.set(0, 0, 0);
  controls.minDistance = boundingSphere.radius * 0.5;
  controls.maxDistance = boundingSphere.radius * 4;
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

/** Rose des vents 3D moderne (8 flèches: N/E/S/O grandes + NE/SE/SO/NO petites, bicolores gris avec liseré) */
const createWindRose = (radius: number): THREE.Group => {
  const group = new THREE.Group();
  const rOuter = radius * 0.75;

  // Anneau fin pour l’esthétique
  const ringSegments = 96;
  const ringPoints: THREE.Vector3[] = [];
  for (let i = 0; i < ringSegments; i++) {
    const a = (i / ringSegments) * Math.PI * 2;
    ringPoints.push(new THREE.Vector3(Math.cos(a) * (rOuter * 0.98), 0, Math.sin(a) * (rOuter * 0.98)));
  }
  const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPoints);
  const ringMat = new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.35 });
  const ring = new THREE.LineLoop(ringGeom, ringMat);
  group.add(ring);

  // Helper pour créer une flèche bicolore avec léger liseré
  const createBiArrow = (dir: THREE.Vector3, length: number) => {
    const origin = new THREE.Vector3(0, 0, 0);
    const g = new THREE.Group();

    // Flèche foncée (fond)
    const dark = new THREE.ArrowHelper(dir.clone().normalize(), origin, length, 0x374151, length * 0.12, length * 0.05);
    g.add(dark);

    // Flèche claire (overlay léger)
    const light = new THREE.ArrowHelper(dir.clone().normalize(), origin, length * 0.96, 0x9ca3af, length * 0.10, length * 0.042);
    // léger décalage pour éviter le z-fighting
    const n = dir.clone().normalize();
    light.cone.position.add(n.clone().multiplyScalar(length * 0.01));
    light.line.position.add(n.clone().multiplyScalar(length * 0.01));
    g.add(light);

    // Liseré moderne (ligne centrale très subtile)
    const tip = n.clone().multiplyScalar(length);
    const lineGeom = new THREE.BufferGeometry().setFromPoints([origin, tip]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
    const line = new THREE.Line(lineGeom, lineMat);
    g.add(line);

    return g;
  };

  const lenBig = rOuter * 0.62;
  const lenSmall = rOuter * 0.45;

  // Cardinales (N: -Z, E: +X, S: +Z, O: -X)
  group.add(createBiArrow(new THREE.Vector3(0, 0, -1), lenBig)); // N
  group.add(createBiArrow(new THREE.Vector3(1, 0, 0), lenBig));  // E
  group.add(createBiArrow(new THREE.Vector3(0, 0, 1), lenBig));  // S
  group.add(createBiArrow(new THREE.Vector3(-1, 0, 0), lenBig)); // O

  // Intercardinales (NE, SE, SO, NO) plus petites
  const diag = (x: number, z: number) => new THREE.Vector3(x, 0, z).normalize();
  group.add(createBiArrow(diag(1, -1), lenSmall));  // NE
  group.add(createBiArrow(diag(1, 1), lenSmall));   // SE
  group.add(createBiArrow(diag(-1, 1), lenSmall));  // SO
  group.add(createBiArrow(diag(-1, -1), lenSmall)); // NO

  group.position.set(0, 0, 0);
  group.visible = false; // visible seulement au survol
  return group;
};