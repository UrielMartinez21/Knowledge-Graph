import * as THREE from 'three';
import { scene, camera, renderer, controls, raycaster, mouse, clock } from './scene.js';
import { api, showToast } from './api.js';
import { createNodeMesh, createEdgeLine, updateLabel, updateEdgePositions, refreshNodeSizes, updateNodeType } from './visuals.js';
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
    refreshNodeSizes();
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    updateEmptyState();
  } catch (err) {
    loadingState.style.display = 'none';
    errorState.style.display = '';
    console.error(err);
  }
}

// --- Modal de creación ---
const createModal = document.getElementById('create-modal');
const createTitleInput = document.getElementById('create-title');
const createContentInput = document.getElementById('create-content');
const createSubmitBtn = document.getElementById('create-submit-btn');
const createTagsEl = document.getElementById('create-tags');
const createTagInput = document.getElementById('create-tag-input');
const createTagSuggestions = document.getElementById('create-tag-suggestions');
let createSelectedTags = [];

// --- Templates de contenido ---
const NODE_TEMPLATES = {
  blank: '',
  category: `## Descripción\n\n\n## Subcategorías\n- \n\n## Notas\n- \n`,
  item: `## Descripción\n\n\n## Detalles\n- \n\n## Estado\n\n\n## Notas\n- \n`,
  process: `## Descripción\n\n\n## Flujo\n1. \n2. \n3. \n\n## Componentes\n- \n\n## Estado\n\n\n## Notas\n- \n`,
  record: `## Descripción\n\n\n## Historial\n| Fecha | Evento | Detalle | Estado |\n|-------|--------|---------|--------|\n| | | | |\n\n## Seguimiento\n- \n\n## Notas\n- \n`,
  list: `## Descripción\n\n\n## Elementos\n- \n\n## Pendientes\n- \n\n## Notas\n- \n`,
};

const createTemplateSelect = document.getElementById('create-template');

createTemplateSelect.addEventListener('change', () => {
  const template = NODE_TEMPLATES[createTemplateSelect.value] || '';
  // Only apply template if textarea is empty or matches a previous template
  const current = createContentInput.value;
  const isTemplateContent = Object.values(NODE_TEMPLATES).some(t => t === current);
  if (!current.trim() || isTemplateContent) {
    createContentInput.value = template;
  }
});

function openCreateModal() {
  createTitleInput.value = '';
  createContentInput.value = '';
  createTagInput.value = '';
  createSelectedTags = [];
  createTemplateSelect.value = 'blank';
  document.getElementById('create-node-type').value = 'normal';
  renderCreateTags();
  createSubmitBtn.disabled = false;
  createModal.style.display = '';
  setTimeout(() => createTitleInput.focus(), 50);
}

function closeCreateModal() { createModal.style.display = 'none'; }

function renderCreateTags() {
  createTagsEl.innerHTML = '';
  createSelectedTags.forEach(t => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.style.borderColor = t.color;
    pill.style.color = t.color;
    pill.innerHTML = `${t.name} <span class="tag-pill__remove">✕</span>`;
    pill.querySelector('.tag-pill__remove').addEventListener('click', () => {
      createSelectedTags = createSelectedTags.filter(x => x.id !== t.id);
      renderCreateTags();
    });
    createTagsEl.appendChild(pill);
  });
}

