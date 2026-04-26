import * as THREE from 'three';
import { scene, camera, renderer, controls, raycaster, mouse, clock } from './scene.js';
import { api, showToast } from './api.js';
import { createNodeMesh, createEdgeLine, updateLabel, updateEdgePositions } from './visuals.js';
import { stepPhysics } from './physics.js';
import * as state from './state.js';

// --- Estados vacío y error ---
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');

function updateEmptyState() {
  emptyState.style.display = state.nodes.length === 0 ? '' : 'none';
}

// --- Carga inicial del grafo desde la API ---
async function loadGraph() {
  try {
    const data = await api('/api/graph/');
    state.setNodes(data.nodes);
    state.setAllTags(data.tags || []);
    state.setEdges(data.edges.map(e => ({ id: e.id, source: e.source_id, target: e.target_id })));
    state.nodes.forEach(n => { n.tags = n.tags || []; createNodeMesh(n); });
    state.edges.forEach(e => createEdgeLine(e));
    document.getElementById('hud-count').textContent = state.nodes.length;
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    updateEmptyState();
  } catch (err) {
    loadingState.style.display = 'none';
    errorState.style.display = '';
    console.error(err);
  }
}

// --- Acciones principales ---
async function addNode() {
  try {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().add(dir.multiplyScalar(80));
    const spread = 40;
    const x = pos.x + (Math.random() - 0.5) * spread;
    const y = pos.y + (Math.random() - 0.5) * spread;
    const z = pos.z + (Math.random() - 0.5) * spread;
    const n = await api('/api/nodes/', 'POST', { title: 'Nuevo nodo', content: '', x, y, z });
    n.tags = n.tags || [];
    state.nodes.push(n);
    createNodeMesh(n);
    document.getElementById('hud-count').textContent = state.nodes.length;
    updateEmptyState();
    selectNode(n.id);
  } catch (err) {
    showToast('Error al crear nodo');
    console.error(err);
  }
}

