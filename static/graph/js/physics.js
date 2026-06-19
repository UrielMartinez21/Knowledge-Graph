import * as state from './state.js';

// --- Simulación de fuerzas — densa, orgánica ---
const REPULSION = 500;
const SPRING = 0.025;
const SPRING_LENGTH = 35;
const CENTER_PULL = 0.003;
const DAMPING = 0.9;
const MAX_SPEED = 1.8;

export function stepPhysics(draggedNodeId) {
  const nodes = state.nodes;
  const edges = state.edges;
  const meshes = state.nodeMeshes;

  for (const n of nodes) {
    if (n.vx === undefined) { n.vx = 0; n.vy = 0; n.vz = 0; }
  }

  for (const n of nodes) {
    if (n.id === draggedNodeId) continue;

    let fx = 0, fy = 0, fz = 0;

    for (const other of nodes) {
      if (other.id === n.id) continue;
      const mesh = meshes.get(n.id);
      const otherMesh = meshes.get(other.id);
      if (!mesh || !otherMesh) continue;

      let dx = mesh.position.x - otherMesh.position.x;
      let dy = mesh.position.y - otherMesh.position.y;
      let dz = mesh.position.z - otherMesh.position.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      let force = REPULSION / (dist * dist);

      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
      fz += (dz / dist) * force;
    }

    for (const e of edges) {
      let otherId = null;
      if (e.source === n.id) otherId = e.target;
      else if (e.target === n.id) otherId = e.source;
      else continue;

      const mesh = meshes.get(n.id);
      const otherMesh = meshes.get(otherId);
      if (!mesh || !otherMesh) continue;

      let dx = otherMesh.position.x - mesh.position.x;
      let dy = otherMesh.position.y - mesh.position.y;
      let dz = otherMesh.position.z - mesh.position.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      let displacement = dist - SPRING_LENGTH;

      fx += (dx / dist) * displacement * SPRING;
      fy += (dy / dist) * displacement * SPRING;
      fz += (dz / dist) * displacement * SPRING;
    }

    const mesh = meshes.get(n.id);
    if (mesh) {
      fx -= mesh.position.x * CENTER_PULL;
      fy -= mesh.position.y * CENTER_PULL;
      fz -= mesh.position.z * CENTER_PULL;
    }

    n.vx = clamp((n.vx + fx) * DAMPING, MAX_SPEED);
    n.vy = clamp((n.vy + fy) * DAMPING, MAX_SPEED);
    n.vz = clamp((n.vz + fz) * DAMPING, MAX_SPEED);
  }

  for (const n of nodes) {
    if (n.id === draggedNodeId) continue;
    const mesh = meshes.get(n.id);
    if (!mesh) continue;

    mesh.position.x += n.vx;
    mesh.position.y += n.vy;
    mesh.position.z += n.vz;

    const size = mesh.userData.baseSize || 3;
    const label = state.labelSprites.get(n.id);
    if (label) label.position.set(mesh.position.x, mesh.position.y + size + 4, mesh.position.z);
  }
}

function clamp(v, max) {
  return Math.max(-max, Math.min(max, v));
}
