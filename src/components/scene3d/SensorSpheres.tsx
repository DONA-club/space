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
  originalCenter: THREE.Vector3 | null = null,
  modelPosition: THREE.Vector3 | null = null
): Map<number, SensorMeshes> => {
  const sensorMeshes = new Map<number, SensorMeshes>();
  
  console.log('🎯 Creating sensor spheres with:');
  console.log('   Model scale:', modelScale);
  console.log('   Original center:', originalCenter?.toArray());
  console.log('   Model position (NOT USED):', modelPosition?.toArray());
  
  sensors.forEach((sensor) => {
    // Apply ONLY centering and scale (same as model)
    // DO NOT add model position - the model is at origin (0,0,0) after centering
    const x = (sensor.position[0] - (originalCenter?.x || 0)) * modelScale;
    const y = (sensor.position[1] - (originalCenter?.y || 0)) * modelScale;
    const z = (sensor.position[2] - (originalCenter?.z || 0)) * modelScale;
    
    const transformedPosition = new THREE.Vector3(x, y, z);
    
    console.log(`   Sensor ${sensor.name}:`);
    console.log(`      Original: [${sensor.position.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`      After centering & scale: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]`);
    
    const initialColor = 0x4dabf7;
    const initialEmissive = 0x2563eb;
    
    // Sphere - slightly larger for better visibility
    const geometry = new THREE.SphereGeometry(0.12, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: initialColor,
      emissive: initialEmissive,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.15,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(transformedPosition);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    // Glow - larger and more visible
    const glowGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: initialColor,
      transparent: true,
      opacity: 0.4,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(transformedPosition);

    // Label sprite - larger and more readable
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = 256;
      canvas.height = 96;
      
      // Better shadow for readability
      context.shadowColor = 'rgba(0, 0, 0, 0.9)';
      context.shadowBlur = 6;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      
      context.fillStyle = '#ffffff';
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(sensor.name, 128, 48);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false, // Always visible
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(transformedPosition);
      sprite.position.y += 0.5; // Position above sphere
      sprite.scale.set(1.2, 0.3, 1); // Larger scale

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

  canvas.width = 256;
  canvas.height = 96;
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  // Better shadow for readability
  context.shadowColor = 'rgba(0, 0, 0, 0.9)';
  context.shadowBlur = 6;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;
  
  context.fillStyle = '#ffffff';
  context.font = 'bold 56px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${value}${unit}`, 128, 48);
  
  const texture = new THREE.CanvasTexture(canvas);
  (sprite.material as THREE.SpriteMaterial).map = texture;
  (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
};