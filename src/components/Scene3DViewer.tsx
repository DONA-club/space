"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AlertCircle } from "lucide-react";
import { interpolateIDW, RBFInterpolator, type Point3D } from "@/utils/interpolation";

// Helper function to check if a point is inside a mesh
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
    interpolationMesh: THREE.Points | null;
    isosurfaceMesh: THREE.Mesh | null;
    modelScale: number;
    roomMesh: THREE.Mesh | null;
    modelGroup: THREE.Group | null;
    originalCenter: THREE.Vector3 | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelBounds, setModelBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);
  const gltfModel = useAppStore((state) => state.gltfModel);
  const sensors = useAppStore((state) => state.sensors);
  const dataReady = useAppStore((state) => state.dataReady);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
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

  // Update interpolation mesh with volumetric visualization
  useEffect(() => {
    if (!sceneRef.current || !dataReady || !meshingEnabled || !modelBounds) {
      if (sceneRef.current?.interpolationMesh) {
        sceneRef.current.scene.remove(sceneRef.current.interpolationMesh);
        sceneRef.current.interpolationMesh.geometry.dispose();
        (sceneRef.current.interpolationMesh.material as THREE.PointsMaterial).dispose();
        sceneRef.current.interpolationMesh = null;
      }
      if (sceneRef.current?.isosurfaceMesh) {
        sceneRef.current.scene.remove(sceneRef.current.isosurfaceMesh);
        sceneRef.current.isosurfaceMesh.geometry.dispose();
        (sceneRef.current.isosurfaceMesh.material as THREE.Material).dispose();
        sceneRef.current.isosurfaceMesh = null;
      }
      return;
    }

    const { scene, sensorData, interpolationMesh, isosurfaceMesh, modelScale, roomMesh, originalCenter } = sceneRef.current;

    if (interpolationMesh) {
      scene.remove(interpolationMesh);
      interpolationMesh.geometry.dispose();
      (interpolationMesh.material as THREE.PointsMaterial).dispose();
    }
    if (isosurfaceMesh) {
      scene.remove(isosurfaceMesh);
      isosurfaceMesh.geometry.dispose();
      (isosurfaceMesh.material as THREE.Material).dispose();
    }

    // Collect current sensor values (in ORIGINAL coordinates)
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
      
      // Use ORIGINAL sensor positions (before transformation)
      points.push({
        x: sensor.position[0],
        y: sensor.position[1],
        z: sensor.position[2],
        value
      });
    });

    if (points.length === 0) return;

    // Use ORIGINAL bounds (before centering and scaling)
    // We need to reverse the transformation to get original bounds
    const originalBounds = {
      minX: (modelBounds.min.x / modelScale) + (originalCenter?.x || 0),
      maxX: (modelBounds.max.x / modelScale) + (originalCenter?.x || 0),
      minY: (modelBounds.min.y / modelScale) + (originalCenter?.y || 0),
      maxY: (modelBounds.max.y / modelScale) + (originalCenter?.y || 0),
      minZ: (modelBounds.min.z / modelScale) + (originalCenter?.z || 0),
      maxZ: (modelBounds.max.z / modelScale) + (originalCenter?.z || 0),
    };
    
    console.log('📦 Original bounds for interpolation:', originalBounds);
    console.log('🎯 Selected metric:', selectedMetric);
    console.log('📊 Sensor values:', points.map(p => p.value));
    
    const positions: number[] = [];
    const colors: number[] = [];
    
    const stepX = (originalBounds.maxX - originalBounds.minX) / (meshResolution - 1);
    const stepY = (originalBounds.maxY - originalBounds.minY) / (meshResolution - 1);
    const stepZ = (originalBounds.maxZ - originalBounds.minZ) / (meshResolution - 1);

    let rbfInterpolator: RBFInterpolator | null = null;
    if (interpolationMethod === 'rbf') {
      rbfInterpolator = new RBFInterpolator(points, rbfKernel, 1.0);
    }

    let minValue = Infinity;
    let maxValue = -Infinity;
    
    const gridValues: { x: number; y: number; z: number; value: number; inside: boolean }[] = [];
    
    // First pass: calculate all values in ORIGINAL space and find min/max
    for (let i = 0; i < meshResolution; i++) {
      for (let j = 0; j < meshResolution; j++) {
        for (let k = 0; k < meshResolution; k++) {
          // Position in ORIGINAL space
          const xOrig = originalBounds.minX + i * stepX;
          const yOrig = originalBounds.minY + j * stepY;
          const zOrig = originalBounds.minZ + k * stepZ;

          // Transform to scene space for inside test
          const xScene = (xOrig - (originalCenter?.x || 0)) * modelScale;
          const yScene = (yOrig - (originalCenter?.y || 0)) * modelScale;
          const zScene = (zOrig - (originalCenter?.z || 0)) * modelScale;

          // Check if point is inside the room mesh (in scene space)
          let inside = true;
          if (roomMesh) {
            const point = new THREE.Vector3(xScene, yScene, zScene);
            inside = isPointInsideMesh(point, roomMesh);
          }

          // Interpolate in ORIGINAL space
          let value: number;
          if (interpolationMethod === 'idw') {
            value = interpolateIDW(points, { x: xOrig, y: yOrig, z: zOrig }, idwPower);
          } else {
            value = rbfInterpolator!.interpolate({ x: xOrig, y: yOrig, z: zOrig });
          }

          gridValues.push({ x: xScene, y: yScene, z: zScene, value, inside });
          
          if (inside) {
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
          }
        }
      }
    }

    console.log(`📊 Value range for ${selectedMetric}: [${minValue.toFixed(2)}, ${maxValue.toFixed(2)}]`);

    // Second pass: create geometry with enhanced colors (only for points inside)
    gridValues.forEach(({ x, y, z, value, inside }) => {
      if (!inside) return;
      
      // Use scene space positions for rendering
      positions.push(x, y, z);
      
      // Normalize value to 0-1
      const normalized = (value - minValue) / (maxValue - minValue);
      
      // Enhanced color gradient with HIGH saturation
      const color = new THREE.Color();
      
      switch (selectedMetric) {
        case 'temperature':
          // Blue (cold) → Yellow → Red (hot)
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
      
      colors.push(color.r, color.g, color.b);
    });

    console.log(`✨ Created ${positions.length / 3} interpolation points (inside room only)`);

    // Create point cloud geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Smaller points
    const avgDim = (modelBounds.size.x + modelBounds.size.y + modelBounds.size.z) / 3;
    const pointSize = avgDim / meshResolution * 0.5;

    // Material with round points and transparency
    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      map: createCircleTexture(),
    });

    const newMesh = new THREE.Points(geometry, material);
    
    // NO transformation needed - positions are already in scene space
    
    scene.add(newMesh);
    sceneRef.current.interpolationMesh = newMesh;

    console.log(`✅ Interpolation mesh created with ${positions.length / 3} points, aligned with model`);
  }, [dataReady, meshingEnabled, modelBounds, currentTimestamp, selectedMetric, interpolationMethod, rbfKernel, idwPower, meshResolution, sensors]);

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

  // Scene creation
  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (!gltfModel) {
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) {
      console.warn('Container has zero dimensions, waiting...');
      return;
    }

    setLoading(true);
    setError(null);
    setModelLoaded(false);
    setModelBounds(null);

    const loadingTimeout = setTimeout(() => {
      setError('Le chargement du modèle a pris trop de temps. Vérifiez que tous les fichiers nécessaires sont présents.');
      setLoading(false);
    }, 30000);

    if (sceneRef.current) {
      const { renderer, scene, controls, animationId, interpolationMesh, isosurfaceMesh } = sceneRef.current;
      cancelAnimationFrame(animationId);
      controls.dispose();
      
      if (interpolationMesh) {
        scene.remove(interpolationMesh);
        interpolationMesh.geometry.dispose();
        (interpolationMesh.material as THREE.PointsMaterial).dispose();
      }
      
      if (isosurfaceMesh) {
        scene.remove(isosurfaceMesh);
        isosurfaceMesh.geometry.dispose();
        (isosurfaceMesh.material as THREE.Material).dispose();
      }
      
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.Fog(0xf0f4f8, 20, 100);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.8);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffa07a, 0.6);
    backLight.position.set(0, 5, -15);
    scene.add(backLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0xf0e68c, 0.6);
    scene.add(hemisphereLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 1.5;

    const sensorMeshes = new Map<number, { sphere: THREE.Mesh; glow: THREE.Mesh; sprite: THREE.Sprite }>();
    const sensorData = new Map();

    const loader = new GLTFLoader();

    let boundingSphere = new THREE.Sphere();
    let modelScale = 1;
    let roomMesh: THREE.Mesh | null = null;
    let modelGroup: THREE.Group | null = null;
    let originalCenter: THREE.Vector3 | null = null;

    loader.load(
      gltfModel,
      (gltf) => {
        clearTimeout(loadingTimeout);
        setError(null);
        setLoading(false);
        
        const originalBox = new THREE.Box3().setFromObject(gltf.scene);
        originalCenter = originalBox.getCenter(new THREE.Vector3());
        const originalSize = originalBox.getSize(new THREE.Vector3());
        
        console.log('📦 Original model bounds:', {
          min: originalBox.min,
          max: originalBox.max,
          center: originalCenter,
          size: originalSize
        });
        
        let hasGeometry = false;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            hasGeometry = true;
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (!roomMesh) {
              roomMesh = child;
            }
          }
        });
        
        if (!hasGeometry) {
          setError('Le modèle ne contient pas de géométrie visible');
          return;
        }
        
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
        
        console.log('📦 Scaled model bounds:', scaledBounds);
        setModelBounds(scaledBounds);
        
        modelGroup = gltf.scene;
        scene.add(gltf.scene);
        
        const sensorGroup = new THREE.Group();
        sensorGroup.position.copy(gltf.scene.position);
        sensorGroup.scale.copy(gltf.scene.scale);
        
        sensors.forEach((sensor) => {
          const originalPosition = new THREE.Vector3(
            sensor.position[0],
            sensor.position[1],
            sensor.position[2]
          );
          
          const hasCSV = !!sensor.csvFile;
          const initialColor = hasCSV ? 0x22c55e : 0x4dabf7;
          const initialEmissive = hasCSV ? 0x16a34a : 0x2563eb;
          
          const geometry = new THREE.SphereGeometry(0.15, 32, 32);
          const material = new THREE.MeshStandardMaterial({
            color: initialColor,
            emissive: initialEmissive,
            emissiveIntensity: 0.4,
            metalness: 0.6,
            roughness: 0.2,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.copy(originalPosition);
          sphere.castShadow = true;
          sphere.receiveShadow = true;
          sensorGroup.add(sphere);

          const glowGeometry = new THREE.SphereGeometry(0.2, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: initialColor,
            transparent: true,
            opacity: 0.3,
          });
          const glow = new THREE.Mesh(glowGeometry, glowMaterial);
          glow.position.copy(originalPosition);
          sensorGroup.add(glow);

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          let sprite: THREE.Sprite;
          
          if (context) {
            canvas.width = 256;
            canvas.height = 64;
            context.fillStyle = 'rgba(255, 255, 255, 0.95)';
            context.roundRect(0, 0, canvas.width, canvas.height, 8);
            context.fill();
            context.fillStyle = '#1e40af';
            context.font = 'bold 28px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(sensor.name, 128, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
              map: texture,
              transparent: true,
            });
            sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(originalPosition);
            sprite.position.y += 0.5 / modelScale;
            sprite.scale.set(1.2 / modelScale, 0.3 / modelScale, 1);
            sensorGroup.add(sprite);

            sensorMeshes.set(sensor.id, { sphere, glow, sprite });
          }
        });
        
        scene.add(sensorGroup);
        
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
        console.log('✅ Model loaded successfully');
      },
      undefined,
      (err) => {
        clearTimeout(loadingTimeout);
        console.error("Error loading GLTF:", err);
        setError("Erreur lors du chargement du modèle 3D. Vérifiez que tous les fichiers nécessaires sont présents et correctement formatés.");
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
      sensorData,
      interpolationMesh: null,
      isosurfaceMesh: null,
      modelScale,
      roomMesh,
      modelGroup,
      originalCenter
    };

    return () => {
      clearTimeout(loadingTimeout);
      
      if (sceneRef.current) {
        const { renderer, scene, controls, animationId, interpolationMesh, isosurfaceMesh } = sceneRef.current;
        cancelAnimationFrame(animationId);
        controls.dispose();
        
        if (interpolationMesh) {
          scene.remove(interpolationMesh);
          interpolationMesh.geometry.dispose();
          (interpolationMesh.material as THREE.PointsMaterial).dispose();
        }
        
        if (isosurfaceMesh) {
          scene.remove(isosurfaceMesh);
          isosurfaceMesh.geometry.dispose();
          (isosurfaceMesh.material as THREE.Material).dispose();
        }
        
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
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