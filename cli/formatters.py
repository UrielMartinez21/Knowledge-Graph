"""Output formatters for the N.E.X.U.S. CLI."""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

TYPE_ICONS = {"main": "★", "secondary": "◆", "normal": "·"}
TYPE_COLORS = {"main": "yellow", "secondary": "green", "normal": "white"}


def print_success(message: str) -> None:
    """Print a success message."""
    console.print(f"[green]✓[/green] {message}")


def print_error(message: str) -> None:
    """Print an error message."""
    console.print(f"[red]✗[/red] {message}")


def print_status(nodes: list, edges: list, tags: list) -> None:
    """Print a graph status summary."""
    main_count = sum(1 for n in nodes if n.get("node_type") == "main")
    secondary_count = sum(1 for n in nodes if n.get("node_type") == "secondary")
    normal_count = sum(1 for n in nodes if n.get("node_type", "normal") == "normal")

    content = (
        f"[bold]Nodes:[/bold]       {len(nodes)}\n"
        f"  [yellow]★[/yellow] Main:      {main_count}\n"
        f"  [green]◆[/green] Secondary: {secondary_count}\n"
        f"  · Normal:   {normal_count}\n"
        f"[bold]Edges:[/bold]       {len(edges)}\n"
        f"[bold]Tags:[/bold]        {len(tags)}"
    )
    console.print(Panel(content, title="[bold]N.E.X.U.S. Status[/bold]", border_style="cyan"))


def print_node_table(nodes: list, title: str = "Nodes") -> None:
    """Print a table of nodes."""
    if not nodes:
        console.print("[dim]No nodes found.[/dim]")
        return

    table = Table(title=title, border_style="dim")
    table.add_column("ID", style="dim", width=5)
    table.add_column("Title", style="bold")
    table.add_column("Type", width=12)
    table.add_column("Tags", style="dim")

    for n in nodes:
        node_type = n.get("node_type", "normal")
        icon = TYPE_ICONS.get(node_type, "·")
        color = TYPE_COLORS.get(node_type, "white")
        type_str = f"[{color}]{icon} {node_type}[/{color}]"
        tags_str = ", ".join(t["name"] for t in n.get("tags", []))
        table.add_row(str(n["id"]), n["title"], type_str, tags_str)

    console.print(table)


def print_node_info(node: dict, connections: dict) -> None:
    """Print detailed node information."""
    node_type = node.get("node_type", "normal")
    color = TYPE_COLORS.get(node_type, "white")
    icon = TYPE_ICONS.get(node_type, "·")

    lines = []

    # Content
    content = node.get("content", "").strip()
    if content:
        lines.append(f"[bold]Content:[/bold]")
        # Truncate long content
        preview = content[:200] + ("..." if len(content) > 200 else "")
        lines.append(f"  {preview}")
        lines.append("")

    # Tags
    tags = node.get("tags", [])
    if tags:
        tag_str = ", ".join(f"[cyan]{t['name']}[/cyan]" for t in tags)
        lines.append(f"[bold]Tags:[/bold] {tag_str}")
    else:
        lines.append("[bold]Tags:[/bold] [dim]none[/dim]")

    # Connections
    outgoing = connections.get("outgoing", [])
    incoming = connections.get("incoming", [])
    lines.append("")
    lines.append(f"[bold]Connections:[/bold] ({len(outgoing) + len(incoming)} total)")
    for conn in outgoing:
        cn = conn["node"]
        ct = cn.get("node_type", "normal")
        ci = TYPE_ICONS.get(ct, "·")
        lines.append(f"  → {cn['title']} (#{cn['id']}) [{ci} {ct}]")
    for conn in incoming:
        cn = conn["node"]
        ct = cn.get("node_type", "normal")
        ci = TYPE_ICONS.get(ct, "·")
        lines.append(f"  ← {cn['title']} (#{cn['id']}) [{ci} {ct}]")
    if not outgoing and not incoming:
        lines.append("  [dim]No connections[/dim]")

    panel_title = f"[{color}]{icon} {node['title']}[/{color}] [dim](#{node['id']}, {node_type})[/dim]"
    console.print(Panel("\n".join(lines), title=panel_title, border_style=color))


def print_tags_table(tags: list) -> None:
    """Print a table of tags."""
    if not tags:
        console.print("[dim]No tags found.[/dim]")
        return

    table = Table(title="Tags", border_style="dim")
    table.add_column("ID", style="dim", width=5)
    table.add_column("Name", style="bold")
    table.add_column("Color", width=10)

    for t in tags:
        table.add_row(str(t["id"]), t["name"], t["color"])

    console.print(table)
