import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Configuración de la escena 3D ---
export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.003);

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 80, 200);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x0a0a0f);
document.body.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;

// --- Iluminación ---
scene.add(new THREE.AmbientLight(0x112233, 1));
const pointLight = new THREE.PointLight(0x00d4ff, 2, 500);
pointLight.position.set(0, 100, 0);
scene.add(pointLight);

// --- Grilla de referencia ---
const gridHelper = new THREE.GridHelper(600, 40, 0x0d1520, 0x0d1520);
gridHelper.position.y = -50;
scene.add(gridHelper);

// --- Raycaster para detección de clics ---
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

export const clock = new THREE.Clock();