createTagInput.addEventListener('input', () => {
  const q = createTagInput.value.toLowerCase().trim();
  createTagSuggestions.innerHTML = '';
  if (!q) { createTagSuggestions.style.display = 'none'; return; }
  const currentIds = new Set(createSelectedTags.map(t => t.id));
  const matches = state.allTags.filter(t => t.name.toLowerCase().includes(q) && !currentIds.has(t.id)).slice(0, 8);
  matches.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tag-add__option';
    div.innerHTML = `<span class="tag-color-dot" style="background:${t.color}"></span>${t.name}`;
    div.addEventListener('click', () => { createSelectedTags.push(t); renderCreateTags(); createTagInput.value = ''; createTagSuggestions.style.display = 'none'; });
    createTagSuggestions.appendChild(div);
  });
  if (!state.allTags.find(t => t.name.toLowerCase() === q)) {
    const div = document.createElement('div');
    div.className = 'tag-add__option tag-add__option--create';
    div.textContent = `+ Crear "${createTagInput.value.trim()}"`;
    div.addEventListener('click', async () => {
      try {
        const tag = await api('/api/tags/', 'POST', { name: createTagInput.value.trim() });
        state.allTags.push(tag);
        createSelectedTags.push(tag);
        renderCreateTags();
        renderTagBar();
      } catch (err) { showToast('Error al crear tag'); }
      createTagInput.value = '';
      createTagSuggestions.style.display = 'none';
    });
    createTagSuggestions.appendChild(div);
  }
  createTagSuggestions.style.display = 'block';
});

createTagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const first = createTagSuggestions.querySelector('.tag-add__option'); if (first) first.click(); }
});

async function submitCreateModal() {
  const title = createTitleInput.value.trim();
  if (!title) { createTitleInput.focus(); return; }
  if (state.nodes.some(n => n.title.toLowerCase() === title.toLowerCase())) {
    showToast('Ya existe un nodo con ese nombre'); return;
  }
  const content = createContentInput.value;
  const nodeType = document.getElementById('create-node-type').value;
  createSubmitBtn.disabled = true;
  try {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone().add(dir.multiplyScalar(80));
    const spread = 40;
    const x = pos.x + (Math.random() - 0.5) * spread;
    const y = pos.y + (Math.random() - 0.5) * spread;
    const z = pos.z + (Math.random() - 0.5) * spread;
    const n = await api('/api/nodes/', 'POST', { title, content, x, y, z, node_type: nodeType });
    n.tags = [];
    // Asignar tags seleccionados
    for (const tag of createSelectedTags) {
      await api(`/api/nodes/${n.id}/tags/`, 'POST', { tag_id: tag.id });
      n.tags.push(tag);
    }
    state.nodes.push(n);
    createNodeMesh(n);
    updateEmptyState();
    closeCreateModal();
    showToast('Nodo creado', 'success');
  } catch (err) {
    showToast('Error al crear nodo');
    console.error(err);
  } finally {
    createSubmitBtn.disabled = false;
  }
}

createModal.querySelector('.modal__backdrop').addEventListener('click', closeCreateModal);
document.getElementById('create-cancel-btn').addEventListener('click', closeCreateModal);
createSubmitBtn.addEventListener('click', submitCreateModal);
createTitleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); createContentInput.focus(); } });
createContentInput.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitCreateModal(); });

async function saveNode() {
  if (!state.selectedNode) return;
  const titleInput = document.getElementById('node-title');
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.classList.add('is-invalid');
    showToast('El título no puede estar vacío');
    return;
  }
  const duplicate = state.nodes.find(n => n.id !== state.selectedNode && n.title.toLowerCase() === title.toLowerCase());
  if (duplicate) {
    titleInput.classList.add('is-invalid');
    showToast('Ya existe un nodo con ese nombre');
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
    state.setEdges(state.edges.filter(e => e.source !== id && e.target !== id));
    state.setNodes(state.nodes.filter(n => n.id !== id));
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
  controls.enabled = !state.linkMode;
}

