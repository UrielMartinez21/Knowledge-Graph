from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/graph/', views.graph_data, name='graph_data'),
    path('api/nodes/', views.node_create, name='node_create'),
    path('api/nodes/<int:pk>/', views.node_update, name='node_update'),
    path('api/nodes/<int:pk>/delete/', views.node_delete, name='node_delete'),
    path('api/edges/', views.edge_create, name='edge_create'),
    path('api/edges/<int:pk>/delete/', views.edge_delete, name='edge_delete'),
]
