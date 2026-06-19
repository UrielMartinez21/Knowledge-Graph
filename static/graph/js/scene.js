import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Configuración de la escena 3D ---
export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 80, 200);

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x0a0a0f);
document.body.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;

// --- Iluminación mínima (nodos son auto-iluminados) ---
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// --- Raycaster para detección de clics ---
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

export const clock = new THREE.Clock();
