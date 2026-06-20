"""Auto-clasificación de nodos usando Ollama (llama3.2)."""

import json
import logging

import ollama

from .models import Edge, Node, Tag

logger = logging.getLogger(__name__)

MODEL = 'llama3.2'


def classify_node(node: Node) -> dict:
    """Clasifica un nodo: asigna tags y como máximo 1 conexión."""
    existing_tags = list(Tag.objects.values_list('name', flat=True))
    other_nodes = list(Node.objects.exclude(pk=node.pk).values_list('id', 'title'))

    if not node.title.strip() and not node.content.strip():
        return {'tags_added': [], 'edges_created': []}

    prompt = _build_prompt(node, existing_tags, other_nodes)

    try:
        response = ollama.chat(
            model=MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            format='json',
        )
        result = json.loads(response['message']['content'])
    except Exception as e:
        logger.error("Error en clasificación con Ollama: %s", e)
        return {'tags_added': [], 'edges_created': []}

    tags_added = _apply_tags(node, result.get('tags', []))
    edges_created = _apply_connection(node, result.get('connection'), other_nodes)

    return {'tags_added': tags_added, 'edges_created': edges_created}


def _build_prompt(node: Node, existing_tags: list[str], other_nodes: list[tuple]) -> str:
    nodes_list = ', '.join(f'{nid}:{title}' for nid, title in other_nodes) or 'ninguno'
    tags_list = ', '.join(existing_tags) or 'ninguno'

    return f"""Analiza este nodo de un grafo de conocimiento y clasifícalo.

Título: {node.title}
Contenido: {node.content or '(vacío)'}

Tags existentes en el sistema: [{tags_list}]
Otros nodos existentes (id:título): [{nodes_list}]

Responde SOLO en JSON con esta estructura exacta:
{{"tags": ["tag1", "tag2"], "connection": null}}

Reglas:
- tags: asigna entre 1 y 3 tags. Usa tags existentes si aplican, o sugiere nuevos (nombres cortos, en minúsculas).
- connection: el ID del ÚNICO nodo que sea el PADRE o CATEGORÍA más directa de este nodo. Prioriza relaciones jerárquicas (categoría → subcategoría, tema general → tema específico) sobre relaciones entre pares/hermanos del mismo nivel. Ejemplo: si el nodo es "JavaScript" y existen "Programación" y "Python", conéctalo con "Programación" (su categoría padre), NO con "Python" (un hermano). Si no hay un nodo padre o categoría clara, devuelve null.
- Solo usa IDs de la lista proporcionada.
- No inventes IDs."""


def _apply_tags(node: Node, tag_names: list) -> list[dict]:
    added = []
    for name in tag_names[:3]:
        if not isinstance(name, str) or not name.strip():
            continue
        name = name.strip().lower()[:50]
        tag, _ = Tag.objects.get_or_create(name=name, defaults={'color': '#00d4ff'})
        if not node.tags.filter(pk=tag.pk).exists():
            node.tags.add(tag)
            added.append({'id': tag.id, 'name': tag.name, 'color': tag.color})
    return added


def _apply_connection(node: Node, connection_id, other_nodes: list[tuple]) -> list[dict]:
    if connection_id is None:
        return []
    valid_ids = {nid for nid, _ in other_nodes}
    if not isinstance(connection_id, int) or connection_id not in valid_ids:
        return []
    _, created = Edge.objects.get_or_create(source=node, target_id=connection_id)
    if created:
        edge = Edge.objects.get(source=node, target_id=connection_id)
        return [{'id': edge.id, 'source_id': node.id, 'target_id': connection_id}]
    return []
