"""N.E.X.U.S. CLI — Command-line interface for the knowledge graph."""

import random
import click
from api_client import NexusClient, NexusAPIError
from formatters import (
    console, print_success, print_error, print_status,
    print_node_table, print_node_info, print_tags_table,
)

client = NexusClient()


@click.group()
def nexus():
    """N.E.X.U.S. — Neural Exploration & eXpandable Unified System.

    Command-line interface to manage your knowledge graph.
    """
    pass


# --- Status ---

@nexus.command()
def status():
    """Show graph overview (nodes, edges, tags count)."""
    try:
        data = client.get_graph()
        print_status(data["nodes"], data["edges"], data["tags"])
    except NexusAPIError as e:
        print_error(e.message)
    except Exception as e:
        print_error(f"Cannot connect to N.E.X.U.S.: {e}")


# --- Nodes ---

@nexus.command()
@click.argument("title")
@click.option("--type", "node_type", type=click.Choice(["normal", "secondary", "main"]), default="normal", help="Node type.")
@click.option("--content", "-c", default="", help="Node content (markdown).")
@click.option("--tag", "-t", multiple=True, help="Tags to assign (by name).")
def add(title: str, node_type: str, content: str, tag: tuple):
    """Create a new node."""
    try:
        # Random position spread
        x = (random.random() - 0.5) * 80
        y = (random.random() - 0.5) * 80
        z = (random.random() - 0.5) * 80
        node = client.create_node(title, content=content, node_type=node_type, x=x, y=y, z=z)
        print_success(f"Node created: \"{node['title']}\" (#{node['id']}, {node_type})")

        # Assign tags if provided
        if tag:
            graph = client.get_graph()
            existing_tags = {t["name"].lower(): t for t in graph["tags"]}
            for tag_name in tag:
                if tag_name.lower() in existing_tags:
                    t = existing_tags[tag_name.lower()]
                else:
                    t = client.create_tag(tag_name)
                    console.print(f"  [dim]Created tag \"{t['name']}\"[/dim]")
                client.add_tag_to_node(node["id"], t["id"])
                console.print(f"  [cyan]+ {tag_name}[/cyan]")

    except NexusAPIError as e:
        print_error(e.message)


@nexus.command()
@click.argument("node_id", type=int)
@click.option("--title", help="New title.")
@click.option("--content", "-c", help="New content.")
@click.option("--type", "node_type", type=click.Choice(["normal", "secondary", "main"]), help="Change node type.")
def edit(node_id: int, title: str, content: str, node_type: str):
    """Edit an existing node by ID."""
    fields = {}
    if title is not None:
        fields["title"] = title
    if content is not None:
        fields["content"] = content
    if node_type is not None:
        fields["node_type"] = node_type
    if not fields:
        print_error("Nothing to update. Use --title, --content, or --type.")
        return
    try:
        result = client.update_node(node_id, **fields)
        print_success(f"Node #{node_id} updated.")
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command(name="delete")
@click.argument("node_id", type=int)
@click.confirmation_option(prompt="Are you sure you want to delete this node?")
def delete_node(node_id: int):
    """Delete a node by ID."""
    try:
        client.delete_node(node_id)
        print_success(f"Node #{node_id} deleted.")
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command(name="list")
@click.option("--type", "node_type", type=click.Choice(["normal", "secondary", "main"]), help="Filter by type.")
@click.option("--tag", "-t", help="Filter by tag name.")
def list_nodes(node_type: str, tag: str):
    """List all nodes (with optional filters)."""
    try:
        data = client.get_graph()
        nodes = data["nodes"]
        if node_type:
            nodes = [n for n in nodes if n.get("node_type", "normal") == node_type]
        if tag:
            tag_lower = tag.lower()
            nodes = [n for n in nodes if any(t["name"].lower() == tag_lower for t in n.get("tags", []))]
        print_node_table(nodes)
    except NexusAPIError as e:
        print_error(e.message)
    except Exception as e:
        print_error(f"Cannot connect to N.E.X.U.S.: {e}")