function selectNode(id) {
  if (state.selectedNode) {
    const prev = state.nodeMeshes.get(state.selectedNode);
    if (prev) {
      const prevNode = state.nodes.find(n => n.id === state.selectedNode);
      const prevColor = prevNode && prevNode.node_type === 'main' ? 0xffd700 : prevNode && prevNode.node_type === 'secondary' ? 0x00e88f : 0xffffff;
      prev.material.color.setHex(prevColor);
      prev.material.opacity = 0.9;
    }
  }
  state.setSelectedNode(id);
  const mesh = state.nodeMeshes.get(id);
  if (mesh) { mesh.material.color.setHex(0xff44cc); mesh.material.opacity = 1.0; }
  const n = state.nodes.find(n => n.id === id);
  if (!n) return;
  document.getElementById('node-title').value = n.title;
  document.getElementById('node-content').value = n.content;
  document.getElementById('panel-title').textContent = 'Editar';
  updatePreview(n.content);
  showPreviewMode();
  renderNodeTags(n);
  renderNodeConnections(n.id);
  loadNodeImages(n.id);
  updateNodeTypeSelect(n);
  const panelEl = document.getElementById('panel');
  panelEl.classList.add('is-open');
  panelEl.setAttribute('aria-hidden', 'false');
}

function closePanel() {
  if (state.selectedNode) {
    const prev = state.nodeMeshes.get(state.selectedNode);
    if (prev) {
      const prevNode = state.nodes.find(n => n.id === state.selectedNode);
      const prevColor = prevNode && prevNode.node_type === 'main' ? 0xffd700 : prevNode && prevNode.node_type === 'secondary' ? 0x00e88f : 0xffffff;
      prev.material.color.setHex(prevColor);
      prev.material.opacity = 0.9;
    }
  }
  const panelEl = document.getElementById('panel');
  panelEl.classList.remove('is-open');
  panelEl.setAttribute('aria-hidden', 'true');
  state.setSelectedNode(null);
}

// --- Node type selector ---
const editNodeTypeSelect = document.getElementById('edit-node-type');

function updateNodeTypeSelect(n) {
  editNodeTypeSelect.value = n.node_type || 'normal';
  // Disable "main" option if another main node already exists
  const mainOption = editNodeTypeSelect.querySelector('option[value="main"]');
  const existingMain = state.nodes.find(nd => nd.node_type === 'main' && nd.id !== n.id);
  mainOption.disabled = !!existingMain;
}

editNodeTypeSelect.addEventListener('change', async () => {
  if (!state.selectedNode) return;
  const n = state.nodes.find(n => n.id === state.selectedNode);
  if (!n) return;
  const newType = editNodeTypeSelect.value;
  const oldType = n.node_type;
  try {
    await api(`/api/nodes/${n.id}/`, 'PUT', { node_type: newType });
    n.node_type = newType;
    updateNodeType(n.id, newType);
    updateLabel(n.id, n.title);
    showToast(`Nodo cambiado a ${newType === 'main' ? 'principal' : newType === 'secondary' ? 'secundario' : 'normal'}`);
  } catch (err) {
    // Revert on error
    editNodeTypeSelect.value = oldType;
    showToast(err?.response?.data?.error || 'Error al cambiar tipo de nodo');
    console.error(err);
  }
});

// --- Detección de clics y arrastre de nodos (pointer events: mouse + touch) ---
let mouseDown = false, mouseMoved = false, mouseDownPos = { x: 0, y: 0 };
let draggedNode = null, dragPlane = new THREE.Plane();
let tapTimeout = null, lastTapTime = 0;

function getPointerCoords(e) {
  const x = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const y = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  return { x, y };
}

