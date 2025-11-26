"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AlertCircle } from "lucide-react";

export const Scene3DViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animationId: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const gltfModel = useAppStore((state) => state.gltfModel);
  const sensors = useAppStore((state) => state.sensors);

  console.log('🎬 Scene3DViewer render - gltfModel:', gltfModel);
  console.log('🎬 Scene3DViewer render - sensors:', sensors);

  useLayoutEffect(() => {
    console.log('🔄 useLayoutEffect triggered - gltfModel:', gltfModel);
    console.log('🔄 useLayoutEffect triggered - containerRef.current:', containerRef.current);

    if (!containerRef.current) {
      console.warn('⚠️ Container ref is null');
      return;
    }

    if (!gltfModel) {
      console.warn('⚠️ No GLTF model URL provided');
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    console.log('📐 Container dimensions:', { width, height });

    setLoading(true);
    setError(null);

    // Timeout pour détecter les chargements bloqués
    const loadingTimeout = setTimeout(() => {
      console.error('⏱️ Loading timeout - model took too long to load');
      setError('Le chargement du modèle a pris trop de temps. Vérifiez que tous les fichiers nécessaires sont présents.');
      setLoading(false);
    }, 30000); // 30 secondes

    // Cleanup previous scene if exists
    if (sceneRef.current) {
      console.log('🧹 Cleaning up previous scene');
      const { renderer, scene, controls, animationId } = sceneRef.current;
      cancelAnimationFrame(animationId);
      controls.dispose();
      
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

    console.log('🎨 Creating new scene');

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e0e0);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    console.log('✅ Renderer created and appended to container');

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-10, -10, -5);
    scene.add(pointLight);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    console.log('💡 Lights and helpers added');

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;

    console.log('🎮 Controls initialized');

    // Load GLTF Model
    const loader = new GLTFLoader();

    console.log('🔄 Starting to load GLTF from:', gltfModel);

    loader.load(
      gltfModel,
      (gltf) => {
        clearTimeout(loadingTimeout);
        console.log('✅ GLTF loaded successfully');
        console.log('Scene:', gltf.scene);
        console.log('Animations:', gltf.animations);
        
        setError(null);
        setLoading(false);
        
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log('Model center:', center);
        console.log('Model size:', size);
        console.log('Model bounds:', { min: box.min, max: box.max });
        
        // Check if model has geometry
        let hasGeometry = false;
        let meshCount = 0;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            hasGeometry = true;
            meshCount++;
            console.log('Mesh found:', child.name, 'vertices:', child.geometry.attributes.position.count);
          }
        });
        
        console.log(`Total meshes found: ${meshCount}`);
        
        if (!hasGeometry) {
          console.warn('⚠️ No geometry found in the model');
          setError('Le modèle ne contient pas de géométrie visible');
          return;
        }
        
        // Center the model
        gltf.scene.position.sub(center);
        
        // Scale the model to fit in view
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 10 / maxDim;
          gltf.scene.scale.multiplyScalar(scale);
          console.log('Applied scale:', scale);
        }
        
        scene.add(gltf.scene);
        
        // Position camera to see the model
        const distance = maxDim * 1.5;
        camera.position.set(distance, distance, distance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        
        console.log('Camera position:', camera.position);
        console.log('Camera looking at:', controls.target);
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total * 100).toFixed(2);
          console.log('Loading progress:', percent + '%');
        } else {
          console.log('Loading progress:', progress.loaded, 'bytes loaded');
        }
      },
      (err) => {
        clearTimeout(loadingTimeout);
        console.error("❌ Error loading GLTF:", err);
        setError("Erreur lors du chargement du modèle 3D. Vérifiez que tous les fichiers nécessaires sont présents et correctement formatés.");
        setLoading(false);
      }
    );

    // Add sensor markers
    const sensorGroup = new THREE.Group();
    sensors.forEach((sensor) => {
      const geometry = new THREE.SphereGeometry(0.2, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: 0x4dabf7,
        emissive: 0x4dabf7,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.4,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(sensor.position[0], sensor.position[1], sensor.position[2]);
      sphere.castShadow = true;
      sensorGroup.add(sphere);

      // Add label
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = 256;
        canvas.height = 64;
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'black';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.fillText(sensor.name, 128, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(sensor.position[0], sensor.position[1] + 0.5, sensor.position[2]);
        sprite.scale.set(1, 0.25, 1);
        sensorGroup.add(sprite);
      }
      
      console.log('Added sensor:', sensor.name, 'at', sensor.position);
    });
    scene.add(sensorGroup);

    console.log('🎯 Sensors added to scene');

    // Animation loop
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.animationId = animationId;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    const firstAnimationId = requestAnimationFrame(animate);

    console.log('🎬 Animation loop started');

    // Store scene reference
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      animationId: firstAnimationId
    };

    // Handle resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      console.log('🧹 Cleanup function called');
      clearTimeout(loadingTimeout);
      window.removeEventListener("resize", handleResize);
      
      if (sceneRef.current) {
        const { renderer, scene, controls, animationId } = sceneRef.current;
        cancelAnimationFrame(animationId);
        controls.dispose();
        
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

  console.log('🎨 Rendering component - loading:', loading, 'error:', error, 'gltfModel:', !!gltfModel);

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden relative">
      {!gltfModel && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>Chargez un modèle 3D pour commencer</p>
          </div>
        </div>
      )}
      
      {gltfModel && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Chargement du modèle 3D...
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Consultez la console pour plus de détails
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