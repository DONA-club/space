"use client";

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import { useAppStore } from '@/store/appStore';
import * as THREE from 'three';

const SensorMarker = ({ position, name, id }: { position: [number, number, number]; name: string; id: number }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial 
          color={hovered ? "#ff6b6b" : "#4dabf7"} 
          emissive={hovered ? "#ff6b6b" : "#4dabf7"}
          emissiveIntensity={0.5}
        />
      </mesh>
      {hovered && (
        <Html distanceFactor={10}>
          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
            {name}
          </div>
        </Html>
      )}
    </group>
  );
};

const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.rotation.y += 0.002;
    }
  });

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
          }
        }
      });
    }
  }, [scene]);

  return <primitive ref={modelRef} object={scene} />;
};

export const Scene3DViewer = () => {
  const gltfModel = useAppStore((state) => state.gltfModel);
  const sensors = useAppStore((state) => state.sensors);

  if (!gltfModel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Chargez un modèle 3D pour commencer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <Model url={gltfModel} />
        
        {sensors.map((sensor) => (
          <SensorMarker
            key={sensor.id}
            position={sensor.position}
            name={sensor.name}
            id={sensor.id}
          />
        ))}
        
        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          autoRotate={false}
        />
        
        <gridHelper args={[20, 20]} />
      </Canvas>
    </div>
  );
};