from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),

    # Grafo completo
    path('api/graph/', views.graph_data, name='graph_data'),

    # Nodos — RESTful: método HTTP define la acción
    path('api/nodes/', views.node_create, name='node_create'),
    path('api/nodes/<int:pk>/', views.node_detail, name='node_detail'),

    # Tags de un nodo
    path('api/nodes/<int:pk>/tags/', views.node_tag_add, name='node_tag_add'),
    path('api/nodes/<int:node_pk>/tags/<int:tag_pk>/', views.node_tag_remove, name='node_tag_remove'),

    # Aristas
    path('api/edges/', views.edge_create, name='edge_create'),
    path('api/edges/<int:pk>/', views.edge_delete, name='edge_delete'),

    # Tags
    path('api/tags/', views.tag_list_or_create, name='tag_list_or_create'),
    path('api/tags/<int:pk>/', views.tag_delete, name='tag_delete'),
]
