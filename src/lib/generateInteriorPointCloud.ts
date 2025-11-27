import * as THREE from 'three';
import { generateGridFromBounds } from './generateGrid';

export interface InteriorPointCloudOptions {
  resolution?: number;
  onProgress?: (processed: number, total: number, percentage: number) => void;
}

export interface InteriorPointCloudResult {
  points: Float32Array;
  totalProcessed: number;
  totalInside: number;
  filterPercentage: number;
}

export async function generateInteriorPointCloud(
  mesh: THREE.Mesh,
  bounds: THREE.Box3,
  options: InteriorPointCloudOptions = {}
): Promise<InteriorPointCloudResult> {
  const { resolution = 0.25, onProgress } = options;
  
  console.log('🚀 Starting interior point cloud generation...');
  
  // Step 1: Generate grid
  const gridPoints = generateGridFromBounds(bounds, resolution);
  console.log(`📊 Grid generated: ${(gridPoints.length / 3).toLocaleString()} points`);
  
  // Step 2: Prepare geometry data for worker
  const geometry = mesh.geometry;
  const position = geometry.attributes.position.array as Float32Array;
  const index = geometry.index ? (geometry.index.array as Uint32Array) : null;
  
  const geometryData = {
    position: position,
    index: index,
  };
  
  // Step 3: Create and run worker
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/interiorFilter.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        if (onProgress) {
          onProgress(e.data.processed, e.data.total, e.data.percentage);
        }
      } else if (e.data.type === 'result') {
        const filterPercentage = (e.data.totalInside / e.data.totalProcessed) * 100;
        
        console.log(`✅ Interior point cloud generated:`);
        console.log(`   - Total processed: ${e.data.totalProcessed.toLocaleString()}`);
        console.log(`   - Points inside: ${e.data.totalInside.toLocaleString()}`);
        console.log(`   - Filter rate: ${filterPercentage.toFixed(1)}%`);
        
        worker.terminate();
        
        resolve({
          points: e.data.interiorPoints,
          totalProcessed: e.data.totalProcessed,
          totalInside: e.data.totalInside,
          filterPercentage,
        });
      }
    };
    
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      worker.terminate();
      reject(error);
    };
    
    // Send data to worker
    worker.postMessage(
      {
        type: 'filter',
        points: gridPoints,
        geometryData,
      },
      [gridPoints.buffer]
    );
  });
}