import json
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Node, Edge


def index(request):
    return render(request, 'graph/index.html')


@require_http_methods(["GET"])
def graph_data(request):
    nodes = list(Node.objects.values('id', 'title', 'content', 'x', 'y'))
    edges = list(Edge.objects.values('id', 'source_id', 'target_id'))
    return JsonResponse({'nodes': nodes, 'edges': edges})


@csrf_exempt
@require_http_methods(["POST"])
def node_create(request):
    data = json.loads(request.body)
    node = Node.objects.create(
        title=data['title'],
        content=data.get('content', ''),
        x=data.get('x', 0),
        y=data.get('y', 0),
    )
    return JsonResponse({'id': node.id, 'title': node.title, 'content': node.content, 'x': node.x, 'y': node.y})


@csrf_exempt
@require_http_methods(["PUT"])
def node_update(request, pk):
    data = json.loads(request.body)
    node = Node.objects.get(pk=pk)
    for field in ('title', 'content', 'x', 'y'):
        if field in data:
            setattr(node, field, data[field])
    node.save()
    return JsonResponse({'id': node.id, 'title': node.title, 'content': node.content, 'x': node.x, 'y': node.y})


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
