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

  // Calculate steps - ensure at least 2 points per dimension
  const stepsX = Math.max(2, Math.ceil(size.x / resolution));
  const stepsY = Math.max(2, Math.ceil(size.y / resolution));
  const stepsZ = Math.max(2, Math.ceil(size.z / resolution));

  // Calculate actual step sizes
  const stepX = size.x / (stepsX - 1);
  const stepY = size.y / (stepsY - 1);
  const stepZ = size.z / (stepsZ - 1);

  const totalPoints = stepsX * stepsY * stepsZ;
  const points = new Float32Array(totalPoints * 3);

  console.log(`🔢 Generating grid: ${stepsX}×${stepsY}×${stepsZ} = ${totalPoints.toLocaleString()} points`);
  console.log(`📏 Step sizes: X=${stepX.toFixed(3)}m, Y=${stepY.toFixed(3)}m, Z=${stepZ.toFixed(3)}m`);
  console.log(`📦 Bounds: min=[${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)}], max=[${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)}]`);

  let index = 0;
  for (let i = 0; i < stepsX; i++) {
    for (let j = 0; j < stepsY; j++) {
      for (let k = 0; k < stepsZ; k++) {
        const x = min.x + i * stepX;
        const y = min.y + j * stepY;
        const z = min.z + k * stepZ;
        
        points[index++] = x;
        points[index++] = y;
        points[index++] = z;
      }
    }
  }

  // Verify no NaN values
  let hasNaN = false;
  for (let i = 0; i < points.length; i++) {
    if (isNaN(points[i])) {
      hasNaN = true;
      console.error(`❌ NaN detected at index ${i}`);
    }
  }
  
  if (hasNaN) {
    console.error('❌ Grid contains NaN values!');
  } else {
    console.log('✅ Grid generated successfully without NaN');
  }

  return points;
}