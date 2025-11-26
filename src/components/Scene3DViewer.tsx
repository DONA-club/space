"use client";

import { useEffect, useRef, useState } from "react";
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
  const gltfModel = useAppStore((state) => state.gltfModel);
  const sensors = useAppStore((state) => state.sensors);

  useEffect(() => {
    if (!containerRef.current || !gltfModel) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

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

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

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

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.4);
    pointLight.position.set(-10, -10, -5);
    scene.add(pointLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1;
    controls.minDistance = 2;
    controls.maxDistance = 20;

    // Load GLTF Model
    const loader = new GLTFLoader();

    loader.load(
      gltfModel,
      (gltf) => {
        setError(null);
        
        // Center and scale the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        
        gltf.scene.scale.multiplyScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));
        
        scene.add(gltf.scene);
      },
      (progress) => {
        if (progress.total > 0) {
          console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        }
      },
      (err) => {
        console.error("Error loading GLTF:", err);
        setError("Le fichier GLTF référence des ressources externes manquantes (textures, .bin). Veuillez utiliser un fichier GLB autonome ou fournir tous les fichiers associés.");
      }
    );

    // Add sensor markers
    const sensorGroup = new THREE.Group();
    sensors.forEach((sensor) => {
      const geometry = new THREE.SphereGeometry(0.15, 16, 16);
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
        sprite.position.set(sensor.position[0], sensor.position[1] + 0.3, sensor.position[2]);
        sprite.scale.set(0.5, 0.125, 1);
        sensorGroup.add(sprite);
      }
    });
    scene.add(sensorGroup);

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

  if (!gltfModel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Chargez un modèle 3D pour commencer</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6">
        <div className="text-center text-red-600 dark:text-red-400 max-w-md">
          <AlertCircle size={48} className="mx-auto mb-4" />
          <p className="font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm mb-4">{error}</p>
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-black p-3 rounded">
            <p className="font-medium mb-2">Solutions :</p>
            <ul className="text-left space-y-1">
              <li>• Utilisez un fichier <strong>GLB</strong> (format binaire autonome)</li>
              <li>• Ou convertissez votre GLTF en GLB avec un outil en ligne</li>
              <li>• Ou fournissez tous les fichiers .bin et textures associés</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
  );
};