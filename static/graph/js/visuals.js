import * as THREE from 'three';
import { scene } from './scene.js';
import { nodeMeshes, edgeLines, labelSprites, particleSystems, animQueue } from './state.js';

// --- Visuales de nodos (geometría y materiales) ---
const nodeGeo = new THREE.SphereGeometry(5, 24, 24);
const ringGeo = new THREE.RingGeometry(7, 8, 6);

export function createNodeMesh(n) {
  const mat = new THREE.MeshPhongMaterial({
    color: 0x00d4ff, emissive: 0x003344, transparent: true, opacity: 0.85,
  });
  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.userData = { nodeId: n.id };
  scene.add(mesh);

  // Sprite de resplandor
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0x00d4ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(30, 30, 1);
  mesh.add(glow);

  // Anillo orbital
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.userData.isRing = true;
  mesh.add(ring);

  // Etiqueta de texto
  const sprite = makeLabel(n.title);
  sprite.position.set(n.x, n.y + 10, n.z);
  scene.add(sprite);
  labelSprites.set(n.id, sprite);

  nodeMeshes.set(n.id, mesh);
  // Animación de aparición
  mesh.scale.set(0, 0, 0);
  sprite.scale.set(0, 0, 0);
  animQueue.push({ type: 'spawn', id: n.id, progress: 0 });
  return mesh;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,212,255,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '24px Courier New';
  ctx.fillStyle = '#00d4ff';
  ctx.textAlign = 'center';
  ctx.fillText(text.length > 18 ? text.slice(0, 16) + '..' : text, 128, 38);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(30, 8, 1);
  return s;
}

export function updateLabel(id, text) {
  const old = labelSprites.get(id);
  if (old) { scene.remove(old); old.material.map.dispose(); old.material.dispose(); }
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const sprite = makeLabel(text);
  sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 10, 0));
  scene.add(sprite);
  labelSprites.set(id, sprite);
}

// --- Visuales de conexiones (aristas) ---
export function createEdgeLine(e) {
  const sM = nodeMeshes.get(e.source);
  const tM = nodeMeshes.get(e.target);
  if (!sM || !tM) return;
  const geo = new THREE.BufferGeometry().setFromPoints([sM.position, tM.position]);
  const mat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.25 });
  const line = new THREE.Line(geo, mat);
  line.userData = { edgeId: e.id, source: e.source, target: e.target };
  scene.add(line);
  edgeLines.set(e.id, line);

  // Partícula que viaja por la conexión
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const pMat = new THREE.PointsMaterial({ color: 0x00d4ff, size: 2, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
  const particle = new THREE.Points(pGeo, pMat);
  particle.userData = { source: e.source, target: e.target, offset: Math.random() };
  scene.add(particle);
  particleSystems.push(particle);
}

export function updateEdgePositions() {
  edgeLines.forEach((line) => {
    const sM = nodeMeshes.get(line.userData.source);
    const tM = nodeMeshes.get(line.userData.target);
    if (sM && tM) {
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, sM.position.x, sM.position.y, sM.position.z);
      pos.setXYZ(1, tM.position.x, tM.position.y, tM.position.z);
      pos.needsUpdate = true;
    }
  });
}