async function saveNode() {
  if (!state.selectedNode) return;
  const titleInput = document.getElementById('node-title');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('is-invalid');
    showToast('El título no puede estar vacío');
    return;
  }
  const content = document.getElementById('node-content').value;
  const saveBtn = document.getElementById('save-node-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';
  try {
    await api(`/api/nodes/${state.selectedNode}/`, 'PUT', { title, content });
    const n = state.nodes.find(n => n.id === state.selectedNode);
    if (n) { n.title = title; n.content = content; }
    updateLabel(state.selectedNode, title);
    showToast('Nodo guardado', 'success');
  } catch (err) {
    showToast('Error al guardar nodo');
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function deleteNode() {
  if (!state.selectedNode) return;
  const id = state.selectedNode;
  closePanel();
  try {
    await api(`/api/nodes/${id}/`, 'DELETE');
    // Eliminar aristas conectadas inmediatamente
    state.edges.filter(e => e.source === id || e.target === id).forEach(e => {
      const line = state.edgeLines.get(e.id);
      if (line) scene.remove(line);
      state.edgeLines.delete(e.id);
    });
    state.setParticleSystems(state.particleSystems.filter(p => {
      if (p.userData.source === id || p.userData.target === id) { scene.remove(p); return false; }
      return true;
    }));
    state.setEdges(state.edges.filter(e => e.source !== id && e.target !== id));
    state.setNodes(state.nodes.filter(n => n.id !== id));
    document.getElementById('hud-count').textContent = state.nodes.length;
    updateEmptyState();
    // Animar desaparición y luego eliminar del escenario
    state.animQueue.push({ type: 'despawn', id, progress: 0, onDone: () => {
      const mesh = state.nodeMeshes.get(id);
      if (mesh) scene.remove(mesh);
      state.nodeMeshes.delete(id);
      const label = state.labelSprites.get(id);
      if (label) scene.remove(label);
      state.labelSprites.delete(id);
    }});
  } catch (err) {
    showToast('Error al eliminar nodo');
    console.error(err);
  }
}

async function deleteEdgesOfNode() {
  if (!state.selectedNode) return;
  try {
    const toDelete = state.edges.filter(e => e.source === state.selectedNode || e.target === state.selectedNode);
    for (const e of toDelete) {
      await api(`/api/edges/${e.id}/`, 'DELETE');
      const line = state.edgeLines.get(e.id);
      if (line) scene.remove(line);
      state.edgeLines.delete(e.id);
    }
    state.setParticleSystems(state.particleSystems.filter(p => {
      if (p.userData.source === state.selectedNode || p.userData.target === state.selectedNode) { scene.remove(p); return false; }
      return true;
    }));
    state.setEdges(state.edges.filter(e => e.source !== state.selectedNode && e.target !== state.selectedNode));
  } catch (err) {
    showToast('Error al desconectar nodo');
    console.error(err);
  }
}

function toggleLinkMode() {
  state.setLinkMode(!state.linkMode);
  state.setLinkSource(null);
  document.getElementById('mode-indicator').style.display = state.linkMode ? 'block' : 'none';
  const linkBtn = document.getElementById('linkBtn');
  linkBtn.style.borderColor = state.linkMode ? '#ff6400' : '';
  linkBtn.setAttribute('aria-pressed', state.linkMode);
  controls.enabled = !state.linkMode;
}

function toggleMenu() {
  const menu = document.getElementById('sidebar-menu');
  menu.classList.toggle('is-open');
  document.getElementById('burger-btn').setAttribute('aria-expanded', menu.classList.contains('is-open'));
}

function selectNode(id) {
  if (state.selectedNode) {
    const prev = state.nodeMeshes.get(state.selectedNode);
    if (prev) { prev.material.color.setHex(0x00d4ff); prev.material.emissive.setHex(0x003344); }
  }
  state.setSelectedNode(id);
  const mesh = state.nodeMeshes.get(id);
  if (mesh) { mesh.material.color.setHex(0xff6400); mesh.material.emissive.setHex(0x331100); }
  const n = state.nodes.find(n => n.id === id);
  if (!n) return;
  document.getElementById('node-title').value = n.title;
  document.getElementById('node-content').value = n.content;
  document.getElementById('panel-title').textContent = `Nodo #${n.id}`;
  updatePreview(n.content);
  showPreviewMode();
  renderNodeTags(n);
  const panelEl = document.getElementById('panel');
  panelEl.classList.add('is-open');
  panelEl.setAttribute('aria-hidden', 'false');
}

function closePanel() {
  if (state.selectedNode) {
    const prev = state.nodeMeshes.get(state.selectedNode);
    if (prev) { prev.material.color.setHex(0x00d4ff); prev.material.emissive.setHex(0x003344); }
  }
  const panelEl = document.getElementById('panel');
  panelEl.classList.remove('is-open');
  panelEl.setAttribute('aria-hidden', 'true');
  state.setSelectedNode(null);
}

// --- Detección de clics y arrastre de nodos ---
let mouseDown = false, mouseMoved = false, mouseDownPos = { x: 0, y: 0 };
let draggedNode = null, dragPlane = new THREE.Plane();

renderer.domElement.addEventListener('mousedown', e => {
  mouseDown = true; mouseMoved = false;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  if (state.linkMode) return;
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
  if (hits.length > 0) {
    const mesh = hits[0].object;
    draggedNode = mesh;
    controls.enabled = false;
    const normal = camera.position.clone().sub(mesh.position).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(normal, mesh.position);
  }
});

renderer.domElement.addEventListener('mousemove', e => {
  if (Math.abs(e.clientX - mouseDownPos.x) > 3 || Math.abs(e.clientY - mouseDownPos.y) > 3) mouseMoved = true;
  if (draggedNode) {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);
    if (intersection) {
      draggedNode.position.copy(intersection);
      const label = state.labelSprites.get(draggedNode.userData.nodeId);
      if (label) label.position.copy(intersection).add(new THREE.Vector3(0, 10, 0));
      updateEdgePositions();
    }
  }
});

renderer.domElement.addEventListener('mouseup', e => {
  if (draggedNode) {
    const id = draggedNode.userData.nodeId;
    const n = state.nodes.find(n => n.id === id);
    if (n) { n.vx = 0; n.vy = 0; n.vz = 0; }
    draggedNode = null;
    controls.enabled = !state.linkMode;
  }
  mouseDown = false;
});

renderer.domElement.addEventListener('click', e => {
  if (mouseMoved) return;
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
  if (state.linkMode && hits.length > 0) {
    const id = hits[0].object.userData.nodeId;
    if (!state.linkSource) { state.setLinkSource(id); }
    else {
      (async () => {
        if (state.linkSource === id) return;
        if (state.edges.find(e => (e.source === state.linkSource && e.target === id) || (e.source === id && e.target === state.linkSource))) return;
        try {
          const ed = await api('/api/edges/', 'POST', { source: state.linkSource, target: id });
          const newEdge = { id: ed.id, source: ed.source_id, target: ed.target_id };
          state.edges.push(newEdge);
          createEdgeLine(newEdge);
        } catch (err) {
          showToast('Error al crear conexión');
          console.error(err);
        }
        state.setLinkSource(null);
        toggleLinkMode();
      })();
    }
    return;
  }
});

renderer.domElement.addEventListener('dblclick', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
  if (hits.length > 0) selectNode(hits[0].object.userData.nodeId);
});

