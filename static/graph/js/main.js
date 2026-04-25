import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- State ---
let nodes = [], edges = [];
let allTags = [];  // all tags from DB
let activeFilterTag = null;  // currently filtered tag id, null = show all
let nodeMeshes = new Map();   // id -> mesh
let edgeLines = new Map();    // id -> line
let labelSprites = new Map(); // id -> sprite
let particleSystems = [];
let selectedNode = null;
let linkMode = false, linkSource = null;
let clock = new THREE.Clock();
let animQueue = [];  // { type, id, progress, mesh, label, onDone }

// --- Scene setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.003);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 80, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x0a0a0f);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;

// --- Lights ---
scene.add(new THREE.AmbientLight(0x112233, 1));
const pointLight = new THREE.PointLight(0x00d4ff, 2, 500);
pointLight.position.set(0, 100, 0);
scene.add(pointLight);

// --- Grid ---
const gridHelper = new THREE.GridHelper(600, 40, 0x0d1520, 0x0d1520);
gridHelper.position.y = -50;
scene.add(gridHelper);

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- API ---
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(url, opts)).json();
}

// --- Node visuals ---
const nodeGeo = new THREE.SphereGeometry(5, 24, 24);
const ringGeo = new THREE.RingGeometry(7, 8, 6);

function createNodeMesh(n) {
  const mat = new THREE.MeshPhongMaterial({
    color: 0x00d4ff, emissive: 0x003344, transparent: true, opacity: 0.85,
  });
  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.userData = { nodeId: n.id };
  scene.add(mesh);

  // Glow sprite
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0x00d4ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(30, 30, 1);
  mesh.add(glow);

  // Ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.userData.isRing = true;
  mesh.add(ring);

  // Label
  const sprite = makeLabel(n.title);
  sprite.position.set(n.x, n.y + 10, n.z);
  scene.add(sprite);
  labelSprites.set(n.id, sprite);

  nodeMeshes.set(n.id, mesh);
  // Spawn animation
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

function updateLabel(id, text) {
  const old = labelSprites.get(id);
  if (old) { scene.remove(old); old.material.map.dispose(); old.material.dispose(); }
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const sprite = makeLabel(text);
  sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 10, 0));
  scene.add(sprite);
  labelSprites.set(id, sprite);
}

