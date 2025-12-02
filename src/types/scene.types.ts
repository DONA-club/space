import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SensorMeshes {
  sphere: THREE.Mesh;
  glow: THREE.Mesh;
  sprite: THREE.Sprite;
}

export interface SceneRef {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  animationId: number;
  sensorMeshes: Map<number, SensorMeshes>;
  boundingSphere: THREE.Sphere;
  interpolationMesh: THREE.Points | THREE.Group | THREE.Mesh | null;
  modelScale: number;
  modelGroup: THREE.Group | null;
  originalCenter: THREE.Vector3 | null;
  // Soleil
  sunLight?: THREE.DirectionalLight;
  sunSphere?: THREE.Mesh;
  sunPath?: THREE.Line;
  // Rose des vents
  windRose?: THREE.Group;
}

export interface ModelBounds {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export type VisualizationType = 'points' | 'vectors' | 'isosurface' | 'mesh';
export type InterpolationMethod = 'idw' | 'rbf';
export type RBFKernel = 'gaussian' | 'multiquadric' | 'inverse_multiquadric' | 'thin_plate_spline';