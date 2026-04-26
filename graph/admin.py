from django.contrib import admin
from django.utils.html import format_html

from .models import Edge, Node, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Administración de tags con vista previa de color."""

    list_display = ('name', 'color_preview', 'node_count')
    search_fields = ('name',)

    def color_preview(self, obj: Tag) -> str:
        """Muestra el color del tag como badge HTML."""
        return format_html(
            '<span style="background:{}; padding:2px 12px; border-radius:8px; color:#fff;">{}</span>',
            obj.color, obj.color,
        )
    color_preview.short_description = 'Color'

    def node_count(self, obj: Tag) -> int:
        """Cuenta de nodos asociados al tag."""
        return obj.nodes.count()
    node_count.short_description = 'Nodos'


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    """Administración de nodos con tags inline."""

    list_display = ('title', 'tag_list', 'x', 'y', 'z', 'created_at')
    list_filter = ('tags', 'created_at')
    search_fields = ('title', 'content')
    filter_horizontal = ('tags',)
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Información general', {
            'fields': ('title', 'content', 'tags'),
        }),
        ('Posición 3D', {
            'fields': ('x', 'y', 'z'),
        }),
        ('Metadatos', {
            'fields': ('created_at',),
        }),
    )

    def tag_list(self, obj: Node) -> str:
        """Muestra los tags del nodo como badges de color."""
        tags = obj.tags.all()
        if not tags:
            return '—'
        return format_html(' '.join(
            '<span style="background:{}; padding:1px 8px; border-radius:8px; color:#fff; font-size:11px;">{}</span>'.format(
                t.color, t.name,
            )
            for t in tags
        ))
    tag_list.short_description = 'Tags'


@admin.register(Edge)
class EdgeAdmin(admin.ModelAdmin):
    """Administración de aristas del grafo."""

    list_display = ('id', 'source', 'target')
    list_filter = ('source', 'target')
    autocomplete_fields = ('source', 'target')
