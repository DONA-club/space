import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const createScene = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f8);
  scene.fog = new THREE.Fog(0xf0f4f8, 20, 100);
  return scene;
};

export const createCamera = (width: number, height: number) => {
  return new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
};

export const createRenderer = (width: number, height: number) => {
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  return renderer;
};

export const setupLights = (scene: THREE.Scene) => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
  mainLight.position.set(10, 15, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.8);
  fillLight.position.set(-10, 10, -10);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffa07a, 0.6);
  backLight.position.set(0, 5, -15);
  scene.add(backLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0xf0e68c, 0.6);
  scene.add(hemisphereLight);
};

export const createControls = (camera: THREE.Camera, domElement: HTMLElement) => {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.75;
  controls.minDistance = 2;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI / 1.5;
  return controls;
};