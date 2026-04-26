"""Tests para la app graph — modelos y API endpoints."""
import json

from django.test import TestCase, Client
from django.urls import reverse

from .models import Node, Edge, Tag


class TagModelTest(TestCase):
    """Tests del modelo Tag."""

    def test_str(self) -> None:
        """El __str__ retorna el nombre."""
        tag = Tag.objects.create(name='test', color='#ff0000')
        self.assertEqual(str(tag), 'test')

    def test_default_color(self) -> None:
        """El color por defecto es #00d4ff."""
        tag = Tag.objects.create(name='default')
        self.assertEqual(tag.color, '#00d4ff')


class NodeModelTest(TestCase):
    """Tests del modelo Node."""

    def test_str(self) -> None:
        """El __str__ retorna el título."""
        node = Node.objects.create(title='Mi nodo')
        self.assertEqual(str(node), 'Mi nodo')

    def test_default_position(self) -> None:
        """La posición por defecto es (0, 0, 0)."""
        node = Node.objects.create(title='Nodo')
        self.assertEqual((node.x, node.y, node.z), (0, 0, 0))


class EdgeModelTest(TestCase):
    """Tests del modelo Edge."""

    def test_str(self) -> None:
        """El __str__ retorna 'origen -> destino'."""
        n1 = Node.objects.create(title='A')
        n2 = Node.objects.create(title='B')
        edge = Edge.objects.create(source=n1, target=n2)
        self.assertEqual(str(edge), 'A -> B')

    def test_unique_constraint(self) -> None:
        """No se pueden crear aristas duplicadas."""
        n1 = Node.objects.create(title='A')
        n2 = Node.objects.create(title='B')
        Edge.objects.create(source=n1, target=n2)
        with self.assertRaises(Exception):
            Edge.objects.create(source=n1, target=n2)


class IndexViewTest(TestCase):
    """Tests de la vista principal."""

    def test_index_returns_200(self) -> None:
        """La página principal retorna 200."""
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)


class GraphDataAPITest(TestCase):
    """Tests del endpoint GET /api/graph/."""

    def test_empty_graph(self) -> None:
        """Un grafo vacío retorna listas vacías."""
        response = self.client.get(reverse('graph_data'))
        data = json.loads(response.content)
        self.assertEqual(data['nodes'], [])
        self.assertEqual(data['edges'], [])

    def test_graph_with_data(self) -> None:
        """Retorna nodos, aristas y tags existentes."""
        tag = Tag.objects.create(name='t1')
        n1 = Node.objects.create(title='A')
        n1.tags.add(tag)
        n2 = Node.objects.create(title='B')
        Edge.objects.create(source=n1, target=n2)
        response = self.client.get(reverse('graph_data'))
        data = json.loads(response.content)
        self.assertEqual(len(data['nodes']), 2)
        self.assertEqual(len(data['edges']), 1)
        self.assertEqual(len(data['tags']), 1)
        self.assertEqual(data['nodes'][0]['tags'][0]['name'], 't1')