// --- Edge visuals ---
function createEdgeLine(e) {
  const sM = nodeMeshes.get(e.source);
  const tM = nodeMeshes.get(e.target);
  if (!sM || !tM) return;
  const geo = new THREE.BufferGeometry().setFromPoints([sM.position, tM.position]);
  const mat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.25 });
  const line = new THREE.Line(geo, mat);
  line.userData = { edgeId: e.id, source: e.source, target: e.target };
  scene.add(line);
  edgeLines.set(e.id, line);

  // Particle
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const pMat = new THREE.PointsMaterial({ color: 0x00d4ff, size: 2, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
  const particle = new THREE.Points(pGeo, pMat);
  particle.userData = { source: e.source, target: e.target, offset: Math.random() };
  scene.add(particle);
  particleSystems.push(particle);
}

function updateEdgePositions() {
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

// --- Load ---
async function loadGraph() {
  const data = await api('/api/graph/');
  nodes = data.nodes;
  allTags = data.tags || [];
  edges = data.edges.map(e => ({ id: e.id, source: e.source_id, target: e.target_id }));
  nodes.forEach(n => { n.tags = n.tags || []; createNodeMesh(n); });
  edges.forEach(e => createEdgeLine(e));
  document.getElementById('hud-count').textContent = nodes.length;
}

// --- Actions (exposed to window) ---
window.addNode = async function () {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone().add(dir.multiplyScalar(80));
  const spread = 40;
  const x = pos.x + (Math.random() - 0.5) * spread;
  const y = pos.y + (Math.random() - 0.5) * spread;
  const z = pos.z + (Math.random() - 0.5) * spread;
  const n = await api('/api/nodes/', 'POST', { title: 'Nuevo nodo', content: '', x, y, z });
  n.tags = n.tags || [];
  nodes.push(n);
  createNodeMesh(n);
  document.getElementById('hud-count').textContent = nodes.length;
  selectNode(n.id);
};

window.saveNode = async function () {
  if (!selectedNode) return;
  const title = document.getElementById('node-title').value;
  const content = document.getElementById('node-content').value;
  await api(`/api/nodes/${selectedNode}/`, 'PUT', { title, content });
  const n = nodes.find(n => n.id === selectedNode);
  if (n) { n.title = title; n.content = content; }
  updateLabel(selectedNode, title);
};

window.deleteNode = async function () {
  if (!selectedNode) return;
  const id = selectedNode;
  closePanel();
  await api(`/api/nodes/${id}/delete/`, 'DELETE');
  // Remove connected edges immediately
  edges.filter(e => e.source === id || e.target === id).forEach(e => {
    const line = edgeLines.get(e.id);
    if (line) scene.remove(line);
    edgeLines.delete(e.id);
  });
  particleSystems = particleSystems.filter(p => {
    if (p.userData.source === id || p.userData.target === id) { scene.remove(p); return false; }
    return true;
  });
  edges = edges.filter(e => e.source !== id && e.target !== id);
  nodes = nodes.filter(n => n.id !== id);
  document.getElementById('hud-count').textContent = nodes.length;
  // Animate out then remove
  animQueue.push({ type: 'despawn', id, progress: 0, onDone: () => {
    const mesh = nodeMeshes.get(id);
    if (mesh) scene.remove(mesh);
    nodeMeshes.delete(id);
    const label = labelSprites.get(id);
    if (label) scene.remove(label);
    labelSprites.delete(id);
  }});
};

window.deleteEdgesOfNode = async function () {
  if (!selectedNode) return;
  const toDelete = edges.filter(e => e.source === selectedNode || e.target === selectedNode);
  for (const e of toDelete) {
    await api(`/api/edges/${e.id}/delete/`, 'DELETE');
    const line = edgeLines.get(e.id);
    if (line) scene.remove(line);
    edgeLines.delete(e.id);
  }
  particleSystems = particleSystems.filter(p => {
    if (p.userData.source === selectedNode || p.userData.target === selectedNode) { scene.remove(p); return false; }
    return true;
  });
  edges = edges.filter(e => e.source !== selectedNode && e.target !== selectedNode);
};

window.toggleLinkMode = function () {
  linkMode = !linkMode; linkSource = null;
  document.getElementById('mode-indicator').style.display = linkMode ? 'block' : 'none';
  document.getElementById('linkBtn').style.borderColor = linkMode ? '#ff6400' : '';
  controls.enabled = !linkMode;
};

function selectNode(id) {
  if (selectedNode) {
    const prev = nodeMeshes.get(selectedNode);
    if (prev) { prev.material.color.setHex(0x00d4ff); prev.material.emissive.setHex(0x003344); }
  }
  selectedNode = id;
  const mesh = nodeMeshes.get(id);
  if (mesh) { mesh.material.color.setHex(0xff6400); mesh.material.emissive.setHex(0x331100); }
  const n = nodes.find(n => n.id === id);
  if (!n) return;
  document.getElementById('node-title').value = n.title;
  document.getElementById('node-content').value = n.content;
  document.getElementById('panel-title').textContent = `Nodo #${n.id}`;
  updatePreview(n.content);
  showPreviewMode();
  renderNodeTags(n);
  document.getElementById('panel').classList.add('open');
}

window.closePanel = function () {
  if (selectedNode) {
    const prev = nodeMeshes.get(selectedNode);
    if (prev) { prev.material.color.setHex(0x00d4ff); prev.material.emissive.setHex(0x003344); }
  }
  document.getElementById('panel').classList.remove('open');
  selectedNode = null;
};

// --- Click / Drag detection ---
let mouseDown = false, mouseMoved = false, mouseDownPos = { x: 0, y: 0 };
let draggedNode = null, dragPlane = new THREE.Plane();

renderer.domElement.addEventListener('mousedown', e => {
  mouseDown = true; mouseMoved = false;
  mouseDownPos = { x: e.clientX, y: e.clientY };

  if (linkMode) return;

  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...nodeMeshes.values()]);
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
      const label = labelSprites.get(draggedNode.userData.nodeId);
      if (label) label.position.copy(intersection).add(new THREE.Vector3(0, 10, 0));
      updateEdgePositions();
    }
  }
});

renderer.domElement.addEventListener('mouseup', e => {
  if (draggedNode) {
    const id = draggedNode.userData.nodeId;
    const p = draggedNode.position;
    api(`/api/nodes/${id}/`, 'PUT', { x: p.x, y: p.y, z: p.z });
    const n = nodes.find(n => n.id === id);
    if (n) { n.x = p.x; n.y = p.y; n.z = p.z; }
    draggedNode = null;
    controls.enabled = !linkMode;
  }
  mouseDown = false;
});

