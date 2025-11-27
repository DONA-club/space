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
  debugInfo?: {
    sampleResults: Array<{
      point: [number, number, number];
      votes: number[];
      decision: boolean;
    }>;
  };
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

// Test if a point is inside using a more robust approach
function isPointInside(
  point: THREE.Vector3,
  mesh: THREE.Mesh,
  raycaster: THREE.Raycaster,
  tolerance: number = 2
): { inside: boolean; votes: number[] } {
  // Test in 6 main directions
  const directions = [
    new THREE.Vector3(1, 0, 0),   // +X
    new THREE.Vector3(-1, 0, 0),  // -X
    new THREE.Vector3(0, 1, 0),   // +Y
    new THREE.Vector3(0, -1, 0),  // -Y
    new THREE.Vector3(0, 0, 1),   // +Z
    new THREE.Vector3(0, 0, -1),  // -Z
  ];
  
  const votes: number[] = [];
  let insideCount = 0;
  
  for (const direction of directions) {
    raycaster.set(point, direction);
    const intersects = raycaster.intersectObject(mesh, false);
    
    const intersectionCount = intersects.length;
    votes.push(intersectionCount);
    
    // Even-odd rule: odd number of intersections = inside
    if (intersectionCount % 2 === 1) {
      insideCount++;
    }
  }
  
  // If we have very few or no intersections in any direction, the point is likely outside
  const totalIntersections = votes.reduce((sum, v) => sum + v, 0);
  if (totalIntersections === 0) {
    return { inside: false, votes };
  }
  
  // Majority vote with tolerance
  const inside = insideCount >= tolerance;
  
  return { inside, votes };
}

// Process points in batches
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, points, geometryData, batchSize = 2048, tolerance = 2 } = e.data;
  
  if (type !== 'filter') return;
  
  console.log('🔧 Worker: Reconstructing geometry with BVH...');
  console.log(`🎯 Worker: Using tolerance = ${tolerance}/6 (${((tolerance/6)*100).toFixed(0)}% agreement required)`);
  
  const geometry = reconstructGeometry(geometryData);
  const mesh = new THREE.Mesh(geometry);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = false;
  
  const totalPoints = points.length / 3;
  const interiorPoints: number[] = [];
  
  // Debug: sample first 10 points
  const debugSamples: Array<{
    point: [number, number, number];
    votes: number[];
    decision: boolean;
  }> = [];
  
  console.log(`🔍 Worker: Processing ${totalPoints.toLocaleString()} points...`);
  
  const startTime = performance.now();
  let lastProgressTime = startTime;
  
  for (let i = 0; i < totalPoints; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    
    const point = new THREE.Vector3(x, y, z);
    const result = isPointInside(point, mesh, raycaster, tolerance);
    
    // Collect debug info for first 10 points
    if (i < 10) {
      debugSamples.push({
        point: [x, y, z],
        votes: result.votes,
        decision: result.inside,
      });
    }
    
    if (result.inside) {
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
  
  console.log(`✅ Worker: Filtering completed:`);
  console.log(`   - Total processed: ${totalPoints.toLocaleString()}`);
  console.log(`   - Points inside: ${(interiorPoints.length / 3).toLocaleString()}`);
  console.log(`   - Points filtered: ${(totalPoints - interiorPoints.length / 3).toLocaleString()}`);
  console.log(`   - Filter rate: ${filterPercentage.toFixed(1)}%`);
  console.log(`   - Duration: ${duration.toFixed(0)}ms`);
  
  // Log debug samples
  console.log('📊 Debug samples (first 10 points):');
  debugSamples.forEach((sample, idx) => {
    const insideVotes = sample.votes.filter((v, i) => v % 2 === 1).length;
    console.log(`   Point ${idx}: [${sample.point.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`      Intersections: [${sample.votes.join(', ')}]`);
    console.log(`      Inside votes: ${insideVotes}/6`);
    console.log(`      Decision: ${sample.decision ? 'INSIDE' : 'OUTSIDE'}`);
  });
  
  const result: ResultMessage = {
    type: 'result',
    interiorPoints: new Float32Array(interiorPoints),
    totalProcessed: totalPoints,
    totalInside: interiorPoints.length / 3,
    debugInfo: {
      sampleResults: debugSamples,
    },
  };
  
  self.postMessage(result, { transfer: [result.interiorPoints.buffer] });
  
  // Cleanup
  geometry.dispose();
};

export {};