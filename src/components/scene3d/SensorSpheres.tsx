import * as THREE from 'three';

interface Sensor {
  id: number;
  position: [number, number, number];
  name: string;
}

export interface SensorMeshes {
  sphere: THREE.Mesh;
  glow: THREE.Mesh;
  sprite: THREE.Sprite;
}

export const createSensorSpheres = (
  sensors: Sensor[],
  modelScale: number,
  originalCenter: THREE.Vector3 | null = null
): Map<number, SensorMeshes> => {
  const sensorMeshes = new Map<number, SensorMeshes>();
  
  sensors.forEach((sensor) => {
    // Apply the same transformation as the model
    const x = (sensor.position[0] - (originalCenter?.x || 0)) * modelScale;
    const y = (sensor.position[1] - (originalCenter?.y || 0)) * modelScale;
    const z = (sensor.position[2] - (originalCenter?.z || 0)) * modelScale;
    
    const transformedPosition = new THREE.Vector3(x, y, z);
    
    const initialColor = 0x4dabf7;
    const initialEmissive = 0x2563eb;
    
    // Sphere
    const geometry = new THREE.SphereGeometry(0.075, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: initialColor,
      emissive: initialEmissive,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.2,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(transformedPosition);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    // Glow
    const glowGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: initialColor,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(transformedPosition);

    // Label sprite
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = 128;
      canvas.height = 48;
      
      context.shadowColor = 'rgba(0, 0, 0, 0.8)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 1;
      context.shadowOffsetY = 1;
      
      context.fillStyle = '#ffffff';
      context.font = 'bold 20px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(sensor.name, 64, 24);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(transformedPosition);
      sprite.position.y += 0.4;
      sprite.scale.set(0.8, 0.2, 1);

      sensorMeshes.set(sensor.id, { sphere, glow, sprite });
    }
  });
  
  return sensorMeshes;
};

export const updateSensorLabel = (
  sprite: THREE.Sprite,
  value: string,
  unit: string
) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) return;

  canvas.width = 128;
  canvas.height = 48;
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.shadowColor = 'rgba(0, 0, 0, 0.8)';
  context.shadowBlur = 4;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;
  
  context.fillStyle = '#ffffff';
  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${value}${unit}`, 64, 24);
  
  const texture = new THREE.CanvasTexture(canvas);
  (sprite.material as THREE.SpriteMaterial).map = texture;
  (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
};