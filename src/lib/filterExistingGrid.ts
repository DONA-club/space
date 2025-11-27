import * as THREE from 'three';

export interface FilterGridOptions {
  tolerance?: number;
  invertLogic?: boolean;
  onProgress?: (processed: number, total: number, percentage: number) => void;
}

export interface FilterGridResult {
  points: Float32Array;
  totalProcessed: number;
  totalInside: number;
  filterPercentage: number;
}

export async function filterExistingGrid(
  gridPoints: Float32Array,
  mesh: THREE.Mesh,
  options: FilterGridOptions = {}
): Promise<FilterGridResult> {
  const { tolerance = 2, invertLogic = true, onProgress } = options;
  
  console.log('🚀 Starting grid filtering...');
  console.log(`📊 Grid points: ${(gridPoints.length / 3).toLocaleString()}`);
  console.log(`🎯 Tolerance: ${tolerance}/6 directions (${((tolerance/6)*100).toFixed(0)}% agreement)`);
  console.log(`🔄 Invert logic: ${invertLogic} (${invertLogic ? 'AIR VOLUME' : 'SOLID VOLUME'})`);
  
  // Prepare geometry data for worker
  const geometry = mesh.geometry;
  const position = geometry.attributes.position.array as Float32Array;
  const index = geometry.index ? (geometry.index.array as Uint32Array) : null;
  
  const geometryData = {
    position: position,
    index: index,
  };
  
  // Create and run worker
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
        const filterPercentage = ((e.data.totalProcessed - e.data.totalInside) / e.data.totalProcessed) * 100;
        
        console.log(`✅ Grid filtering completed:`);
        console.log(`   - Total processed: ${e.data.totalProcessed.toLocaleString()}`);
        console.log(`   - Points inside: ${e.data.totalInside.toLocaleString()}`);
        console.log(`   - Points filtered: ${(e.data.totalProcessed - e.data.totalInside).toLocaleString()}`);
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
        tolerance,
        invertLogic,
      },
      [gridPoints.buffer]
    );
  });
}