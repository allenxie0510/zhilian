"""PostgreSQL-backed graph store — powered by Supabase.

Nodes and edges are stored in `graph_nodes` / `graph_edges` tables.
No more in-memory dicts or JSON files — survives any redeploy.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

from sqlmodel import Session, select, delete

from database import GraphNodeRow, GraphEdgeRow, get_session, engine
from models import GraphNode, GraphNodeCreate, NodeType, Relation, RelationCreate, RelationType


class GraphStore:
    """Graph operations backed by PostgreSQL."""

    # ── Node CRUD ─────────────────────────────────────────

    def add_node(self, create: GraphNodeCreate) -> GraphNode:
        """Add a node; skip duplicate name+type for same note."""
        with get_session() as session:
            # Check duplicate
            existing = session.exec(
                select(GraphNodeRow).where(
                    GraphNodeRow.name == create.name,
                    GraphNodeRow.type == create.type.value,
                    GraphNodeRow.source_note_id == create.source_note_id,
                )
            ).first()
            if existing:
                return GraphNode(
                    id=existing.id,
                    name=existing.name,
                    type=NodeType(existing.type),
                    source_note_id=existing.source_note_id,
                    created_at=existing.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(existing.metadata_json) if existing.metadata_json else {},
                )

            import json
            from datetime import datetime
            from uuid import uuid4

            row = GraphNodeRow(
                id=uuid4().hex[:12],
                name=create.name,
                type=create.type.value,
                source_note_id=create.source_note_id,
                created_at=datetime.now().isoformat(),
                metadata_json=json.dumps(create.metadata, ensure_ascii=False),
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return GraphNode(
                id=row.id,
                name=row.name,
                type=NodeType(row.type),
                source_note_id=row.source_note_id,
                created_at=row.created_at,  # type: ignore[arg-type]
                metadata=json.loads(row.metadata_json) if row.metadata_json else {},
            )

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        with get_session() as session:
            row = session.get(GraphNodeRow, node_id)
            if not row:
                return None
            import json
            return GraphNode(
                id=row.id,
                name=row.name,
                type=NodeType(row.type),
                source_note_id=row.source_note_id,
                created_at=row.created_at,  # type: ignore[arg-type]
                metadata=json.loads(row.metadata_json) if row.metadata_json else {},
            )

    def get_all_nodes(self) -> list[GraphNode]:
        with get_session() as session:
            rows = session.exec(select(GraphNodeRow)).all()
            import json
            return [
                GraphNode(
                    id=r.id, name=r.name, type=NodeType(r.type),
                    source_note_id=r.source_note_id,
                    created_at=r.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(r.metadata_json) if r.metadata_json else {},
                )
                for r in rows
            ]

    def get_nodes_by_type(self, node_type: NodeType) -> list[GraphNode]:
        with get_session() as session:
            rows = session.exec(
                select(GraphNodeRow).where(GraphNodeRow.type == node_type.value)
            ).all()
            import json
            return [
                GraphNode(
                    id=r.id, name=r.name, type=NodeType(r.type),
                    source_note_id=r.source_note_id,
                    created_at=r.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(r.metadata_json) if r.metadata_json else {},
                )
                for r in rows
            ]

    def get_nodes_by_source_note(self, note_id: str) -> list[GraphNode]:
        with get_session() as session:
            rows = session.exec(
                select(GraphNodeRow).where(GraphNodeRow.source_note_id == note_id)
            ).all()
            import json
            return [
                GraphNode(
                    id=r.id, name=r.name, type=NodeType(r.type),
                    source_note_id=r.source_note_id,
                    created_at=r.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(r.metadata_json) if r.metadata_json else {},
                )
                for r in rows
            ]

    def delete_node(self, node_id: str) -> bool:
        with get_session() as session:
            row = session.get(GraphNodeRow, node_id)
            if not row:
                return False
            # Remove connected edges
            session.exec(delete(GraphEdgeRow).where(
                (GraphEdgeRow.source == node_id) | (GraphEdgeRow.target == node_id)
            ))
            session.delete(row)
            session.commit()
            return True

    def search_nodes(self, query: str, types: Optional[list[NodeType]] = None) -> list[GraphNode]:
        with get_session() as session:
            stmt = select(GraphNodeRow).where(GraphNodeRow.name.ilike(f"%{query}%"))
            if types:
                stmt = stmt.where(GraphNodeRow.type.in_([t.value for t in types]))
            rows = session.exec(stmt).all()
            import json
            return [
                GraphNode(
                    id=r.id, name=r.name, type=NodeType(r.type),
                    source_note_id=r.source_note_id,
                    created_at=r.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(r.metadata_json) if r.metadata_json else {},
                )
                for r in rows
            ]

    # ── Edge CRUD ─────────────────────────────────────────

    def add_edge(self, create: RelationCreate) -> Relation:
        with get_session() as session:
            # Check duplicate
            existing = session.exec(
                select(GraphEdgeRow).where(
                    GraphEdgeRow.source == create.source,
                    GraphEdgeRow.target == create.target,
                    GraphEdgeRow.type == create.type.value,
                    GraphEdgeRow.source_note_id == create.source_note_id,
                )
            ).first()
            if existing:
                return Relation(
                    id=existing.id, source=existing.source, target=existing.target,
                    type=RelationType(existing.type),
                    source_note_id=existing.source_note_id,
                    confidence=existing.confidence,
                )

            from uuid import uuid4
            row = GraphEdgeRow(
                id=uuid4().hex[:12],
                source=create.source,
                target=create.target,
                type=create.type.value,
                source_note_id=create.source_note_id,
                confidence=create.confidence,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return Relation(
                id=row.id, source=row.source, target=row.target,
                type=RelationType(row.type),
                source_note_id=row.source_note_id,
                confidence=row.confidence,
            )

    def get_all_edges(self) -> list[Relation]:
        with get_session() as session:
            rows = session.exec(select(GraphEdgeRow)).all()
            return [
                Relation(
                    id=r.id, source=r.source, target=r.target,
                    type=RelationType(r.type),
                    source_note_id=r.source_note_id,
                    confidence=r.confidence,
                )
                for r in rows
            ]

    def get_neighbors(self, node_id: str, depth: int = 1) -> list[GraphNode]:
        """BFS neighbor lookup (depth-limited)."""
        visited: set[str] = {node_id}
        frontier = {node_id}
        for _ in range(depth):
            next_frontier: set[str] = set()
            with get_session() as session:
                for nid in frontier:
                    rows = session.exec(
                        select(GraphEdgeRow).where(
                            (GraphEdgeRow.source == nid) | (GraphEdgeRow.target == nid)
                        )
                    ).all()
                    for e in rows:
                        neighbor = e.target if e.source == nid else e.source
                        if neighbor not in visited:
                            visited.add(neighbor)
                            next_frontier.add(neighbor)
            frontier = next_frontier
        visited.discard(node_id)
        if not visited:
            return []
        with get_session() as session:
            rows = session.exec(
                select(GraphNodeRow).where(GraphNodeRow.id.in_(list(visited)))  # type: ignore[arg-type]
            ).all()
            import json
            return [
                GraphNode(
                    id=r.id, name=r.name, type=NodeType(r.type),
                    source_note_id=r.source_note_id,
                    created_at=r.created_at,  # type: ignore[arg-type]
                    metadata=json.loads(r.metadata_json) if r.metadata_json else {},
                )
                for r in rows
            ]

    def delete_edges_by_note(self, note_id: str) -> int:
        with get_session() as session:
            result = session.exec(
                delete(GraphEdgeRow).where(GraphEdgeRow.source_note_id == note_id)
            )
            session.commit()
            return result.rowcount  # type: ignore[attr-defined]

    # ── Stats ─────────────────────────────────────────────

    def stats(self) -> dict:
        with get_session() as session:
            node_count = session.exec(select(GraphNodeRow)).all()
            edge_count = session.exec(select(GraphEdgeRow)).all()
            type_counts: dict[str, int] = defaultdict(int)
            for n in node_count:
                type_counts[n.type] += 1
            return {
                "node_count": len(node_count),
                "edge_count": len(edge_count),
                "type_counts": dict(type_counts),
            }


graph_store = GraphStore()
