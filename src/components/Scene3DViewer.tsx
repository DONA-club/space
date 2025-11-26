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

    setLoading(true);
    setError(null);

    const loadingTimeout = setTimeout(() => {
      setError('Le chargement du modèle a pris trop de temps. Vérifiez que tous les fichiers nécessaires sont présents.');
      setLoading(false);
    }, 30000);

    // Cleanup previous scene if exists
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

    // Scene with gradient background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    scene.fog = new THREE.Fog(0xf0f4f8, 20, 100);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(8, 6, 8);

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Enhanced lighting
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

    // Controls with auto-rotate
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 1.5;

    // Load GLTF Model
    const loader = new GLTFLoader();

    loader.load(
      gltfModel,
      (gltf) => {
        clearTimeout(loadingTimeout);
        setError(null);
        setLoading(false);
        
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Check if model has geometry
        let hasGeometry = false;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            hasGeometry = true;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        if (!hasGeometry) {
          setError('Le modèle ne contient pas de géométrie visible');
          return;
        }
        
        // Center the model
        gltf.scene.position.sub(center);
        
        // Scale the model to fit in view
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 10 / maxDim : 1;
        gltf.scene.scale.multiplyScalar(scale);
        
        scene.add(gltf.scene);
        
        // Add sensor markers - apply transformations to the group itself
        const sensorGroup = new THREE.Group();
        
        // Apply the same transformations to the sensor group
        sensorGroup.position.copy(gltf.scene.position);
        sensorGroup.scale.copy(gltf.scene.scale);
        
        sensors.forEach((sensor) => {
          // Use original sensor positions (before transformation)
          const originalPosition = new THREE.Vector3(
            sensor.position[0],
            sensor.position[1],
            sensor.position[2]
          );
          
          // Apply center offset to the original position
          originalPosition.sub(center);
          
          // Sphere marker
          const geometry = new THREE.SphereGeometry(0.15, 32, 32);
          const material = new THREE.MeshStandardMaterial({
            color: 0x4dabf7,
            emissive: 0x2563eb,
            emissiveIntensity: 0.4,
            metalness: 0.6,
            roughness: 0.2,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.copy(originalPosition);
          sphere.castShadow = true;
          sphere.receiveShadow = true;
          sensorGroup.add(sphere);

          // Glow effect
          const glowGeometry = new THREE.SphereGeometry(0.2, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4dabf7,
            transparent: true,
            opacity: 0.3,
          });
          const glow = new THREE.Mesh(glowGeometry, glowMaterial);
          glow.position.copy(originalPosition);
          sensorGroup.add(glow);

          // Label
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
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
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(originalPosition);
            sprite.position.y += 0.5 / scale; // Adjust label offset based on scale
            sprite.scale.set(1.2 / scale, 0.3 / scale, 1); // Adjust label size based on scale
            sensorGroup.add(sprite);
          }
        });
        
        scene.add(sensorGroup);
        
        // Position camera to see the model
        const distance = maxDim * 1.2;
        camera.position.set(distance, distance * 0.75, distance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      (err) => {
        clearTimeout(loadingTimeout);
        console.error("Error loading GLTF:", err);
        setError("Erreur lors du chargement du modèle 3D. Vérifiez que tous les fichiers nécessaires sont présents et correctement formatés.");
        setLoading(false);
      }
    );

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