renderer.domElement.addEventListener('pointerdown', e => {
  // Ignore multi-touch (let OrbitControls handle pinch/rotate)
  if (e.pointerType === 'touch' && e.isPrimary === false) return;
  mouseDown = true; mouseMoved = false;
  const { x, y } = getPointerCoords(e);
  mouseDownPos = { x, y };
  if (state.linkMode) return;
  mouse.x = (x / innerWidth) * 2 - 1;
  mouse.y = -(y / innerHeight) * 2 + 1;
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

renderer.domElement.addEventListener('pointermove', e => {
  const { x, y } = getPointerCoords(e);
  if (Math.abs(x - mouseDownPos.x) > 3 || Math.abs(y - mouseDownPos.y) > 3) mouseMoved = true;
  if (draggedNode) {
    mouse.x = (x / innerWidth) * 2 - 1;
    mouse.y = -(y / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, intersection);
    if (intersection) {
      draggedNode.position.copy(intersection);
      const label = state.labelSprites.get(draggedNode.userData.nodeId);
      if (label) label.position.copy(intersection).add(new THREE.Vector3(0, (draggedNode.userData.baseSize || 3) + 4, 0));
      updateEdgePositions();
    }
  }
});

renderer.domElement.addEventListener('pointerup', e => {
  if (draggedNode) {
    const id = draggedNode.userData.nodeId;
    const n = state.nodes.find(n => n.id === id);
    if (n) { n.vx = 0; n.vy = 0; n.vz = 0; }
    draggedNode = null;
    controls.enabled = !state.linkMode;
  }
  mouseDown = false;
});

// Prevent context menu on long-press (mobile)
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

renderer.domElement.addEventListener('click', e => {
  if (mouseMoved) return;
  const { x, y } = getPointerCoords(e);
  mouse.x = (x / innerWidth) * 2 - 1;
  mouse.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
  if (state.linkMode && hits.length > 0) {
    const id = hits[0].object.userData.nodeId;
    if (!state.linkSource) { state.setLinkSource(id); }
    else {
      (async () => {
        if (state.linkSource === id) return;
        if (state.edges.find(e => (e.source === state.linkSource && e.target === id) || (e.source === id && e.target === state.linkSource))) return;
        // Prevent connecting two secondary nodes
        const sourceNode = state.nodes.find(n => n.id === state.linkSource);
        const targetNode = state.nodes.find(n => n.id === id);
        if (sourceNode && targetNode && sourceNode.node_type === 'secondary' && targetNode.node_type === 'secondary') {
          showToast('No se pueden conectar dos nodos secundarios');
          state.setLinkSource(null);
          toggleLinkMode();
          return;
        }
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

// Double-tap / double-click to open node panel
renderer.domElement.addEventListener('dblclick', e => {
  const { x, y } = getPointerCoords(e);
  mouse.x = (x / innerWidth) * 2 - 1;
  mouse.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
  if (hits.length > 0) selectNode(hits[0].object.userData.nodeId);
});

// Tap-to-select on touch: single tap opens the node panel (since dblclick is hard on mobile)
let touchTapTimer = null;
renderer.domElement.addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch' || mouseMoved) return;
  const now = Date.now();
  if (now - lastTapTime < 300) {
    // Double-tap already handled by dblclick emulation
    clearTimeout(touchTapTimer);
    lastTapTime = 0;
    return;
  }
  lastTapTime = now;
  touchTapTimer = setTimeout(() => {
    // Single tap on a node: select it (mobile friendly)
    const { x, y } = getPointerCoords(e);
    mouse.x = (x / innerWidth) * 2 - 1;
    mouse.y = -(y / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...state.nodeMeshes.values()]);
    if (hits.length > 0 && !draggedNode) selectNode(hits[0].object.userData.nodeId);
  }, 300);
}, { passive: true });

// --- FAB button for mobile node creation ---
document.getElementById('fab-create').addEventListener('click', openCreateModal);

document.addEventListener('keydown', e => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (createModal.style.display !== 'none') { closeCreateModal(); return; }
    if (state.linkMode) toggleLinkMode();
    closePanel();
    document.activeElement.blur();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (state.selectedNode) saveNode();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    if (state.selectedNode) startEditContent();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (document.activeElement === document.getElementById('node-content')) finishEditContent();
    return;
  }
  if (typing) return;
  if (e.key === 'n' || e.key === 'N') openCreateModal();
  if (e.key === 'c' || e.key === 'C') toggleLinkMode();
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); searchInput.focus(); }
  if (e.key === 'Delete' && state.selectedNode) deleteNode();
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
// --- Conexiones del nodo ---
const nodeConnectionsEl = document.getElementById('node-connections');

function renderNodeConnections(nodeId) {
  const outEdges = state.edges.filter(e => e.source === nodeId);
  const inEdges = state.edges.filter(e => e.target === nodeId);
  if (outEdges.length === 0 && inEdges.length === 0) {
    nodeConnectionsEl.innerHTML = '<span class="node-connections__empty">Sin conexiones</span>';
    return;
  }
  let html = '';
  if (outEdges.length > 0) {
    html += '<div class="node-connections__group"><div class="node-connections__label">→ Salientes</div><div class="node-connections__list">';
    outEdges.forEach(e => {
      const target = state.nodes.find(n => n.id === e.target);
      if (target) html += `<button class="node-connections__pill" data-node-id="${target.id}">${target.title}</button>`;
    });
    html += '</div></div>';
  }
  if (inEdges.length > 0) {
    html += '<div class="node-connections__group"><div class="node-connections__label">← Entrantes</div><div class="node-connections__list">';
    inEdges.forEach(e => {
      const source = state.nodes.find(n => n.id === e.source);
      if (source) html += `<button class="node-connections__pill" data-node-id="${source.id}">${source.title}</button>`;
    });
    html += '</div></div>';
  }
  nodeConnectionsEl.innerHTML = html;
}

nodeConnectionsEl.addEventListener('click', e => {
  const pill = e.target.closest('.node-connections__pill');
  if (pill) selectNode(parseInt(pill.dataset.nodeId));
});

// --- Conectar con nodo via búsqueda ---
const connectInput = document.getElementById('connect-input');
const connectSuggestions = document.getElementById('connect-suggestions');

connectInput.addEventListener('input', () => {
  const query = connectInput.value.trim().toLowerCase();
  if (!query || !state.selectedNode) { connectSuggestions.style.display = 'none'; return; }
  const currentNode = state.nodes.find(n => n.id === state.selectedNode);
  const connected = state.edges.filter(e => e.source === state.selectedNode || e.target === state.selectedNode)
    .map(e => e.source === state.selectedNode ? e.target : e.source);
  const matches = state.nodes.filter(n => {
    if (n.id === state.selectedNode || connected.includes(n.id)) return false;
    if (!n.title.toLowerCase().includes(query)) return false;
    // Hide secondary nodes from suggestions if current node is also secondary
    if (currentNode && currentNode.node_type === 'secondary' && n.node_type === 'secondary') return false;
    return true;
  });
  if (matches.length === 0) { connectSuggestions.style.display = 'none'; return; }
  const typeIcon = t => t === 'main' ? ' ★' : t === 'secondary' ? ' ◆' : '';
  connectSuggestions.innerHTML = matches.slice(0, 8).map(n => `<div class="connect-add__option" data-id="${n.id}">${n.title}${typeIcon(n.node_type)}</div>`).join('');
  connectSuggestions.style.display = 'block';
});

connectSuggestions.addEventListener('click', async e => {
  const opt = e.target.closest('.connect-add__option');
  if (!opt || !state.selectedNode) return;
  const targetId = parseInt(opt.dataset.id);
  const currentNode = state.nodes.find(n => n.id === state.selectedNode);
  const targetNode = state.nodes.find(n => n.id === targetId);
  if (currentNode && targetNode && currentNode.node_type === 'secondary' && targetNode.node_type === 'secondary') {
    showToast('No se pueden conectar dos nodos secundarios');
    return;
  }
  try {
    const ed = await api('/api/edges/', 'POST', { source: state.selectedNode, target: targetId });
    const newEdge = { id: ed.id, source: ed.source_id, target: ed.target_id };
    state.edges.push(newEdge);
    createEdgeLine(newEdge);
    renderNodeConnections(state.selectedNode);
    connectInput.value = '';
    connectSuggestions.style.display = 'none';
    showToast('Conexión creada', 'success');
  } catch (err) {
    showToast('Error al crear conexión');
  }
});

connectInput.addEventListener('blur', () => { setTimeout(() => { connectSuggestions.style.display = 'none'; }, 150); });

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
    renderTagBar();
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

// --- Sistema de imágenes del nodo ---
const nodeImagesEl = document.getElementById('node-images');
const imageInput = document.getElementById('image-input');
const imageDropZone = document.getElementById('image-drop-zone');

async function loadNodeImages(nodeId) {
  nodeImagesEl.innerHTML = '';
  try {
    const data = await api(`/api/nodes/${nodeId}/images/`);
    (data.images || []).forEach(img => renderImageThumb(nodeId, img));
  } catch (err) {
    console.error('Error loading images:', err);
  }
}

function renderImageThumb(nodeId, img) {
  const item = document.createElement('div');
  item.className = 'node-images__item';
  item.innerHTML = `
    <img src="${img.url}" alt="${img.alt_text || img.filename}" loading="lazy">
    <button class="node-images__copy" title="Copiar markdown">📋</button>
    <button class="node-images__remove" title="Eliminar">✕</button>
  `;
  item.querySelector('.node-images__remove').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api(`/api/nodes/${nodeId}/images/${img.id}/`, 'DELETE');
      item.remove();
      showToast('Imagen eliminada', 'success');
    } catch (err) {
      showToast('Error al eliminar imagen');
    }
  });
  item.querySelector('.node-images__copy').addEventListener('click', (e) => {
    e.stopPropagation();
    const md = `![${img.alt_text || img.filename}](${img.url})`;
    navigator.clipboard.writeText(md).then(() => {
      showToast('Markdown copiado', 'success');
    }).catch(() => {
      // Fallback: insert into content textarea
      const ta = document.getElementById('node-content');
      ta.value += `\n${md}\n`;
      showToast('Markdown insertado en contenido', 'success');
    });
  });
  item.querySelector('img').addEventListener('click', () => {
    window.open(img.url, '_blank');
  });
  nodeImagesEl.appendChild(item);
}

