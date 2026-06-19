import * as THREE from 'three';
import { scene } from './scene.js';
import { nodeMeshes, edgeLines, labelSprites, animQueue } from './state.js';

// --- Geometría base (tamaño uniforme) ---
const nodeGeo = new THREE.SphereGeometry(1, 16, 16);
const NODE_SIZE = 3;

export function createNodeMesh(n) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9,
  });
  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.scale.setScalar(NODE_SIZE);
  mesh.userData = { nodeId: n.id, baseSize: NODE_SIZE };
  scene.add(mesh);

  // Sutil glow blanco
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffffff, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(4, 4, 1);
  mesh.add(glow);

  // Etiqueta de texto
  const sprite = makeLabel(n.title);
  sprite.position.set(n.x, n.y + NODE_SIZE + 4, n.z);
  scene.add(sprite);
  labelSprites.set(n.id, sprite);

  nodeMeshes.set(n.id, mesh);
  // Animación de aparición
  mesh.scale.set(0, 0, 0);
  sprite.scale.set(0, 0, 0);
  animQueue.push({ type: 'spawn', id: n.id, progress: 0 });
  return mesh;
}

export function refreshNodeSizes() {
  // No-op — uniform size
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '20px Space Mono, monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(text.length > 18 ? text.slice(0, 16) + '..' : text, 128, 38);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(24, 6, 1);
  return s;
}

export function updateLabel(id, text) {
  const old = labelSprites.get(id);
  if (old) { scene.remove(old); old.material.map.dispose(); old.material.dispose(); }
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const sprite = makeLabel(text);
  const size = mesh.userData.baseSize || 3;
  sprite.position.copy(mesh.position).add(new THREE.Vector3(0, size + 4, 0));
  scene.add(sprite);
  labelSprites.set(id, sprite);
}

// --- Visuales de conexiones (aristas finas) ---
export function createEdgeLine(e) {
  const sM = nodeMeshes.get(e.source);
  const tM = nodeMeshes.get(e.target);
  if (!sM || !tM) return;
  const geo = new THREE.BufferGeometry().setFromPoints([sM.position, tM.position]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
  const line = new THREE.Line(geo, mat);
  line.userData = { edgeId: e.id, source: e.source, target: e.target };
  scene.add(line);
  edgeLines.set(e.id, line);
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
