import json
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Node, Edge, Tag


def index(request):
    return render(request, 'graph/index.html')


@require_http_methods(["GET"])
def graph_data(request):
    nodes = []
    for n in Node.objects.prefetch_related('tags').all():
        nodes.append({
            'id': n.id, 'title': n.title, 'content': n.content,
            'x': n.x, 'y': n.y, 'z': n.z,
            'tags': [{'id': t.id, 'name': t.name, 'color': t.color} for t in n.tags.all()],
        })
    edges = list(Edge.objects.values('id', 'source_id', 'target_id'))
    tags = list(Tag.objects.values('id', 'name', 'color'))
    return JsonResponse({'nodes': nodes, 'edges': edges, 'tags': tags})


@csrf_exempt
@require_http_methods(["POST"])
def node_create(request):
    data = json.loads(request.body)
    node = Node.objects.create(
        title=data['title'],
        content=data.get('content', ''),
        x=data.get('x', 0),
        y=data.get('y', 0),
        z=data.get('z', 0),
    )
    return JsonResponse({'id': node.id, 'title': node.title, 'content': node.content, 'x': node.x, 'y': node.y, 'z': node.z, 'tags': []})


@csrf_exempt
@require_http_methods(["PUT"])
def node_update(request, pk):
    data = json.loads(request.body)
    node = Node.objects.get(pk=pk)
    for field in ('title', 'content', 'x', 'y', 'z'):
        if field in data:
            setattr(node, field, data[field])
    node.save()
    return JsonResponse({'id': node.id, 'title': node.title, 'content': node.content, 'x': node.x, 'y': node.y, 'z': node.z})


@csrf_exempt
@require_http_methods(["DELETE"])
def node_delete(request, pk):
    Node.objects.filter(pk=pk).delete()
    return JsonResponse({'ok': True})


@csrf_exempt
@require_http_methods(["POST"])
def edge_create(request):
    data = json.loads(request.body)
    edge, created = Edge.objects.get_or_create(source_id=data['source'], target_id=data['target'])
    return JsonResponse({'id': edge.id, 'source_id': edge.source_id, 'target_id': edge.target_id})


@csrf_exempt
@require_http_methods(["DELETE"])
def edge_delete(request, pk):
    Edge.objects.filter(pk=pk).delete()
    return JsonResponse({'ok': True})


# --- Tag endpoints ---

@require_http_methods(["GET"])
def tag_list(request):
    tags = list(Tag.objects.values('id', 'name', 'color'))
    return JsonResponse({'tags': tags})


@csrf_exempt
@require_http_methods(["POST"])
def tag_create(request):
    data = json.loads(request.body)
    tag, created = Tag.objects.get_or_create(
        name=data['name'],
        defaults={'color': data.get('color', '#00d4ff')},
    )
    return JsonResponse({'id': tag.id, 'name': tag.name, 'color': tag.color})


@csrf_exempt
@require_http_methods(["DELETE"])
def tag_delete(request, pk):
    Tag.objects.filter(pk=pk).delete()
    return JsonResponse({'ok': True})


@csrf_exempt
@require_http_methods(["POST"])
def node_tag_add(request, pk):
    data = json.loads(request.body)
    node = Node.objects.get(pk=pk)
    tag = Tag.objects.get(pk=data['tag_id'])
    node.tags.add(tag)
    return JsonResponse({'ok': True})


@csrf_exempt
@require_http_methods(["DELETE"])
def node_tag_remove(request, node_pk, tag_pk):
    node = Node.objects.get(pk=node_pk)
    node.tags.remove(tag_pk)
    return JsonResponse({'ok': True})