async function uploadImage(nodeId, file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Solo se permiten archivos de imagen');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('La imagen excede 5MB');
    return;
  }
  const formData = new FormData();
  formData.append('image', file);
  formData.append('alt_text', file.name.replace(/\.[^.]+$/, ''));
  try {
    const csrfToken = document.cookie.split('; ').find(c => c.startsWith('csrftoken='))?.split('=')[1] || '';
    const resp = await fetch(`/api/nodes/${nodeId}/images/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrfToken },
      body: formData,
    });
    if (!resp.ok) {
      const err = await resp.json();
      showToast(err.error || 'Error al subir imagen');
      return;
    }
    const img = await resp.json();
    renderImageThumb(nodeId, img);
    showToast('Imagen subida', 'success');
  } catch (err) {
    showToast('Error al subir imagen');
    console.error(err);
  }
}

imageInput.addEventListener('change', () => {
  if (!state.selectedNode || !imageInput.files[0]) return;
  uploadImage(state.selectedNode, imageInput.files[0]);
  imageInput.value = '';
});

// Drag and drop
imageDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageDropZone.classList.add('is-dragover');
});
imageDropZone.addEventListener('dragleave', () => {
  imageDropZone.classList.remove('is-dragover');
});
imageDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageDropZone.classList.remove('is-dragover');
  if (!state.selectedNode) return;
  const file = e.dataTransfer.files[0];
  if (file) uploadImage(state.selectedNode, file);
});

// --- Filtro global por tags (select) ---
const tagSelect = document.getElementById('tag-select');
const tagDeleteBtn = document.getElementById('tag-delete-btn');

function renderTagBar() {
  const current = state.activeFilterTag;
  tagSelect.innerHTML = '<option value="">🏷 Todos los tags</option>';
  state.allTags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === current) opt.selected = true;
    tagSelect.appendChild(opt);
  });
  tagDeleteBtn.style.display = tagSelect.value ? '' : 'none';
}

tagSelect.addEventListener('change', () => {
  const val = tagSelect.value;
  state.setActiveFilterTag(val ? parseInt(val) : null);
  applyTagFilter();
  tagDeleteBtn.style.display = val ? '' : 'none';
});

// --- Modal de confirmación ---
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-modal-title');
const confirmMsg = document.getElementById('confirm-modal-msg');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
let confirmResolve = null;

function showConfirm(title, msg) {
  confirmTitle.textContent = title;
  confirmMsg.textContent = msg;
  confirmModal.style.display = '';
  return new Promise(resolve => { confirmResolve = resolve; });
}

function closeConfirm(result) {
  confirmModal.style.display = 'none';
  if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
}

confirmOkBtn.addEventListener('click', () => closeConfirm(true));
confirmCancelBtn.addEventListener('click', () => closeConfirm(false));
confirmModal.querySelector('.modal__backdrop').addEventListener('click', () => closeConfirm(false));

tagDeleteBtn.addEventListener('click', async () => {
  const tagId = parseInt(tagSelect.value);
  if (!tagId) return;
  const tag = state.allTags.find(t => t.id === tagId);
  const ok = await showConfirm('¿Eliminar tag?', `Se eliminará "${tag?.name || ''}" de todos los nodos.`);
  if (!ok) return;
  try {
    await api(`/api/tags/${tagId}/`, 'DELETE');
  } catch (err) { /* ya eliminado */ }
  state.setAllTags(state.allTags.filter(t => t.id !== tagId));
  state.nodes.forEach(n => { n.tags = (n.tags || []).filter(t => t.id !== tagId); });
  state.setActiveFilterTag(null);
  applyTagFilter();
  renderTagBar();
  if (state.selectedNode) {
    const n = state.nodes.find(n => n.id === state.selectedNode);
    if (n) renderNodeTags(n);
  }
  showToast('Tag eliminado', 'success');
});

function applyTagFilter() {
  state.nodeMeshes.forEach((mesh, id) => {
    if (id === state.selectedNode) return;
    const n = state.nodes.find(n => n.id === id);
    const match = !state.activeFilterTag || (n?.tags || []).some(t => t.id === state.activeFilterTag);
    mesh.material.opacity = match ? 0.9 : 0.1;
    mesh.children.forEach(child => {
      if (child.material) child.material.opacity = match ? 0.15 : 0.02;
    });
    const label = state.labelSprites.get(id);
    if (label) label.material.opacity = match ? 1 : 0.1;
  });
  state.edgeLines.forEach(line => {
    if (!state.activeFilterTag) { line.material.opacity = 0.12; return; }
    const sNode = state.nodes.find(n => n.id === line.userData.source);
    const tNode = state.nodes.find(n => n.id === line.userData.target);
    const sMatch = (sNode?.tags || []).some(t => t.id === state.activeFilterTag);
    const tMatch = (tNode?.tags || []).some(t => t.id === state.activeFilterTag);
    line.material.opacity = (sMatch && tMatch) ? 0.12 : 0.02;
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
    const baseSize = mesh.userData.baseSize || 3;
    if (a.type === 'spawn') {
      const s = a.progress * a.progress * (3 - 2 * a.progress);
      mesh.scale.setScalar(baseSize * s);
      if (label) label.scale.set(24 * s, 6 * s, 1);
    } else {
      const s = 1 - a.progress;
      mesh.scale.setScalar(baseSize * s);
      if (label) label.scale.set(24 * s, 6 * s, 1);
    }
    if (a.progress >= 1) { if (a.onDone) a.onDone(); return false; }
    return true;
  }));

  // Simulación de fuerzas
  const dragId = draggedNode ? draggedNode.userData.nodeId : null;
  stepPhysics(dragId);
  updateEdgePositions();

  // Flotación sutil
  state.nodeMeshes.forEach((mesh, id) => {
    if (draggedNode === mesh) return;
    mesh.position.y += Math.sin(t * 0.8 + id * 0.7) * 0.15;
    const label = state.labelSprites.get(id);
    if (label) label.position.y = mesh.position.y + (mesh.userData.baseSize || 3) + 4;
  });

  renderer.render(scene, camera);
}

// --- Registro de event listeners ---
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
renderTagBar();
animate();
