"""HTTP client wrapper for the N.E.X.U.S. API."""

import httpx
from config import API_URL


class NexusAPIError(Exception):
    """Error returned by the N.E.X.U.S. API."""

    def __init__(self, message: str, status_code: int = 0):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NexusClient:
    """Client to interact with the N.E.X.U.S. REST API."""

    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url.rstrip("/")
        self.http = httpx.Client(timeout=10.0)

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _handle_response(self, response: httpx.Response) -> dict:
        """Parse response and raise on errors."""
        if response.status_code >= 400:
            try:
                data = response.json()
                msg = data.get("error", response.text)
            except Exception:
                msg = response.text
            raise NexusAPIError(msg, response.status_code)
        return response.json()

    # --- Graph ---

    def get_graph(self) -> dict:
        """Get the full graph (nodes, edges, tags)."""
        resp = self.http.get(self._url("/api/graph/"))
        return self._handle_response(resp)

    # --- Nodes ---

    def create_node(self, title: str, content: str = "", node_type: str = "normal",
                    x: float = 0, y: float = 0, z: float = 0) -> dict:
        """Create a new node."""
        resp = self.http.post(self._url("/api/nodes/"), json={
            "title": title, "content": content, "node_type": node_type,
            "x": x, "y": y, "z": z,
        })
        return self._handle_response(resp)

    def update_node(self, node_id: int, **fields) -> dict:
        """Update a node. Pass only fields to change."""
        resp = self.http.put(self._url(f"/api/nodes/{node_id}/"), json=fields)
        return self._handle_response(resp)

    def delete_node(self, node_id: int) -> dict:
        """Delete a node by ID."""
        resp = self.http.delete(self._url(f"/api/nodes/{node_id}/"))
        return self._handle_response(resp)

    # --- Edges ---

    def create_edge(self, source_id: int, target_id: int) -> dict:
        """Create an edge between two nodes."""
        resp = self.http.post(self._url("/api/edges/"), json={
            "source": source_id, "target": target_id,
        })
        return self._handle_response(resp)

    def delete_edge(self, edge_id: int) -> dict:
        """Delete an edge by ID."""
        resp = self.http.delete(self._url(f"/api/edges/{edge_id}/"))
        return self._handle_response(resp)

    # --- Tags ---

    def list_tags(self) -> list:
        """List all tags."""
        data = self.get_graph()
        return data.get("tags", [])

    def create_tag(self, name: str, color: str = "#00d4ff") -> dict:
        """Create a new tag."""
        resp = self.http.post(self._url("/api/tags/"), json={
            "name": name, "color": color,
        })
        return self._handle_response(resp)

    def delete_tag(self, tag_id: int) -> dict:
        """Delete a tag by ID."""
        resp = self.http.delete(self._url(f"/api/tags/{tag_id}/"))
        return self._handle_response(resp)

    def add_tag_to_node(self, node_id: int, tag_id: int) -> dict:
        """Associate a tag with a node."""
        resp = self.http.post(self._url(f"/api/nodes/{node_id}/tags/"), json={
            "tag_id": tag_id,
        })
        return self._handle_response(resp)

    def remove_tag_from_node(self, node_id: int, tag_id: int) -> dict:
        """Remove a tag from a node."""
        resp = self.http.delete(self._url(f"/api/nodes/{node_id}/tags/{tag_id}/"))
        return self._handle_response(resp)

    # --- Helpers ---

    def find_node_by_title(self, title: str) -> dict | None:
        """Find a node by exact or partial title match."""
        data = self.get_graph()
        title_lower = title.lower()
        # Try exact match first
        for node in data["nodes"]:
            if node["title"].lower() == title_lower:
                return node
        # Then partial match
        for node in data["nodes"]:
            if title_lower in node["title"].lower():
                return node
        return None

    def find_node_connections(self, node_id: int) -> dict:
        """Get outgoing and incoming connections for a node."""
        data = self.get_graph()
        outgoing = []
        incoming = []
        node_map = {n["id"]: n for n in data["nodes"]}
        for edge in data["edges"]:
            if edge["source_id"] == node_id and edge["target_id"] in node_map:
                outgoing.append({"edge_id": edge["id"], "node": node_map[edge["target_id"]]})
            elif edge["target_id"] == node_id and edge["source_id"] in node_map:
                incoming.append({"edge_id": edge["id"], "node": node_map[edge["source_id"]]})
        return {"outgoing": outgoing, "incoming": incoming}
