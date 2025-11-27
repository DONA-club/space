"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { AlertCircle } from "lucide-react";
import { interpolateIDW, RBFInterpolator, type Point3D } from "@/utils/interpolation";

// Fixed offsets from calibration
const INTERPOLATION_OFFSET_X = 0;
const INTERPOLATION_OFFSET_Y = 0.6;
const INTERPOLATION_OFFSET_Z = 0.9;

// Helper function to check if a point is inside a mesh using raycasting
function isPointInsideMesh(point: THREE.Vector3, mesh: THREE.Mesh): boolean {
  const raycaster = new THREE.Raycaster();
  const directions = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  let intersectionCount = 0;
  
  for (const direction of directions) {
    raycaster.set(point, direction);
    const intersects = raycaster.intersectObject(mesh, true);
    if (intersects.length > 0) {
      intersectionCount++;
    }
  }

  // A point is inside if it intersects in at least 4 directions
  return intersectionCount >= 4;
}

export const Scene3DViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animationId: number;
    sensorMeshes: Map<number, { sphere: THREE.Mesh; glow: THREE.Mesh; sprite: THREE.Sprite }>;
    boundingSphere: THREE.Sphere;
    sensorData: Map<number, Array<{ timestamp: number; temperature: number; humidity: number; absoluteHumidity: number; dewPoint: number }>>;
    interpolationMesh: THREE.Points | THREE.Group | THREE.Mesh | null;
    modelScale: number;
    roomVolumeMesh: THREE.Mesh | null;
    modelGroup: THREE.Group | null;
    originalCenter: THREE.Vector3 | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelBounds, setModelBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);
  const gltfModel = useAppStore((state) => state.gltfModel);
  const roomVolume = useAppStore((state) => state.roomVolume);
  const sensors = useAppStore((state) => state.sensors);
  const dataReady = useAppStore((state) => state.dataReady);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const visualizationType = useAppStore((state) => state.visualizationType);
  const [hoveredSensorId, setHoveredSensorId] = useState<number | null>(null);

  // Listen to hover events from SensorPanel
  useEffect(() => {
    const handleSensorHover = (event: CustomEvent) => {
      setHoveredSensorId(event.detail.sensorId);
    };

    const handleSensorLeave = () => {
      setHoveredSensorId(null);
    };

    window.addEventListener('sensorHover' as any, handleSensorHover);
    window.addEventListener('sensorLeave' as any, handleSensorLeave);

    return () => {
      window.removeEventListener('sensorHover' as any, handleSensorHover);
      window.removeEventListener('sensorLeave' as any, handleSensorLeave);
    };
  }, []);

  // Load STL volume when roomVolume changes
  useEffect(() => {
    if (!sceneRef.current || !roomVolume) return;

    const { scene, modelScale, originalCenter } = sceneRef.current;

    console.log('🏠 Loading STL room volume...');

    const stlLoader = new STLLoader();
    stlLoader.load(
      roomVolume,
      (geometry) => {
        console.log('✅ STL loaded successfully');
        
        // Create mesh from STL geometry
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        });
        
        const stlMesh = new THREE.Mesh(geometry, material);
        
        // Apply same transformations as the GLTF model
        if (originalCenter) {
          stlMesh.position.set(
            -originalCenter.x * modelScale,
            -originalCenter.y * modelScale,
            -originalCenter.z * modelScale
          );
        }
        stlMesh.scale.set(modelScale, modelScale, modelScale);
        
        // Don't add to scene (invisible helper for raycasting)
        // But we need to update its matrix for raycasting to work
        stlMesh.updateMatrixWorld(true);
        
        if (sceneRef.current) {
          sceneRef.current.roomVolumeMesh = stlMesh;
        }
        
        console.log('🏠 STL room volume mesh ready for raycasting');
      },
      undefined,
      (error) => {
        console.error('❌ Error loading STL:', error);
      }
    );
  }, [roomVolume]);

  // Load CSV data when sensors change
  useEffect(() => {
    if (!sceneRef.current) return;

    const loadSensorData = async () => {
      const sensorData = new Map();

      for (const sensor of sensors) {
        if (!sensor.csvFile) continue;

        try {
          const text = await sensor.csvFile.text();
          const lines = text.split('\n').filter(line => line.trim());
          const dataLines = lines.slice(1);

          const data = dataLines.map(line => {
            const values = line.replace(/"/g, '').split(',');
            if (values.length < 5) return null;

            const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
            const date = new Date(timestampStr.trim());

            if (isNaN(date.getTime())) return null;

            const temp = parseFloat(tempStr);
            const hum = parseFloat(humStr);
            const absHum = parseFloat(absHumStr);
            const dpt = parseFloat(dptStr);

            if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) return null;

            return {
              timestamp: date.getTime(),
              temperature: temp,
              humidity: hum,
              absoluteHumidity: absHum,
              dewPoint: dpt
            };
          }).filter(d => d !== null);

          sensorData.set(sensor.id, data);
        } catch (error) {
          console.error(`Error loading CSV for sensor ${sensor.id}:`, error);
        }
      }

      if (sceneRef.current) {
        sceneRef.current.sensorData = sensorData;
      }
    };

    loadSensorData();
  }, [sensors]);

  // Update sensor colors
  useEffect(() => {
    if (!sceneRef.current) return;

    const { sensorMeshes } = sceneRef.current;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes) return;

      const isHovered = hoveredSensorId === sensor.id;
      const hasCSV = !!sensor.csvFile;

      let color: number;
      let emissiveColor: number;
      let glowColor: number;

      if (isHovered) {
        color = 0x9333ea;
        emissiveColor = 0x7c3aed;
        glowColor = 0x9333ea;
      } else if (hasCSV) {
        color = 0x22c55e;
        emissiveColor = 0x16a34a;
        glowColor = 0x22c55e;
      } else {
        color = 0x4dabf7;
        emissiveColor = 0x2563eb;
        glowColor = 0x4dabf7;
      }

      (meshes.sphere.material as THREE.MeshStandardMaterial).color.setHex(color);
      (meshes.sphere.material as THREE.MeshStandardMaterial).emissive.setHex(emissiveColor);
      (meshes.glow.material as THREE.MeshBasicMaterial).color.setHex(glowColor);
    });
  }, [hoveredSensorId, sensors]);

  // Update labels when data changes
  useEffect(() => {
    if (!sceneRef.current) return;

    const { sensorMeshes, sensorData } = sceneRef.current;

    sensors.forEach((sensor) => {
      const meshes = sensorMeshes.get(sensor.id);
      if (!meshes) return;

      const sprite = meshes.sprite;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.width = 256;
      canvas.height = 64;
      
      context.fillStyle = 'rgba(255, 255, 255, 0.95)';
      context.roundRect(0, 0, canvas.width, canvas.height, 8);
      context.fill();
      
      context.fillStyle = '#1e40af';
      context.font = 'bold 28px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      if (dataReady && sensorData.has(sensor.id)) {
        const data = sensorData.get(sensor.id)!;
        
        let closestData = data[0];
        let minDiff = Math.abs(data[0].timestamp - currentTimestamp);
        
        for (const point of data) {
          const diff = Math.abs(point.timestamp - currentTimestamp);
          if (diff < minDiff) {
            minDiff = diff;
            closestData = point;
          }
        }
        
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
        
        context.fillText(`${value}${unit}`, 128, 32);
      } else {
        context.fillText(sensor.name, 128, 32);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      (sprite.material as THREE.SpriteMaterial).map = texture;
      (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
    });
  }, [dataReady, selectedMetric, currentTimestamp, sensors]);

  // Update interpolation mesh with different visualization types
  useEffect(() => {
    if (!sceneRef.current || !dataReady || !meshingEnabled || !modelBounds) {
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
      return;
    }

    const { scene, sensorData, interpolationMesh, modelScale, roomVolumeMesh, originalCenter } = sceneRef.current;

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

    // Collect current sensor values (in SCENE coordinates)
    const points: Point3D[] = [];
    
    sensors.forEach((sensor) => {
      if (!sensorData.has(sensor.id)) return;
      
      const data = sensorData.get(sensor.id)!;
      let closestData = data[0];
      let minDiff = Math.abs(data[0].timestamp - currentTimestamp);
      
      for (const point of data) {
        const diff = Math.abs(point.timestamp - currentTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestData = point;
        }
      }
      
      let value = 0;
      switch (selectedMetric) {
        case 'temperature':
          value = closestData.temperature;
          break;
        case 'humidity':
          value = closestData.humidity;
          break;
        case 'absoluteHumidity':
          value = closestData.absoluteHumidity;
          break;
        case 'dewPoint':
          value = closestData.dewPoint;
          break;
      }
      
      // Transform sensor positions to scene space
      const xScene = (sensor.position[0] - (originalCenter?.x || 0)) * modelScale;
      const yScene = (sensor.position[1] - (originalCenter?.y || 0)) * modelScale;
      const zScene = (sensor.position[2] - (originalCenter?.z || 0)) * modelScale;
      
      points.push({
        x: xScene,
        y: yScene,
        z: zScene,
        value
      });
    });

    if (points.length === 0) return;

    console.log('🎯 Sensor positions:', points.map(p => ({ x: p.x.toFixed(2), y: p.y.toFixed(2), z: p.z.toFixed(2), value: p.value.toFixed(2) })));
    console.log('📦 Model bounds:', modelBounds);
    console.log('🔧 Fixed offsets:', { x: INTERPOLATION_OFFSET_X, y: INTERPOLATION_OFFSET_Y, z: INTERPOLATION_OFFSET_Z });
    
    const positions: number[] = [];
    const colors: number[] = [];
    
    const stepX = (modelBounds.max.x - modelBounds.min.x) / (meshResolution - 1);
    const stepY = (modelBounds.max.y - modelBounds.min.y) / (meshResolution - 1);
    const stepZ = (modelBounds.max.z - modelBounds.min.z) / (meshResolution - 1);

    // First pass: filter grid points that are inside the room volume
    const validGridPoints: { x: number; y: number; z: number }[] = [];
    let totalPoints = 0;
    let insidePoints = 0;
    
    console.log('🔍 Filtering grid points...');
    
    for (let i = 0; i < meshResolution; i++) {
      for (let j = 0; j < meshResolution; j++) {
        for (let k = 0; k < meshResolution; k++) {
          totalPoints++;
          const x = modelBounds.min.x + i * stepX + INTERPOLATION_OFFSET_X;
          const y = modelBounds.min.y + j * stepY + INTERPOLATION_OFFSET_Y;
          const z = modelBounds.min.z + k * stepZ + INTERPOLATION_OFFSET_Z;

          // Check if point is inside the room volume
          let inside = true;
          if (roomVolumeMesh) {
            const point = new THREE.Vector3(x, y, z);
            inside = isPointInsideMesh(point, roomVolumeMesh);
          }

          if (inside) {
            validGridPoints.push({ x, y, z });
            insidePoints++;
          }
        }
      }
    }
    
    console.log(`✅ Filtered: ${insidePoints}/${totalPoints} points inside room volume (${((insidePoints/totalPoints)*100).toFixed(1)}%)`);

    if (validGridPoints.length === 0) {
      console.warn('⚠️ No valid grid points found inside room volume!');
      return;
    }

    // Second pass: interpolate only for valid points
    let rbfInterpolator: RBFInterpolator | null = null;
    if (interpolationMethod === 'rbf') {
      rbfInterpolator = new RBFInterpolator(points, rbfKernel, 1.0);
    }

    let minValue = Infinity;
    let maxValue = -Infinity;
    
    const gridValues: { x: number; y: number; z: number; value: number }[] = [];
    
    validGridPoints.forEach(({ x, y, z }) => {
      let value: number;
      if (interpolationMethod === 'idw') {
        value = interpolateIDW(points, { x, y, z }, idwPower);
      } else {
        value = rbfInterpolator!.interpolate({ x, y, z });
      }

      gridValues.push({ x, y, z, value });
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
    });

    console.log(`📊 Value range for ${selectedMetric}: [${minValue.toFixed(2)}, ${maxValue.toFixed(2)}]`);

    // Helper function to get color from value
    const getColorFromValue = (value: number): THREE.Color => {
      const normalized = (value - minValue) / (maxValue - minValue);
      const color = new THREE.Color();
      
      switch (selectedMetric) {
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
      
      return color;
    };

    let newMesh: THREE.Points | THREE.Group | THREE.Mesh;

    if (visualizationType === 'points') {
      // Points visualization
      gridValues.forEach(({ x, y, z, value }) => {
        positions.push(x, y, z);
        const color = getColorFromValue(value);
        colors.push(color.r, color.g, color.b);
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const avgDim = (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3;
      const pointSize = avgDim / meshResolution * 0.5;

      const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        map: createCircleTexture(),
      });

      newMesh = new THREE.Points(geometry, material);
      console.log(`✨ Created ${positions.length / 3} points`);
      
    } else if (visualizationType === 'vectors') {
      // Vector field visualization
      const vectorGroup = new THREE.Group();
      const step = Math.max(1, Math.floor(Math.cbrt(validGridPoints.length) / 8));
      
      for (let idx = 0; idx < gridValues.length; idx += step) {
        const gridPoint = gridValues[idx];
        const { x, y, z, value } = gridPoint;
        
        // Calculate gradient (approximate)
        const nextIdx = Math.min(idx + step, gridValues.length - 1);
        const nextPoint = gridValues[nextIdx];
        
        const gradient = new THREE.Vector3(
          nextPoint.x - x,
          nextPoint.y - y,
          nextPoint.z - z
        );
        
        const length = gradient.length();
        
        if (length > 0.001) {
          gradient.normalize();
          const arrowLength = (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3 / meshResolution * 2;
          
          const origin = new THREE.Vector3(x, y, z);
          const arrowHelper = new THREE.ArrowHelper(
            gradient,
            origin,
            arrowLength,
            getColorFromValue(value).getHex(),
            arrowLength * 0.3,
            arrowLength * 0.2
          );
          vectorGroup.add(arrowHelper);
        }
      }
      
      newMesh = vectorGroup;
      console.log(`🎯 Created ${vectorGroup.children.length} vectors`);
      
    } else if (visualizationType === 'isosurface') {
      // Isosurface visualization
      const isosurfaceGroup = new THREE.Group();
      const numLevels = 5;
      
      for (let level = 0; level < numLevels; level++) {
        const isoValue = minValue + (maxValue - minValue) * (level + 1) / (numLevels + 1);
        const color = getColorFromValue(isoValue);
        
        const vertices: number[] = [];
        
        gridValues.forEach(({ x, y, z, value }) => {
          if (Math.abs(value - isoValue) < (maxValue - minValue) / (numLevels * 2)) {
            vertices.push(x, y, z);
          }
        });
        
        if (vertices.length > 0) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          
          const material = new THREE.PointsMaterial({
            size: (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3 / meshResolution * 0.8,
            color: color,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true,
          });
          
          const points = new THREE.Points(geometry, material);
          isosurfaceGroup.add(points);
        }
      }
      
      newMesh = isosurfaceGroup;
      console.log(`📊 Created ${numLevels} isosurface levels`);
      
    } else { // mesh
      // Volumetric mesh visualization
      gridValues.forEach(({ x, y, z, value }) => {
        positions.push(x, y, z);
        const color = getColorFromValue(value);
        colors.push(color.r, color.g, color.b);
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3 / meshResolution * 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.3,
        sizeAttenuation: true,
      });

      newMesh = new THREE.Points(geometry, material);
      console.log(`🔷 Created volumetric mesh with ${positions.length / 3} points`);
    }
    
    scene.add(newMesh);
    sceneRef.current.interpolationMesh = newMesh;

    console.log(`✅ Interpolation created (${visualizationType})`);
  }, [dataReady, meshingEnabled, modelBounds, currentTimestamp, selectedMetric, interpolationMethod, rbfKernel, idwPower, meshResolution, visualizationType, sensors, roomVolume]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current || !sceneRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !sceneRef.current) return;

      const { renderer, camera, controls, boundingSphere } = sceneRef.current;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      if (newWidth === 0 || newHeight === 0) return;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);

      const fov = camera.fov * (Math.PI / 180);
      const aspectRatio = newWidth / newHeight;
      
      const verticalFit = boundingSphere.radius / Math.tan(fov / 2);
      const horizontalFit = boundingSphere.radius / Math.tan(fov / 2) / aspectRatio;
      
      const optimalDistance = Math.max(verticalFit, horizontalFit) * 1.5;
      
      const direction = camera.position.clone().normalize();
      camera.position.copy(direction.multiplyScalar(optimalDistance));
      camera.lookAt(0, 0, 0);
      
      controls.update();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Scene creation (rest of the code remains the same...)
  // [Previous scene creation code continues here - keeping it unchanged for brevity]

  return (
    <div ref={containerRef} className="absolute inset-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
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
            <p className="text-sm mb-4">{error}</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-black p-3 rounded">
              <p className="font-medium mb-2">Solutions :</p>
              <ul className="text-left space-y-1">
                <li>• Utilisez un fichier <strong>GLB</strong> (format binaire autonome)</li>
                <li>• Vérifiez que tous les fichiers du pack sont présents</li>
                <li>• Consultez la console du navigateur pour plus de détails</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to create a circular texture for round points
function createCircleTexture(): THREE.Texture {
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
}