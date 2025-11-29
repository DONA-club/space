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
  modelScale: number
): Map<number, SensorMeshes> => {
  const sensorMeshes = new Map<number, SensorMeshes>();
  const sensorGroup = new THREE.Group();
  
  sensors.forEach((sensor) => {
    const originalPosition = new THREE.Vector3(
      sensor.position[0],
      sensor.position[1],
      sensor.position[2]
    );
    
    const initialColor = 0x4dabf7;
    const initialEmissive = 0x2563eb;
    
    const geometry = new THREE.SphereGeometry(0.075, 32, 32);
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

    const glowGeometry = new THREE.SphereGeometry(0.1, 16, 16);
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
      sprite.position.copy(originalPosition);
      sprite.position.y += 0.4 / modelScale;
      sprite.scale.set(0.8 / modelScale, 0.2 / modelScale, 1);
      sensorGroup.add(sprite);

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