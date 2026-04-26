import re

from django.core.exceptions import ValidationError
from django.db import models


def validate_hex_color(value: str) -> None:
    """Valida que el valor sea un color hexadecimal válido (#RRGGBB)."""
    if not re.match(r'^#[0-9a-fA-F]{6}$', value):
        raise ValidationError(f'{value} no es un color hex válido (formato: #RRGGBB)')


class Tag(models.Model):
    """Etiqueta de color para categorizar nodos del grafo."""

    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#00d4ff', validators=[validate_hex_color])

    class Meta:
        """Configuración de tabla e índices para Tag."""

        db_table = 'graph_tags'
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self) -> str:
        """Retorna el nombre del tag."""
        return self.name


class Node(models.Model):
    """Nodo del grafo de conocimiento con posición 3D y contenido markdown."""

    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    z = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='nodes')

    class Meta:
        """Configuración de tabla e índices para Node."""

        db_table = 'graph_nodes'
        indexes = [
            models.Index(fields=['title']),
            models.Index(fields=['created_at']),
        ]

    def clean(self) -> None:
        """Valida que el título no esté vacío."""
        super().clean()
        if not self.title or not self.title.strip():
            raise ValidationError({'title': 'El título no puede estar vacío'})

    def __str__(self) -> str:
        """Retorna el título del nodo."""
        return self.title


class Edge(models.Model):
    """Conexión dirigida entre dos nodos del grafo."""

    source = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='edges_out')
    target = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='edges_in')

    class Meta:
        """Configuración de tabla, índices y restricciones para Edge."""

        db_table = 'graph_edges'
        indexes = [
            models.Index(fields=['source', 'target']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'target'],
                name='unique_edge_per_direction',
            ),
        ]

    def clean(self) -> None:
        """Valida que la arista no sea un self-loop."""
        super().clean()
        if self.source_id and self.target_id and self.source_id == self.target_id:
            raise ValidationError('Un nodo no puede conectarse a sí mismo')

    def __str__(self) -> str:
        """Retorna representación 'origen -> destino'."""
        return f"{self.source} -> {self.target}"
