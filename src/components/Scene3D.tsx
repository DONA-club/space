"use client";

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useState } from 'react';
import { useAppStore } from '@/store/appStore';

interface SensorMarkerProps {
  position: [number, number, number];
  id: number;
  data?: any;
  onClick: () => void;
}

const SensorMarker = ({ position, id, data, onClick }: SensorMarkerProps) => {
  const [hovered, setHovered] = useState(false);
  
  const getColor = () => {
    if (!data) return '#3b82f6';
    const temp = data.temperature;
    const hue = ((30 - temp) / 60) * 240;
    return `hsl(${hue}, 100%, 50%)`;
  };

  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.2 : 1}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial 
          color={getColor()} 
          emissive={getColor()}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {data && hovered && (
        <mesh position={[0, 0.3, 0]}>
          <planeGeometry args={[0.5, 0.3]} />
          <meshBasicMaterial color="white" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
};

const RoomBox = () => {
  return (
    <>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[6, 3, 4.5]} />
        <meshStandardMaterial 
          color="#e0e0e0" 
          transparent 
          opacity={0.1}
          wireframe
        />
      </mesh>
      
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4.5]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      
      <gridHelper args={[10, 10, '#cccccc', '#eeeeee']} position={[0, -0.5, 0]} />
    </>
  );
};

const Scene = () => {
  const sensors = useAppStore((state) => state.sensors);
  const [selectedSensor, setSelectedSensor] = useState<number | null>(null);

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 3, 5]} />
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={15}
      />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      <hemisphereLight color="#ffffff" groundColor="#444444" intensity={0.6} />
      
      <RoomBox />
      
      {sensors.map((sensor) => (
        <SensorMarker
          key={sensor.id}
          position={sensor.position}
          id={sensor.id}
          data={sensor.currentData}
          onClick={() => setSelectedSensor(sensor.id)}
        />
      ))}
    </>
  );
};

export const Scene3D = () => {
  return (
    <div className="w-full h-full">
      <Canvas>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
};