document.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (state.linkMode) toggleLinkMode();
    closePanel();
    document.activeElement.blur();
    return;
  }
  if (typing) return;
  if (e.key === 'n' || e.key === 'N') addNode();
  if (e.key === 'c' || e.key === 'C') toggleLinkMode();
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); searchInput.focus(); }
  if (e.key === 'Delete' && state.selectedNode) deleteNode();
  if (e.key === 'm' || e.key === 'M') toggleMenu();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Vista previa de Markdown ---
const contentPreview = document.getElementById('content-preview');
const contentTextarea = document.getElementById('node-content');
const contentEdit = document.getElementById('content-edit');
const contentEditBtn = document.getElementById('content-edit-btn');

function updatePreview(text) {
  contentPreview.innerHTML = (text && text.trim()) ? marked.parse(text) : '';
}

function showPreviewMode() {
  contentEdit.style.display = 'none';
  contentPreview.style.display = 'block';
  contentEditBtn.style.display = 'inline-block';
}

function showEditMode() {
  contentPreview.style.display = 'none';
  contentEditBtn.style.display = 'none';
  contentEdit.style.display = 'block';
  contentTextarea.focus();
}

function startEditContent() { showEditMode(); }

async function finishEditContent() {
  const text = contentTextarea.value;
  updatePreview(text);
  showPreviewMode();
  if (state.selectedNode) {
    try {
      const title = document.getElementById('node-title').value;
      await api(`/api/nodes/${state.selectedNode}/`, 'PUT', { title, content: text });
      const n = state.nodes.find(n => n.id === state.selectedNode);
      if (n) { n.content = text; }
    } catch (err) {
      showToast('Error al guardar contenido');
      console.error(err);
    }
  }
}

// --- Sistema de tags del nodo ---
const tagInput = document.getElementById('tag-input');
const tagSuggestions = document.getElementById('tag-suggestions');
const nodeTags = document.getElementById('node-tags');

function renderNodeTags(n) {
  nodeTags.innerHTML = '';
  tagInput.value = '';
  tagSuggestions.style.display = 'none';
  (n.tags || []).forEach(t => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.style.borderColor = t.color;
    pill.style.color = t.color;
    pill.innerHTML = `${t.name} <span class="tag-pill__remove" data-tag="${t.id}">✕</span>`;
    pill.querySelector('.tag-pill__remove').addEventListener('click', () => removeTagFromNode(n.id, t.id));
    nodeTags.appendChild(pill);
  });
}

async function removeTagFromNode(nodeId, tagId) {
  try {
    await api(`/api/nodes/${nodeId}/tags/${tagId}/`, 'DELETE');
    const n = state.nodes.find(n => n.id === nodeId);
    if (n) { n.tags = n.tags.filter(t => t.id !== tagId); renderNodeTags(n); }
  } catch (err) {
    showToast('Error al eliminar tag');
    console.error(err);
  }
}

async function addTagToNode(nodeId, tag) {
  const n = state.nodes.find(n => n.id === nodeId);
  if (!n || n.tags.find(t => t.id === tag.id)) return;
  try {
    await api(`/api/nodes/${nodeId}/tags/`, 'POST', { tag_id: tag.id });
    n.tags.push(tag);
    renderNodeTags(n);
    renderTagFilter();
  } catch (err) {
    showToast('Error al agregar tag');
    console.error(err);
  }
}

