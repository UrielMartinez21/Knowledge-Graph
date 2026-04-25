from django.contrib import admin
from django.utils.html import format_html
from .models import Node, Edge, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'color_preview', 'node_count')
    search_fields = ('name',)

    def color_preview(self, obj):
        return format_html('<span style="background:{}; padding:2px 12px; border-radius:8px; color:#fff;">{}</span>', obj.color, obj.color)
    color_preview.short_description = 'Color'

    def node_count(self, obj):
        return obj.nodes.count()
    node_count.short_description = 'Nodos'


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('title', 'tag_list', 'x', 'y', 'z', 'created_at')
    list_filter = ('tags', 'created_at')
    search_fields = ('title', 'content')
    filter_horizontal = ('tags',)
    readonly_fields = ('created_at',)

    def tag_list(self, obj):
        tags = obj.tags.all()
        if not tags:
            return '—'
        return format_html(' '.join(
            '<span style="background:{}; padding:1px 8px; border-radius:8px; color:#fff; font-size:11px;">{}</span>'.format(t.color, t.name)
            for t in tags
        ))
    tag_list.short_description = 'Tags'


@admin.register(Edge)
class EdgeAdmin(admin.ModelAdmin):
    list_display = ('id', 'source', 'target')
    list_filter = ('source', 'target')
    autocomplete_fields = ('source', 'target')
