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

    console.log('🔄 Starting GLB load for volume sampling...');
    setData(prev => ({ ...prev, loading: true, error: null }));

    const loader = new GLTFLoader();
    const loadStartTime = performance.now();

    loader.load(
      url,
      (gltf) => {
        const loadEndTime = performance.now();
        console.log(`✅ GLB loaded in ${(loadEndTime - loadStartTime).toFixed(0)}ms`);
        
        // Find the main mesh
        let mainMesh: THREE.Mesh | null = null;
        let meshCount = 0;
        
        console.log('🔍 Scanning scene for meshes...');
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            if (!mainMesh) {
              mainMesh = child;
              console.log(`   Found main mesh: ${child.name || 'unnamed'}`);
              console.log(`   Vertices: ${child.geometry.attributes.position.count.toLocaleString()}`);
              console.log(`   Triangles: ${child.geometry.index ? (child.geometry.index.count / 3).toLocaleString() : 'N/A'}`);
            }
          }
        });

        console.log(`📊 Total meshes in scene: ${meshCount}`);

        if (!mainMesh) {
          console.error('❌ No mesh found in GLB file');
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
          const bvhStartTime = performance.now();
          
          try {
            geometry.computeBoundsTree();
            const bvhEndTime = performance.now();
            console.log(`✅ BVH computed in ${(bvhEndTime - bvhStartTime).toFixed(0)}ms`);
          } catch (error) {
            console.error('❌ Error computing BVH:', error);
            setData(prev => ({
              ...prev,
              loading: false,
              error: 'Failed to compute BVH',
            }));
            return;
          }
        } else {
          console.log('✅ BVH already exists');
        }

        // Compute bounding box
        console.log('📦 Computing bounding box...');
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox!.clone();

        // Apply mesh transformations to bounds
        if (mainMesh.parent) {
          mainMesh.updateMatrixWorld(true);
          bounds.applyMatrix4(mainMesh.matrixWorld);
        }

        const size = bounds.getSize(new THREE.Vector3());
        console.log('📦 Volume bounds:', {
          min: bounds.min.toArray().map(v => v.toFixed(2)),
          max: bounds.max.toArray().map(v => v.toFixed(2)),
          size: size.toArray().map(v => v.toFixed(2)),
        });

        const totalTime = performance.now() - loadStartTime;
        console.log(`✅ Volume data ready in ${totalTime.toFixed(0)}ms total`);

        setData({
          mesh: mainMesh,
          geometry,
          bounds,
          loading: false,
          error: null,
        });
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`📥 Loading GLB: ${percentComplete.toFixed(0)}%`);
        }
      },
      (error) => {
        console.error('❌ Error loading GLB:', error);
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