from django.db import models


class Node(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Edge(models.Model):
    source = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='edges_out')
    target = models.ForeignKey(Node, on_delete=models.CASCADE, related_name='edges_in')

    class Meta:
        unique_together = ('source', 'target')

    def __str__(self):
        return f"{self.source} -> {self.target}"