tagInput.addEventListener('input', () => {
  const q = tagInput.value.toLowerCase().trim();
  tagSuggestions.innerHTML = '';
  if (!q) { tagSuggestions.style.display = 'none'; return; }
  const n = state.nodes.find(n => n.id === state.selectedNode);
  const currentIds = new Set((n?.tags || []).map(t => t.id));
  const matches = state.allTags.filter(t => t.name.toLowerCase().includes(q) && !currentIds.has(t.id)).slice(0, 8);
  matches.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tag-add__option';
    div.setAttribute('role', 'option');
    div.innerHTML = `<span class="tag-color-dot" style="background:${t.color}"></span>${t.name}`;
    div.addEventListener('click', () => { addTagToNode(state.selectedNode, t); tagInput.value = ''; tagSuggestions.style.display = 'none'; });
    tagSuggestions.appendChild(div);
  });
  // Opción para crear un tag nuevo
  if (!state.allTags.find(t => t.name.toLowerCase() === q)) {
    const div = document.createElement('div');
    div.className = 'tag-add__option tag-add__option--create';
    div.textContent = `+ Crear "${tagInput.value.trim()}"`;
    div.addEventListener('click', async () => {
      try {
        const tag = await api('/api/tags/', 'POST', { name: tagInput.value.trim() });
        state.allTags.push(tag);
        await addTagToNode(state.selectedNode, tag);
      } catch (err) {
        showToast('Error al crear tag');
        console.error(err);
      }
      tagInput.value = '';
      tagSuggestions.style.display = 'none';
    });
    tagSuggestions.appendChild(div);
  }
  tagSuggestions.style.display = 'block';
});

tagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const first = tagSuggestions.querySelector('.tag-add__option');
    if (first) first.click();
  }
});

// --- Filtro global por tags ---
const tagFilterEl = document.getElementById('tag-filter');

function toggleTagFilter() {
  tagFilterEl.classList.toggle('is-open');
  document.getElementById('tagFilterBtn').setAttribute('aria-expanded', tagFilterEl.classList.contains('is-open'));
}

// Cerrar filtro de tags al hacer clic fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.tag-filter')) tagFilterEl.classList.remove('is-open');
});

function renderTagFilter() {
  tagFilterEl.innerHTML = '';
  tagFilterEl.classList.remove('is-open');
  state.allTags.forEach(t => {
    const pill = document.createElement('button');
    pill.className = 'tag-filter__pill' + (state.activeFilterTag === t.id ? ' is-active' : '');
    pill.style.borderColor = t.color;
    pill.style.color = t.color;
    pill.textContent = t.name;
    pill.addEventListener('click', () => {
      state.setActiveFilterTag(state.activeFilterTag === t.id ? null : t.id);
      applyTagFilter();
      renderTagFilter();
    });
    tagFilterEl.appendChild(pill);
  });
}

function applyTagFilter() {
  state.nodeMeshes.forEach((mesh, id) => {
    if (id === state.selectedNode) return; // No modificar el nodo seleccionado
    const n = state.nodes.find(n => n.id === id);
    const match = !state.activeFilterTag || (n?.tags || []).some(t => t.id === state.activeFilterTag);
    mesh.material.opacity = match ? 0.85 : 0.1;
    mesh.children.forEach(child => {
      if (child.material) child.material.opacity = match ? (child.userData.isRing ? 0.2 : 0.3) : 0.03;
    });
    const label = state.labelSprites.get(id);
    if (label) label.material.opacity = match ? 1 : 0.1;
  });
  state.edgeLines.forEach(line => {
    if (!state.activeFilterTag) { line.material.opacity = 0.25; return; }
    const sNode = state.nodes.find(n => n.id === line.userData.source);
    const tNode = state.nodes.find(n => n.id === line.userData.target);
    const sMatch = (sNode?.tags || []).some(t => t.id === state.activeFilterTag);
    const tMatch = (tNode?.tags || []).some(t => t.id === state.activeFilterTag);
    line.material.opacity = (sMatch && tMatch) ? 0.25 : 0.03;
  });
}

// --- Búsqueda de nodos ---
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let flyTarget = null, flyStart = null, flyProgress = -1;

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  searchResults.innerHTML = '';
  if (!q) { searchResults.style.display = 'none'; return; }
  const matches = state.nodes.filter(n =>
    n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))
  ).slice(0, 10);
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  matches.forEach(n => {
    const div = document.createElement('div');
    div.className = 'search__item';
    div.setAttribute('role', 'option');
    div.innerHTML = `${n.title} <small>#${n.id}</small>`;
    div.addEventListener('click', () => flyToNode(n.id));
    searchResults.appendChild(div);
  });
  searchResults.style.display = 'block';
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchInput.value = ''; searchResults.style.display = 'none'; searchInput.blur(); }
  if (e.key === 'Enter') {
    const first = searchResults.querySelector('.search__item');
    if (first) first.click();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-wrapper')) searchResults.style.display = 'none';
});

function flyToNode(id) {
  searchInput.value = '';
  searchResults.style.display = 'none';
  const mesh = state.nodeMeshes.get(id);
  if (!mesh) return;
  const target = mesh.position.clone();
  flyStart = { cam: camera.position.clone(), tgt: controls.target.clone() };
  flyTarget = { cam: target.clone().add(new THREE.Vector3(0, 30, 60)), tgt: target };
  flyProgress = 0;
  selectNode(id);
}