renderer.domElement.addEventListener('click', e => {
  if (mouseMoved) return;
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([...nodeMeshes.values()]);

  if (linkMode && hits.length > 0) {
    const id = hits[0].object.userData.nodeId;
    if (!linkSource) { linkSource = id; }
    else {
      (async () => {
        if (linkSource === id) return;
        if (edges.find(e => (e.source === linkSource && e.target === id) || (e.source === id && e.target === linkSource))) return;
        const ed = await api('/api/edges/', 'POST', { source: linkSource, target: id });
        const newEdge = { id: ed.id, source: ed.source_id, target: ed.target_id };
        edges.push(newEdge);
        createEdgeLine(newEdge);
        linkSource = null;
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
  const hits = raycaster.intersectObjects([...nodeMeshes.values()]);
  if (hits.length > 0) selectNode(hits[0].object.userData.nodeId);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (linkMode) toggleLinkMode(); closePanel(); }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Markdown Preview ---
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

window.startEditContent = function () {
  showEditMode();
};

window.finishEditContent = async function () {
  const text = contentTextarea.value;
  updatePreview(text);
  showPreviewMode();
  if (selectedNode) {
    const title = document.getElementById('node-title').value;
    await api(`/api/nodes/${selectedNode}/`, 'PUT', { title, content: text });
    const n = nodes.find(n => n.id === selectedNode);
    if (n) { n.content = text; }
  }
};

// --- Tags ---
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
    pill.innerHTML = `${t.name} <span class="tag-remove" data-tag="${t.id}">✕</span>`;
    pill.querySelector('.tag-remove').addEventListener('click', () => removeTagFromNode(n.id, t.id));
    nodeTags.appendChild(pill);
  });
}

async function removeTagFromNode(nodeId, tagId) {
  await api(`/api/nodes/${nodeId}/tags/${tagId}/`, 'DELETE');
  const n = nodes.find(n => n.id === nodeId);
  if (n) { n.tags = n.tags.filter(t => t.id !== tagId); renderNodeTags(n); }
}

async function addTagToNode(nodeId, tag) {
  const n = nodes.find(n => n.id === nodeId);
  if (!n || n.tags.find(t => t.id === tag.id)) return;
  await api(`/api/nodes/${nodeId}/tags/`, 'POST', { tag_id: tag.id });
  n.tags.push(tag);
  renderNodeTags(n);
  renderTagFilter();
}

tagInput.addEventListener('input', () => {
  const q = tagInput.value.toLowerCase().trim();
  tagSuggestions.innerHTML = '';
  if (!q) { tagSuggestions.style.display = 'none'; return; }
  const n = nodes.find(n => n.id === selectedNode);
  const currentIds = new Set((n?.tags || []).map(t => t.id));
  const matches = allTags.filter(t => t.name.toLowerCase().includes(q) && !currentIds.has(t.id)).slice(0, 8);
  matches.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tag-suggestion';
    div.innerHTML = `<span class="tag-color-dot" style="background:${t.color}"></span>${t.name}`;
    div.addEventListener('click', () => { addTagToNode(selectedNode, t); tagInput.value = ''; tagSuggestions.style.display = 'none'; });
    tagSuggestions.appendChild(div);
  });
  // Option to create new tag
  if (!allTags.find(t => t.name.toLowerCase() === q)) {
    const div = document.createElement('div');
    div.className = 'tag-suggestion tag-create';
    div.textContent = `+ Crear "${tagInput.value.trim()}"`;
    div.addEventListener('click', async () => {
      const tag = await api('/api/tags/create/', 'POST', { name: tagInput.value.trim() });
      allTags.push(tag);
      await addTagToNode(selectedNode, tag);
      tagInput.value = '';
      tagSuggestions.style.display = 'none';
    });
    tagSuggestions.appendChild(div);
  }
  tagSuggestions.style.display = 'block';
});

tagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const first = tagSuggestions.querySelector('.tag-suggestion');
    if (first) first.click();
  }
});

// --- Tag Filter ---
const tagFilterEl = document.getElementById('tag-filter');

window.toggleTagFilter = function () {
  tagFilterEl.classList.toggle('open');
};

// Close tag filter when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#tag-filter-wrapper')) tagFilterEl.classList.remove('open');
});

function renderTagFilter() {
  tagFilterEl.innerHTML = '';
  tagFilterEl.classList.remove('open');
  allTags.forEach(t => {
    const pill = document.createElement('button');
    pill.className = 'filter-pill' + (activeFilterTag === t.id ? ' active' : '');
    pill.style.borderColor = t.color;
    pill.style.color = t.color;
    pill.textContent = t.name;
    pill.addEventListener('click', () => {
      activeFilterTag = activeFilterTag === t.id ? null : t.id;
      applyTagFilter();
      renderTagFilter();
    });
    tagFilterEl.appendChild(pill);
  });
}

