import * as THREE from 'three';

export interface GridOptions {
  resolution: number;
  bounds: THREE.Box3;
}

export function generateGridFromBounds(
  bounds: THREE.Box3,
  resolution: number
): Float32Array {
  const min = bounds.min;
  const max = bounds.max;
  const size = bounds.getSize(new THREE.Vector3());

  // Calculate steps
  const stepsX = Math.ceil(size.x / resolution);
  const stepsY = Math.ceil(size.y / resolution);
  const stepsZ = Math.ceil(size.z / resolution);

  const stepX = size.x / (stepsX - 1);
  const stepY = size.y / (stepsY - 1);
  const stepZ = size.z / (stepsZ - 1);

  const totalPoints = stepsX * stepsY * stepsZ;
  const points = new Float32Array(totalPoints * 3);

  console.log(`🔢 Generating grid: ${stepsX}×${stepsY}×${stepsZ} = ${totalPoints.toLocaleString()} points`);

  let index = 0;
  for (let i = 0; i < stepsX; i++) {
    for (let j = 0; j < stepsY; j++) {
      for (let k = 0; k < stepsZ; k++) {
        points[index++] = min.x + i * stepX;
        points[index++] = min.y + j * stepY;
        points[index++] = min.z + k * stepZ;
      }
    }
  }

  return points;
}