class NodeCreateAPITest(TestCase):
    """Tests del endpoint POST /api/nodes/."""

    def test_create_node(self) -> None:
        """Crea un nodo correctamente."""
        response = self.client.post(
            reverse('node_create'),
            json.dumps({'title': 'Nuevo', 'x': 10, 'y': 20, 'z': 30}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data['title'], 'Nuevo')
        self.assertEqual(data['x'], 10)

    def test_create_node_missing_title(self) -> None:
        """Retorna 400 si falta el título."""
        response = self.client.post(
            reverse('node_create'),
            json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_create_node_invalid_json(self) -> None:
        """Retorna 400 si el body no es JSON válido."""
        response = self.client.post(
            reverse('node_create'),
            'not json',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)


class NodeUpdateAPITest(TestCase):
    """Tests del endpoint PUT /api/nodes/<pk>/."""

    def setUp(self) -> None:
        """Crea un nodo de prueba."""
        self.node = Node.objects.create(title='Original')

    def test_update_node(self) -> None:
        """Actualiza el título del nodo."""
        response = self.client.put(
            reverse('node_detail', args=[self.node.pk]),
            json.dumps({'title': 'Editado'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content)['title'], 'Editado')

    def test_update_nonexistent(self) -> None:
        """Retorna 404 si el nodo no existe."""
        response = self.client.put(
            reverse('node_detail', args=[9999]),
            json.dumps({'title': 'X'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)


class NodeDeleteAPITest(TestCase):
    """Tests del endpoint DELETE /api/nodes/<pk>/delete/."""

    def test_delete_node(self) -> None:
        """Elimina un nodo existente."""
        node = Node.objects.create(title='Borrar')
        response = self.client.delete(reverse('node_detail', args=[node.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Node.objects.filter(pk=node.pk).exists())

    def test_delete_nonexistent(self) -> None:
        """Retorna 404 si el nodo no existe."""
        response = self.client.delete(reverse('node_detail', args=[9999]))
        self.assertEqual(response.status_code, 404)


class EdgeCreateAPITest(TestCase):
    """Tests del endpoint POST /api/edges/."""

    def setUp(self) -> None:
        """Crea dos nodos de prueba."""
        self.n1 = Node.objects.create(title='A')
        self.n2 = Node.objects.create(title='B')

    def test_create_edge(self) -> None:
        """Crea una arista entre dos nodos."""
        response = self.client.post(
            reverse('edge_create'),
            json.dumps({'source': self.n1.pk, 'target': self.n2.pk}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)

    def test_create_edge_missing_fields(self) -> None:
        """Retorna 400 si faltan campos."""
        response = self.client.post(
            reverse('edge_create'),
            json.dumps({'source': self.n1.pk}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_create_edge_nonexistent_node(self) -> None:
        """Retorna 404 si un nodo no existe."""
        response = self.client.post(
            reverse('edge_create'),
            json.dumps({'source': self.n1.pk, 'target': 9999}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)


class EdgeDeleteAPITest(TestCase):
    """Tests del endpoint DELETE /api/edges/<pk>/delete/."""

    def test_delete_edge(self) -> None:
        """Elimina una arista existente."""
        n1 = Node.objects.create(title='A')
        n2 = Node.objects.create(title='B')
        edge = Edge.objects.create(source=n1, target=n2)
        response = self.client.delete(reverse('edge_delete', args=[edge.pk]))
        self.assertEqual(response.status_code, 200)

    def test_delete_nonexistent(self) -> None:
        """Retorna 404 si la arista no existe."""
        response = self.client.delete(reverse('edge_delete', args=[9999]))
        self.assertEqual(response.status_code, 404)


class TagCreateAPITest(TestCase):
    """Tests del endpoint POST /api/tags/create/."""

    def test_create_tag(self) -> None:
        """Crea un tag nuevo."""
        response = self.client.post(
            reverse('tag_list_or_create'),
            json.dumps({'name': 'nuevo'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(json.loads(response.content)['name'], 'nuevo')

    def test_create_tag_missing_name(self) -> None:
        """Retorna 400 si falta el nombre."""
        response = self.client.post(
            reverse('tag_list_or_create'),
            json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_create_existing_tag(self) -> None:
        """Retorna el tag existente si el nombre ya existe."""
        Tag.objects.create(name='existe')
        response = self.client.post(
            reverse('tag_list_or_create'),
            json.dumps({'name': 'existe'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)


class TagDeleteAPITest(TestCase):
    """Tests del endpoint DELETE /api/tags/<pk>/delete/."""

    def test_delete_tag(self) -> None:
        """Elimina un tag existente."""
        tag = Tag.objects.create(name='borrar')
        response = self.client.delete(reverse('tag_delete', args=[tag.pk]))
        self.assertEqual(response.status_code, 200)

    def test_delete_nonexistent(self) -> None:
        """Retorna 404 si el tag no existe."""
        response = self.client.delete(reverse('tag_delete', args=[9999]))
        self.assertEqual(response.status_code, 404)


class TagListAPITest(TestCase):
    """Tests del endpoint GET /api/tags/."""

    def test_list_tags(self) -> None:
        """Retorna la lista de tags."""
        Tag.objects.create(name='a')
        Tag.objects.create(name='b')
        response = self.client.get(reverse('tag_list_or_create'))
        data = json.loads(response.content)
        self.assertEqual(len(data['tags']), 2)


class NodeTagAddAPITest(TestCase):
    """Tests del endpoint POST /api/nodes/<pk>/tags/."""

    def setUp(self) -> None:
        """Crea nodo y tag de prueba."""
        self.node = Node.objects.create(title='N')
        self.tag = Tag.objects.create(name='T')

    def test_add_tag(self) -> None:
        """Asocia un tag a un nodo."""
        response = self.client.post(
            reverse('node_tag_add', args=[self.node.pk]),
            json.dumps({'tag_id': self.tag.pk}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.tag, self.node.tags.all())

    def test_add_tag_nonexistent_node(self) -> None:
        """Retorna 404 si el nodo no existe."""
        response = self.client.post(
            reverse('node_tag_add', args=[9999]),
            json.dumps({'tag_id': self.tag.pk}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_add_tag_missing_field(self) -> None:
        """Retorna 400 si falta tag_id."""
        response = self.client.post(
            reverse('node_tag_add', args=[self.node.pk]),
            json.dumps({}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)


class NodeTagRemoveAPITest(TestCase):
    """Tests del endpoint DELETE /api/nodes/<pk>/tags/<tag_pk>/."""

    def test_remove_tag(self) -> None:
        """Desasocia un tag de un nodo."""
        node = Node.objects.create(title='N')
        tag = Tag.objects.create(name='T')
        node.tags.add(tag)
        response = self.client.delete(
            reverse('node_tag_remove', args=[node.pk, tag.pk]),
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(tag, node.tags.all())

    def test_remove_nonexistent_node(self) -> None:
        """Retorna 404 si el nodo no existe."""
        tag = Tag.objects.create(name='T')
        response = self.client.delete(
            reverse('node_tag_remove', args=[9999, tag.pk]),
        )
        self.assertEqual(response.status_code, 404)
