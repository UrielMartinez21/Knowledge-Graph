import * as THREE from 'three';
import { scene } from './scene.js';
import { nodeMeshes, edgeLines, labelSprites, animQueue } from './state.js';

// --- Node type visual configuration ---
const nodeGeo = new THREE.SphereGeometry(1, 16, 16);

const NODE_CONFIG = {
  main:      { size: 6,   color: 0xffd700, glowOpacity: 0.35, glowScale: 7,   fontStyle: 'bold 22px Space Mono, monospace', fontColor: 'rgba(255, 215, 0, 0.9)',   labelScale: [28, 7, 1] },
  secondary: { size: 4.5, color: 0x00e88f, glowOpacity: 0.25, glowScale: 5.5, fontStyle: 'bold 20px Space Mono, monospace', fontColor: 'rgba(0, 232, 143, 0.85)',  labelScale: [26, 6.5, 1] },
  normal:    { size: 3,   color: 0xffffff, glowOpacity: 0.15, glowScale: 4,   fontStyle: '20px Space Mono, monospace',      fontColor: 'rgba(255, 255, 255, 0.7)', labelScale: [24, 6, 1] },
};

function getConfig(nodeType) {
  return NODE_CONFIG[nodeType] || NODE_CONFIG.normal;
}

export function createNodeMesh(n) {
  const cfg = getConfig(n.node_type);
  const mat = new THREE.MeshBasicMaterial({
    color: cfg.color, transparent: true, opacity: 0.9,
  });
  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.scale.setScalar(cfg.size);
  mesh.userData = { nodeId: n.id, baseSize: cfg.size, nodeType: n.node_type || 'normal' };
  scene.add(mesh);

  // Glow
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: cfg.color,
    transparent: true, opacity: cfg.glowOpacity, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(cfg.glowScale, cfg.glowScale, 1);
  mesh.add(glow);

  // Label
  const sprite = makeLabel(n.title, n.node_type);
  sprite.position.set(n.x, n.y + cfg.size + 4, n.z);
  scene.add(sprite);
  labelSprites.set(n.id, sprite);

  nodeMeshes.set(n.id, mesh);
  // Spawn animation
  mesh.scale.set(0, 0, 0);
  sprite.scale.set(0, 0, 0);
  animQueue.push({ type: 'spawn', id: n.id, progress: 0 });
  return mesh;
}

export function refreshNodeSizes() {
  // No-op — sizes set at creation
}

// Update a node's visual appearance when its type changes
export function updateNodeType(id, nodeType) {
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const cfg = getConfig(nodeType);
  mesh.scale.setScalar(cfg.size);
  mesh.userData.baseSize = cfg.size;
  mesh.userData.nodeType = nodeType;
  mesh.material.color.setHex(cfg.color);
  // Update glow
  const glow = mesh.children[0];
  if (glow) {
    glow.material.color.setHex(cfg.color);
    glow.material.opacity = cfg.glowOpacity;
    glow.scale.set(cfg.glowScale, cfg.glowScale, 1);
  }
  // Update label position
  const sprite = labelSprites.get(id);
  if (sprite) sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 4, 0));
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

function makeLabel(text, nodeType = 'normal') {
  const cfg = getConfig(nodeType);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = cfg.fontStyle;
  ctx.fillStyle = cfg.fontColor;
  ctx.textAlign = 'center';
  ctx.fillText(text.length > 18 ? text.slice(0, 16) + '..' : text, 128, 38);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(...cfg.labelScale);
  return s;
}

export function updateLabel(id, text) {
  const old = labelSprites.get(id);
  if (old) { scene.remove(old); old.material.map.dispose(); old.material.dispose(); }
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const nodeType = mesh.userData.nodeType || 'normal';
  const sprite = makeLabel(text, nodeType);
  const size = mesh.userData.baseSize || 3;
  sprite.position.copy(mesh.position).add(new THREE.Vector3(0, size + 4, 0));
  scene.add(sprite);
  labelSprites.set(id, sprite);
}

// --- Edge visuals ---
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
