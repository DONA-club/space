import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Extend THREE for BVH support in worker
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

interface WorkerMessage {
  type: 'filter';
  points: Float32Array;
  geometryData: {
    position: Float32Array;
    index: Uint32Array | null;
  };
  batchSize?: number;
  tolerance?: number;
}

interface ProgressMessage {
  type: 'progress';
  processed: number;
  total: number;
  percentage: number;
}

interface ResultMessage {
  type: 'result';
  interiorPoints: Float32Array;
  totalProcessed: number;
  totalInside: number;
}

// Reconstruct geometry with BVH in worker
function reconstructGeometry(geometryData: WorkerMessage['geometryData']): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(geometryData.position, 3)
  );
  
  if (geometryData.index) {
    geometry.setIndex(new THREE.BufferAttribute(geometryData.index, 1));
  }
  
  // Compute BVH for accelerated raycasting
  geometry.computeBoundsTree();
  
  return geometry;
}

// Test if a point is inside the mesh using multi-directional raycasting with majority vote
function isPointInside(
  point: THREE.Vector3,
  mesh: THREE.Mesh,
  raycaster: THREE.Raycaster,
  tolerance: number = 2
): boolean {
  // Test in 6 directions: +X, -X, +Y, -Y, +Z, -Z
  const directions = [
    new THREE.Vector3(1, 0, 0),   // +X
    new THREE.Vector3(-1, 0, 0),  // -X
    new THREE.Vector3(0, 1, 0),   // +Y
    new THREE.Vector3(0, -1, 0),  // -Y
    new THREE.Vector3(0, 0, 1),   // +Z
    new THREE.Vector3(0, 0, -1),  // -Z
  ];
  
  let insideCount = 0;
  
  for (const direction of directions) {
    raycaster.set(point, direction);
    const intersects = raycaster.intersectObject(mesh, false);
    
    // Even-odd rule: odd number of intersections = inside
    if (intersects.length % 2 === 1) {
      insideCount++;
    }
  }
  
  // Majority vote: if at least 'tolerance' directions say inside, consider it inside
  // tolerance = 2 means at least 2 out of 6 directions must agree
  // tolerance = 3 means at least 3 out of 6 directions must agree (50%)
  // tolerance = 4 means at least 4 out of 6 directions must agree (majority)
  return insideCount >= tolerance;
}

// Process points in batches
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, points, geometryData, batchSize = 2048, tolerance = 3 } = e.data;
  
  if (type !== 'filter') return;
  
  console.log('🔧 Worker: Reconstructing geometry with BVH...');
  console.log(`🎯 Worker: Using tolerance = ${tolerance}/6 (${((tolerance/6)*100).toFixed(0)}% agreement required)`);
  
  const geometry = reconstructGeometry(geometryData);
  const mesh = new THREE.Mesh(geometry);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = false;
  
  const totalPoints = points.length / 3;
  const interiorPoints: number[] = [];
  
  console.log(`🔍 Worker: Processing ${totalPoints.toLocaleString()} points with multi-directional raycasting...`);
  
  const startTime = performance.now();
  let lastProgressTime = startTime;
  
  for (let i = 0; i < totalPoints; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    
    const point = new THREE.Vector3(x, y, z);
    
    if (isPointInside(point, mesh, raycaster, tolerance)) {
      interiorPoints.push(x, y, z);
    }
    
    // Send progress updates every 100ms
    if (i % batchSize === 0 || i === totalPoints - 1) {
      const now = performance.now();
      if (now - lastProgressTime > 100 || i === totalPoints - 1) {
        const progressMsg: ProgressMessage = {
          type: 'progress',
          processed: i + 1,
          total: totalPoints,
          percentage: ((i + 1) / totalPoints) * 100,
        };
        self.postMessage(progressMsg);
        lastProgressTime = now;
      }
    }
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  const filterPercentage = ((totalPoints - interiorPoints.length / 3) / totalPoints) * 100;
  
  console.log(`✅ Worker: Multi-directional raycasting completed:`);
  console.log(`   - Total processed: ${totalPoints.toLocaleString()}`);
  console.log(`   - Points inside: ${(interiorPoints.length / 3).toLocaleString()}`);
  console.log(`   - Points filtered: ${(totalPoints - interiorPoints.length / 3).toLocaleString()}`);
  console.log(`   - Filter rate: ${filterPercentage.toFixed(1)}%`);
  console.log(`   - Duration: ${duration.toFixed(0)}ms`);
  
  const result: ResultMessage = {
    type: 'result',
    interiorPoints: new Float32Array(interiorPoints),
    totalProcessed: totalPoints,
    totalInside: interiorPoints.length / 3,
  };
  
  self.postMessage(result, { transfer: [result.interiorPoints.buffer] });
  
  // Cleanup
  geometry.dispose();
};

export {};