"""In-memory graph store — MVP replacement for Neo4j.

Stores nodes and edges in memory with persistence to a JSON file.
Supports basic graph operations needed by the MVP.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Optional

from models import GraphNode, GraphNodeCreate, NodeType, Relation, RelationCreate, RelationType

DATA_DIR = Path(os.environ.get("ZHILIAN_DATA_DIR", "./data"))
GRAPH_FILE = DATA_DIR / "graph.json"


class GraphStore:
    """In-memory graph with JSON persistence."""

    def __init__(self) -> None:
        self.nodes: dict[str, GraphNode] = {}
        self.edges: dict[str, Relation] = {}
        # adjacency index: node_id -> set of connected node_ids
        self._adj: dict[str, set[str]] = defaultdict(set)
        # type index: node_type -> set of node_ids
        self._type_index: dict[NodeType, set[str]] = defaultdict(set)
        # name index for lookup during dedup
        self._name_index: dict[str, str] = {}  # lower_name -> node_id
        self._loaded = False

    # ── persistence ──────────────────────────────────────

    def load(self) -> None:
        """Load graph from disk."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if GRAPH_FILE.exists():
            data = json.loads(GRAPH_FILE.read_text(encoding="utf-8"))
            for n in data.get("nodes", []):
                node = GraphNode(**n)
                self.nodes[node.id] = node
                self._type_index[node.type].add(node.id)
                self._name_index[node.name.lower()] = node.id
            for e in data.get("edges", []):
                edge = Relation(**e)
                self.edges[edge.id] = edge
                self._adj[edge.source].add(edge.target)
                self._adj[edge.target].add(edge.source)
        self._loaded = True

    def save(self) -> None:
        """Persist graph to disk."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "nodes": [n.model_dump(mode="json") for n in self.nodes.values()],
            "edges": [e.model_dump(mode="json") for e in self.edges.values()],
        }
        GRAPH_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    # ── node CRUD ─────────────────────────────────────────

    def add_node(self, create: GraphNodeCreate) -> GraphNode:
        """Add a node; if name+type already exists for the same note, return existing."""
        self._ensure_loaded()
        key = create.name.lower()
        if key in self._name_index:
            existing_id = self._name_index[key]
            existing = self.nodes[existing_id]
            if existing.type == create.type:
                return existing
        node = GraphNode(
            name=create.name,
            type=create.type,
            source_note_id=create.source_note_id,
            metadata=create.metadata,
        )
        self.nodes[node.id] = node
        self._type_index[node.type].add(node.id)
        self._name_index[key] = node.id
        self.save()
        return node

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        self._ensure_loaded()
        return self.nodes.get(node_id)

    def get_all_nodes(self) -> list[GraphNode]:
        self._ensure_loaded()
        return list(self.nodes.values())

    def get_nodes_by_type(self, node_type: NodeType) -> list[GraphNode]:
        self._ensure_loaded()
        return [self.nodes[nid] for nid in self._type_index.get(node_type, set()) if nid in self.nodes]

    def get_nodes_by_source_note(self, note_id: str) -> list[GraphNode]:
        self._ensure_loaded()
        return [n for n in self.nodes.values() if n.source_note_id == note_id]

    def delete_node(self, node_id: str) -> bool:
        self._ensure_loaded()
        node = self.nodes.pop(node_id, None)
        if not node:
            return False
        self._type_index[node.type].discard(node_id)
        self._name_index.pop(node.name.lower(), None)
        # remove connected edges
        to_remove = [
            eid for eid, e in self.edges.items()
            if e.source == node_id or e.target == node_id
        ]
        for eid in to_remove:
            edge = self.edges.pop(eid)
            self._adj[edge.source].discard(edge.target)
            self._adj[edge.target].discard(edge.source)
        self.save()
        return True

    def search_nodes(self, query: str, types: Optional[list[NodeType]] = None) -> list[GraphNode]:
        """Full-text search on node names."""
        self._ensure_loaded()
        q = query.lower()
        results = []
        for node in self.nodes.values():
            if types and node.type not in types:
                continue
            if q in node.name.lower():
                results.append(node)
        return results

    # ── edge CRUD ─────────────────────────────────────────

    def add_edge(self, create: RelationCreate) -> Relation:
        """Add an edge; skip if identical edge exists."""
        self._ensure_loaded()
        # check duplicate
        for e in self.edges.values():
            if (
                e.source == create.source
                and e.target == create.target
                and e.type == create.type
                and e.source_note_id == create.source_note_id
            ):
                return e
        edge = Relation(
            source=create.source,
            target=create.target,
            type=create.type,
            source_note_id=create.source_note_id,
            confidence=create.confidence,
        )
        self.edges[edge.id] = edge
        self._adj[edge.source].add(edge.target)
        self._adj[edge.target].add(edge.source)
        self.save()
        return edge

    def get_all_edges(self) -> list[Relation]:
        self._ensure_loaded()
        return list(self.edges.values())

    def get_neighbors(self, node_id: str, depth: int = 1) -> list[GraphNode]:
        """Get neighbor nodes within specified depth."""
        self._ensure_loaded()
        if node_id not in self.nodes:
            return []
        visited: set[str] = {node_id}
        frontier = {node_id}
        for _ in range(depth):
            next_frontier: set[str] = set()
            for nid in frontier:
                for neighbor in self._adj.get(nid, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.add(neighbor)
            frontier = next_frontier
        visited.discard(node_id)
        return [self.nodes[nid] for nid in visited if nid in self.nodes]

    def delete_edges_by_note(self, note_id: str) -> int:
        """Delete all edges from a source note; return count."""
        self._ensure_loaded()
        to_remove = [
            eid for eid, e in self.edges.items()
            if e.source_note_id == note_id
        ]
        for eid in to_remove:
            edge = self.edges.pop(eid)
            self._adj[edge.source].discard(edge.target)
            self._adj[edge.target].discard(edge.source)
        if to_remove:
            self.save()
        return len(to_remove)

    # ── stats ─────────────────────────────────────────────

    def stats(self) -> dict:
        self._ensure_loaded()
        return {
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "type_counts": {t.value: len(ids) for t, ids in self._type_index.items()},
        }


# Singleton
graph_store = GraphStore()
