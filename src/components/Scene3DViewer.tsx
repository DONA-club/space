"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useAppStore } from "@/store/appStore";
import * as THREE from "three";

type SensorMarkerProps = {
  position: [number, number, number];
};

const SensorMarker = ({ position }: SensorMarkerProps) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial
        color="#4dabf7"
        emissive="#4dabf7"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
};

type ModelProps = {
  url: string;
};

const Model = ({ url }: ModelProps) => {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

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
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />

        <Model url={gltfModel} />

        {sensors.map((sensor) => (
          <SensorMarker key={sensor.id} position={sensor.position} />
        ))}

        <OrbitControls enableDamping dampingFactor={0.05} autoRotate />
      </Canvas>
    </div>
  );
};