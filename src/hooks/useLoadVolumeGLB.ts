import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Extend THREE.BufferGeometry to include BVH
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

interface VolumeData {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  bounds: THREE.Box3;
  loading: boolean;
  error: string | null;
}

export function useLoadVolumeGLB(url: string | null): VolumeData {
  const [data, setData] = useState<VolumeData>({
    mesh: null as any,
    geometry: null as any,
    bounds: new THREE.Box3(),
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setData({
        mesh: null as any,
        geometry: null as any,
        bounds: new THREE.Box3(),
        loading: false,
        error: null,
      });
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        // Find the main mesh
        let mainMesh: THREE.Mesh | null = null;
        
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && !mainMesh) {
            mainMesh = child;
          }
        });

        if (!mainMesh) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: 'No mesh found in GLB file',
          }));
          return;
        }

        const geometry = mainMesh.geometry;

        // Compute BVH for accelerated raycasting
        if (!geometry.boundsTree) {
          console.log('🔧 Computing BVH for mesh...');
          const startTime = performance.now();
          geometry.computeBoundsTree();
          const endTime = performance.now();
          console.log(`✅ BVH computed in ${(endTime - startTime).toFixed(0)}ms`);
        }

        // Compute bounding box
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox!.clone();

        // Apply mesh transformations to bounds
        if (mainMesh.parent) {
          mainMesh.updateMatrixWorld(true);
          bounds.applyMatrix4(mainMesh.matrixWorld);
        }

        console.log('📦 Volume bounds:', {
          min: bounds.min.toArray(),
          max: bounds.max.toArray(),
          size: bounds.getSize(new THREE.Vector3()).toArray(),
        });

        setData({
          mesh: mainMesh,
          geometry,
          bounds,
          loading: false,
          error: null,
        });
      },
      undefined,
      (error) => {
        console.error('Error loading GLB:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load GLB file',
        }));
      }
    );
  }, [url]);

  return data;
}