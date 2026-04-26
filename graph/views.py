import json
import logging

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import Edge, Node, Tag

logger = logging.getLogger(__name__)


def _parse_body(request: HttpRequest) -> dict:
    """Parsea el body JSON de la petición. Retorna dict o lanza ValueError."""
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        raise ValueError('JSON inválido')
    if not isinstance(data, dict):
        raise ValueError('Se esperaba un objeto JSON')
    return data


def _error(message: str, status: int = 400) -> JsonResponse:
    """Retorna una respuesta de error JSON estandarizada."""
    return JsonResponse({'error': message}, status=status)


def _node_to_dict(node: Node) -> dict:
    """Serializa un nodo a diccionario con formato estándar."""
    return {
        'id': node.id, 'title': node.title, 'content': node.content,
        'x': node.x, 'y': node.y, 'z': node.z,
        'tags': [{'id': t.id, 'name': t.name, 'color': t.color} for t in node.tags.all()],
    }


@ensure_csrf_cookie
def index(request: HttpRequest) -> HttpResponse:
    """Renderiza la página principal del grafo 3D."""
    return render(request, 'graph/index.html')


@require_http_methods(["GET"])
def graph_data(request: HttpRequest) -> JsonResponse:
    """Retorna todos los nodos, aristas y tags del grafo."""
    nodes = [_node_to_dict(n) for n in Node.objects.prefetch_related('tags').all()]
    edges = list(Edge.objects.values('id', 'source_id', 'target_id'))
    tags = list(Tag.objects.values('id', 'name', 'color'))
    return JsonResponse({'nodes': nodes, 'edges': edges, 'tags': tags})


@require_http_methods(["POST"])
def node_create(request: HttpRequest) -> JsonResponse:
    """Crea un nuevo nodo con título, contenido y posición 3D."""
    try:
        data = _parse_body(request)
    except ValueError as e:
        return _error(str(e))
    if 'title' not in data or not str(data['title']).strip():
        return _error('El campo title es requerido')
    node = Node.objects.create(
        title=data['title'],
        content=data.get('content', ''),
        x=data.get('x', 0),
        y=data.get('y', 0),
        z=data.get('z', 0),
    )
    logger.info("Nodo creado", extra={'node_id': node.id, 'title': node.title})
    return JsonResponse({
        'id': node.id, 'title': node.title, 'content': node.content,
        'x': node.x, 'y': node.y, 'z': node.z, 'tags': [],
    }, status=201)


@require_http_methods(["PUT", "DELETE"])
def node_detail(request: HttpRequest, pk: int) -> JsonResponse:
    """Actualiza o elimina un nodo existente."""
    node = get_object_or_404(Node, pk=pk)
    if request.method == 'DELETE':
        node.delete()
        logger.info("Nodo eliminado", extra={'node_id': pk})
        return JsonResponse({'ok': True})
    # PUT
    try:
        data = _parse_body(request)
    except ValueError as e:
        return _error(str(e))
    for field in ('title', 'content', 'x', 'y', 'z'):
        if field in data:
            setattr(node, field, data[field])
    node.save()
    logger.info("Nodo actualizado", extra={'node_id': pk})
    return JsonResponse({
        'id': node.id, 'title': node.title, 'content': node.content,
        'x': node.x, 'y': node.y, 'z': node.z,
    })


@require_http_methods(["POST"])
def edge_create(request: HttpRequest) -> JsonResponse:
    """Crea una arista entre dos nodos (o retorna la existente)."""
    try:
        data = _parse_body(request)
    except ValueError as e:
        return _error(str(e))
    if 'source' not in data or 'target' not in data:
        return _error('Los campos source y target son requeridos')
    if data['source'] == data['target']:
        return _error('Un nodo no puede conectarse a sí mismo')
    get_object_or_404(Node, pk=data['source'])
    get_object_or_404(Node, pk=data['target'])
    edge, created = Edge.objects.get_or_create(
        source_id=data['source'], target_id=data['target'],
    )
    logger.info("Arista creada", extra={'edge_id': edge.id, 'source': data['source'], 'target': data['target']})
    return JsonResponse({
        'id': edge.id, 'source_id': edge.source_id, 'target_id': edge.target_id,
    }, status=201 if created else 200)


@require_http_methods(["DELETE"])
def edge_delete(request: HttpRequest, pk: int) -> JsonResponse:
    """Elimina una arista por su ID."""
    get_object_or_404(Edge, pk=pk)
    Edge.objects.filter(pk=pk).delete()
    logger.info("Arista eliminada", extra={'edge_id': pk})
    return JsonResponse({'ok': True})


# --- Tag endpoints ---


@require_http_methods(["GET", "POST"])
def tag_list_or_create(request: HttpRequest) -> JsonResponse:
    """Lista todos los tags (GET) o crea uno nuevo (POST)."""
    if request.method == 'GET':
        tags = list(Tag.objects.values('id', 'name', 'color'))
        return JsonResponse({'tags': tags})
    # POST
    try:
        data = _parse_body(request)
    except ValueError as e:
        return _error(str(e))
    if 'name' not in data or not str(data['name']).strip():
        return _error('El campo name es requerido')
    tag, created = Tag.objects.get_or_create(
        name=data['name'],
        defaults={'color': data.get('color', '#00d4ff')},
    )
    logger.info("Tag creado", extra={'tag_id': tag.id, 'tag_name': tag.name})
    return JsonResponse(
        {'id': tag.id, 'name': tag.name, 'color': tag.color},
        status=201 if created else 200,
    )


@require_http_methods(["DELETE"])
def tag_delete(request: HttpRequest, pk: int) -> JsonResponse:
    """Elimina un tag por su ID."""
    get_object_or_404(Tag, pk=pk)
    Tag.objects.filter(pk=pk).delete()
    logger.info("Tag eliminado", extra={'tag_id': pk})
    return JsonResponse({'ok': True})


@require_http_methods(["POST"])
def node_tag_add(request: HttpRequest, pk: int) -> JsonResponse:
    """Asocia un tag existente a un nodo."""
    node = get_object_or_404(Node, pk=pk)
    try:
        data = _parse_body(request)
    except ValueError as e:
        return _error(str(e))
    if 'tag_id' not in data:
        return _error('El campo tag_id es requerido')
    tag = get_object_or_404(Tag, pk=data['tag_id'])
    node.tags.add(tag)
    logger.info("Tag asociado a nodo", extra={'node_id': pk, 'tag_id': tag.id})
    return JsonResponse({'ok': True})


@require_http_methods(["DELETE"])
def node_tag_remove(request: HttpRequest, node_pk: int, tag_pk: int) -> JsonResponse:
    """Desasocia un tag de un nodo."""
    node = get_object_or_404(Node, pk=node_pk)
    get_object_or_404(Tag, pk=tag_pk)
    node.tags.remove(tag_pk)
    logger.info("Tag desasociado de nodo", extra={'node_id': node_pk, 'tag_id': tag_pk})
    return JsonResponse({'ok': True})