@nexus.command()
@click.argument("query")
def search(query: str):
    """Search nodes by title."""
    try:
        data = client.get_graph()
        query_lower = query.lower()
        matches = [n for n in data["nodes"] if query_lower in n["title"].lower()]
        if matches:
            print_node_table(matches, title=f"Search: \"{query}\"")
        else:
            console.print(f"[dim]No nodes match \"{query}\".[/dim]")
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command()
@click.argument("node_id", type=int)
def info(node_id: int):
    """Show detailed information about a node."""
    try:
        data = client.get_graph()
        node = next((n for n in data["nodes"] if n["id"] == node_id), None)
        if not node:
            print_error(f"Node #{node_id} not found.")
            return
        connections = client.find_node_connections(node_id)
        print_node_info(node, connections)
    except NexusAPIError as e:
        print_error(e.message)


# --- Connections ---

@nexus.command()
@click.argument("source")
@click.argument("target")
def connect(source: str, target: str):
    """Connect two nodes (by ID or title)."""
    try:
        source_node = _resolve_node(source)
        target_node = _resolve_node(target)
        if not source_node:
            print_error(f"Node not found: \"{source}\"")
            return
        if not target_node:
            print_error(f"Node not found: \"{target}\"")
            return
        client.create_edge(source_node["id"], target_node["id"])
        print_success(f"Connected \"{source_node['title']}\" → \"{target_node['title']}\"")
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command()
@click.argument("source")
@click.argument("target")
def disconnect(source: str, target: str):
    """Disconnect two nodes (by ID or title)."""
    try:
        source_node = _resolve_node(source)
        target_node = _resolve_node(target)
        if not source_node or not target_node:
            print_error("Node not found.")
            return
        # Find the edge
        data = client.get_graph()
        edge = next(
            (e for e in data["edges"]
             if (e["source_id"] == source_node["id"] and e["target_id"] == target_node["id"])
             or (e["source_id"] == target_node["id"] and e["target_id"] == source_node["id"])),
            None
        )
        if not edge:
            print_error("These nodes are not connected.")
            return
        client.delete_edge(edge["id"])
        print_success(f"Disconnected \"{source_node['title']}\" ↔ \"{target_node['title']}\"")
    except NexusAPIError as e:
        print_error(e.message)


# --- Tags ---

@nexus.command(name="tags")
def list_tags():
    """List all tags."""
    try:
        tags = client.list_tags()
        print_tags_table(tags)
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command(name="tag-add")
@click.argument("name")
@click.option("--color", default="#00d4ff", help="Hex color (e.g., #ff6600).")
def tag_add(name: str, color: str):
    """Create a new tag."""
    try:
        tag = client.create_tag(name, color)
        print_success(f"Tag created: \"{tag['name']}\" ({tag['color']})")
    except NexusAPIError as e:
        print_error(e.message)


@nexus.command(name="tag-delete")
@click.argument("name")
@click.confirmation_option(prompt="Are you sure you want to delete this tag?")
def tag_delete(name: str):
    """Delete a tag by name."""
    try:
        tags = client.list_tags()
        tag = next((t for t in tags if t["name"].lower() == name.lower()), None)
        if not tag:
            print_error(f"Tag \"{name}\" not found.")
            return
        client.delete_tag(tag["id"])
        print_success(f"Tag \"{name}\" deleted.")
    except NexusAPIError as e:
        print_error(e.message)


# --- Export ---

@nexus.command()
@click.option("--format", "fmt", type=click.Choice(["json"]), default="json", help="Export format.")
def export(fmt: str):
    """Export the entire graph."""
    import json
    try:
        data = client.get_graph()
        output = json.dumps(data, indent=2, ensure_ascii=False)
        click.echo(output)
    except NexusAPIError as e:
        print_error(e.message)


# --- Helpers ---

def _resolve_node(identifier: str) -> dict | None:
    """Resolve a node by ID (if numeric) or by title search."""
    try:
        node_id = int(identifier)
        data = client.get_graph()
        return next((n for n in data["nodes"] if n["id"] == node_id), None)
    except ValueError:
        return client.find_node_by_title(identifier)


if __name__ == "__main__":
    nexus()
