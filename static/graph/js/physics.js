import * as state from './state.js';

// --- Simulación de fuerzas tipo Skynet ---
// Cada nodo almacena su velocidad en vx, vy, vz

const REPULSION = 800;      // Fuerza de repulsión entre nodos
const SPRING = 0.015;        // Rigidez del resorte (aristas)
const SPRING_LENGTH = 60;    // Longitud natural del resorte
const CENTER_PULL = 0.002;   // Fuerza centrípeta hacia el origen
const DAMPING = 0.92;        // Amortiguación (< 1 = se frena, más cercano a 1 = más fluido)
const MAX_SPEED = 2.0;       // Velocidad máxima por eje

export function stepPhysics(draggedNodeId) {
  const nodes = state.nodes;
  const edges = state.edges;
  const meshes = state.nodeMeshes;

  // Inicializar velocidades si no existen
  for (const n of nodes) {
    if (n.vx === undefined) { n.vx = 0; n.vy = 0; n.vz = 0; }
  }

  // Acumular fuerzas
  for (const n of nodes) {
    if (n.id === draggedNodeId) continue;

    let fx = 0, fy = 0, fz = 0;

    // Repulsión contra todos los demás nodos
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

    // Atracción por aristas (resorte)
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

    // Fuerza centrípeta suave hacia el origen
    const mesh = meshes.get(n.id);
    if (mesh) {
      fx -= mesh.position.x * CENTER_PULL;
      fy -= mesh.position.y * CENTER_PULL;
      fz -= mesh.position.z * CENTER_PULL;
    }

    // Integrar velocidad
    n.vx = clamp((n.vx + fx) * DAMPING, MAX_SPEED);
    n.vy = clamp((n.vy + fy) * DAMPING, MAX_SPEED);
    n.vz = clamp((n.vz + fz) * DAMPING, MAX_SPEED);
  }

  // Aplicar posiciones
  for (const n of nodes) {
    if (n.id === draggedNodeId) continue;
    const mesh = meshes.get(n.id);
    if (!mesh) continue;

    mesh.position.x += n.vx;
    mesh.position.y += n.vy;
    mesh.position.z += n.vz;

    // Sincronizar label
    const label = state.labelSprites.get(n.id);
    if (label) label.position.set(mesh.position.x, mesh.position.y + 10, mesh.position.z);
  }
}

function clamp(v, max) {
  return Math.max(-max, Math.min(max, v));
}
