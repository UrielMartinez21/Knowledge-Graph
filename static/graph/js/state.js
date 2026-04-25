// --- Estado compartido de la aplicación ---
export let nodes = [];
export let edges = [];
export let allTags = [];
export let activeFilterTag = null;
export const nodeMeshes = new Map();
export const edgeLines = new Map();
export const labelSprites = new Map();
export let particleSystems = [];
export let selectedNode = null;
export let linkMode = false;
export let linkSource = null;
export let animQueue = [];

// Setters para reasignar arrays y primitivos desde otros módulos
export function setNodes(v) { nodes = v; }
export function setEdges(v) { edges = v; }
export function setAllTags(v) { allTags = v; }
export function setActiveFilterTag(v) { activeFilterTag = v; }
export function setParticleSystems(v) { particleSystems = v; }
export function setSelectedNode(v) { selectedNode = v; }
export function setLinkMode(v) { linkMode = v; }
export function setLinkSource(v) { linkSource = v; }
export function setAnimQueue(v) { animQueue = v; }