function applyTagFilter() {
  nodeMeshes.forEach((mesh, id) => {
    if (id === selectedNode) return; // don't touch selected node
    const n = nodes.find(n => n.id === id);
    const match = !activeFilterTag || (n?.tags || []).some(t => t.id === activeFilterTag);
    mesh.material.opacity = match ? 0.85 : 0.1;
    mesh.children.forEach(child => {
      if (child.material) child.material.opacity = match ? (child.userData.isRing ? 0.2 : 0.3) : 0.03;
    });
    const label = labelSprites.get(id);
    if (label) label.material.opacity = match ? 1 : 0.1;
  });
  edgeLines.forEach(line => {
    if (!activeFilterTag) { line.material.opacity = 0.25; return; }
    const sNode = nodes.find(n => n.id === line.userData.source);
    const tNode = nodes.find(n => n.id === line.userData.target);
    const sMatch = (sNode?.tags || []).some(t => t.id === activeFilterTag);
    const tMatch = (tNode?.tags || []).some(t => t.id === activeFilterTag);
    line.material.opacity = (sMatch && tMatch) ? 0.25 : 0.03;
  });
}

// --- Search ---
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let flyTarget = null, flyStart = null, flyProgress = -1;

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  searchResults.innerHTML = '';
  if (!q) { searchResults.style.display = 'none'; return; }
  const matches = nodes.filter(n =>
    n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))
  ).slice(0, 10);
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  matches.forEach(n => {
    const div = document.createElement('div');
    div.className = 'search-item';
    div.innerHTML = `${n.title} <small>#${n.id}</small>`;
    div.addEventListener('click', () => flyToNode(n.id));
    searchResults.appendChild(div);
  });
  searchResults.style.display = 'block';
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchInput.value = ''; searchResults.style.display = 'none'; searchInput.blur(); }
  if (e.key === 'Enter') {
    const first = searchResults.querySelector('.search-item');
    if (first) first.click();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-wrapper')) searchResults.style.display = 'none';
});

function flyToNode(id) {
  searchInput.value = '';
  searchResults.style.display = 'none';
  const mesh = nodeMeshes.get(id);
  if (!mesh) return;
  const target = mesh.position.clone();
  flyStart = { cam: camera.position.clone(), tgt: controls.target.clone() };
  flyTarget = { cam: target.clone().add(new THREE.Vector3(0, 30, 60)), tgt: target };
  flyProgress = 0;
  selectNode(id);
}

// --- Animate ---
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  controls.update();

  // Camera fly animation
  if (flyProgress >= 0 && flyProgress < 1) {
    flyProgress = Math.min(flyProgress + 0.02, 1);
    const ease = flyProgress < 0.5 ? 2 * flyProgress * flyProgress : 1 - Math.pow(-2 * flyProgress + 2, 2) / 2;
    camera.position.lerpVectors(flyStart.cam, flyTarget.cam, ease);
    controls.target.lerpVectors(flyStart.tgt, flyTarget.tgt, ease);
    if (flyProgress >= 1) flyProgress = -1;
  }

  // Node spawn/despawn animations
  animQueue = animQueue.filter(a => {
    a.progress = Math.min(a.progress + 0.04, 1);
    const mesh = nodeMeshes.get(a.id);
    const label = labelSprites.get(a.id);
    if (!mesh) { if (a.onDone) a.onDone(); return false; }
    if (a.type === 'spawn') {
      const s = a.progress * a.progress * (3 - 2 * a.progress); // smoothstep
      mesh.scale.setScalar(s);
      if (label) label.scale.set(30 * s, 8 * s, 1);
    } else {
      const s = 1 - a.progress;
      mesh.scale.setScalar(s);
      if (label) label.scale.set(30 * s, 8 * s, 1);
    }
    if (a.progress >= 1) { if (a.onDone) a.onDone(); return false; }
    return true;
  });

  // Animate rings
  nodeMeshes.forEach(mesh => {
    mesh.children.forEach(child => {
      if (child.userData.isRing) {
        child.rotation.x = t * 0.5 + mesh.userData.nodeId;
        child.rotation.y = t * 0.3;
      }
    });
  });

  // Animate edge opacity
  edgeLines.forEach(line => {
    const pulse = (Math.sin(t * 2 + line.userData.edgeId) + 1) / 2;
    line.material.opacity = 0.15 + pulse * 0.2;
  });

  // Animate particles
  particleSystems.forEach(p => {
    const sM = nodeMeshes.get(p.userData.source);
    const tM = nodeMeshes.get(p.userData.target);
    if (!sM || !tM) return;
    const progress = ((t * 0.3 + p.userData.offset) % 1);
    const pos = sM.position.clone().lerp(tM.position, progress);
    p.geometry.attributes.position.setXYZ(0, pos.x, pos.y, pos.z);
    p.geometry.attributes.position.needsUpdate = true;
  });

  // Subtle node float
  nodeMeshes.forEach((mesh, id) => {
    const n = nodes.find(n => n.id === id);
    if (n && draggedNode !== mesh) {
      mesh.position.y = n.y + Math.sin(t + id) * 0.5;
    }
  });

  renderer.render(scene, camera);
}

await loadGraph();
renderTagFilter();
animate();