// --- Bucle principal de animación ---
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  controls.update();

  // Animación de vuelo de cámara hacia un nodo
  if (flyProgress >= 0 && flyProgress < 1) {
    flyProgress = Math.min(flyProgress + 0.02, 1);
    const ease = flyProgress < 0.5 ? 2 * flyProgress * flyProgress : 1 - Math.pow(-2 * flyProgress + 2, 2) / 2;
    camera.position.lerpVectors(flyStart.cam, flyTarget.cam, ease);
    controls.target.lerpVectors(flyStart.tgt, flyTarget.tgt, ease);
    if (flyProgress >= 1) flyProgress = -1;
  }

  // Animaciones de aparición y desaparición de nodos
  state.setAnimQueue(state.animQueue.filter(a => {
    a.progress = Math.min(a.progress + 0.04, 1);
    const mesh = state.nodeMeshes.get(a.id);
    const label = state.labelSprites.get(a.id);
    if (!mesh) { if (a.onDone) a.onDone(); return false; }
    if (a.type === 'spawn') {
      const s = a.progress * a.progress * (3 - 2 * a.progress); // Interpolación suave (smoothstep)
      mesh.scale.setScalar(s);
      if (label) label.scale.set(30 * s, 8 * s, 1);
    } else {
      const s = 1 - a.progress;
      mesh.scale.setScalar(s);
      if (label) label.scale.set(30 * s, 8 * s, 1);
    }
    if (a.progress >= 1) { if (a.onDone) a.onDone(); return false; }
    return true;
  }));

  // Rotación de anillos orbitales
  state.nodeMeshes.forEach(mesh => {
    mesh.children.forEach(child => {
      if (child.userData.isRing) {
        child.rotation.x = t * 0.5 + mesh.userData.nodeId;
        child.rotation.y = t * 0.3;
      }
    });
  });

  // Pulso de opacidad en las conexiones
  state.edgeLines.forEach(line => {
    const pulse = (Math.sin(t * 2 + line.userData.edgeId) + 1) / 2;
    line.material.opacity = 0.15 + pulse * 0.2;
  });

  // Movimiento de partículas por las conexiones
  state.particleSystems.forEach(p => {
    const sM = state.nodeMeshes.get(p.userData.source);
    const tM = state.nodeMeshes.get(p.userData.target);
    if (!sM || !tM) return;
    const progress = ((t * 0.3 + p.userData.offset) % 1);
    const pos = sM.position.clone().lerp(tM.position, progress);
    p.geometry.attributes.position.setXYZ(0, pos.x, pos.y, pos.z);
    p.geometry.attributes.position.needsUpdate = true;
  });

  // Simulación de fuerzas (auto-layout tipo Skynet)
  const dragId = draggedNode ? draggedNode.userData.nodeId : null;
  stepPhysics(dragId);
  updateEdgePositions();

  // Flotación sutil sobre la posición calculada por la física
  state.nodeMeshes.forEach((mesh, id) => {
    if (draggedNode === mesh) return;
    mesh.position.y += Math.sin(t + id) * 0.3;
    const label = state.labelSprites.get(id);
    if (label) label.position.y = mesh.position.y + 10;
  });

  renderer.render(scene, camera);
}

// --- Registro de event listeners ---
document.getElementById('burger-btn').addEventListener('click', toggleMenu);
document.getElementById('add-node-btn').addEventListener('click', addNode);
document.getElementById('linkBtn').addEventListener('click', toggleLinkMode);
document.getElementById('tagFilterBtn').addEventListener('click', toggleTagFilter);
document.getElementById('close-panel-btn').addEventListener('click', closePanel);
document.getElementById('content-edit-btn').addEventListener('click', startEditContent);
document.getElementById('content-done-btn').addEventListener('click', finishEditContent);
document.getElementById('save-node-btn').addEventListener('click', saveNode);
document.getElementById('delete-node-btn').addEventListener('click', deleteNode);
document.getElementById('disconnect-node-btn').addEventListener('click', deleteEdgesOfNode);

document.getElementById('node-title').addEventListener('input', e => {
  e.target.classList.remove('is-invalid');
});

document.getElementById('retry-btn').addEventListener('click', () => {
  errorState.style.display = 'none';
  loadingState.style.display = '';
  loadGraph();
});

// --- Inicialización ---
await loadGraph();
renderTagFilter();
animate();
