"""Graph API routes."""

from fastapi import APIRouter, HTTPException, Query

from graph_store import graph_store
from models import GraphData, GraphNode, NodeType, SearchRequest

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/data", response_model=GraphData)
def get_graph_data(
    note_id: str | None = Query(None, description="Filter by source note"),
    node_type: str | None = Query(None, description="Filter by node type"),
) -> GraphData:
    """Get full graph data (nodes + edges), optionally filtered."""
    if note_id:
        nodes = graph_store.get_nodes_by_source_note(note_id)
        node_ids = {n.id for n in nodes}
        edges = [e for e in graph_store.get_all_edges() if e.source in node_ids or e.target in node_ids]
    elif node_type:
        try:
            nt = NodeType(node_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid node type: {node_type}")
        nodes = graph_store.get_nodes_by_type(nt)
        node_ids = {n.id for n in nodes}
        edges = [e for e in graph_store.get_all_edges() if e.source in node_ids or e.target in node_ids]
    else:
        nodes = graph_store.get_all_nodes()
        edges = graph_store.get_all_edges()

    return GraphData(nodes=nodes, edges=edges)


@router.get("/node/{node_id}", response_model=GraphNode)
def get_node(node_id: str) -> GraphNode:
    node = graph_store.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    return node


@router.get("/node/{node_id}/neighbors", response_model=list[GraphNode])
def get_neighbors(node_id: str, depth: int = 1) -> list[GraphNode]:
    """Get neighbor nodes of a given node."""
    return graph_store.get_neighbors(node_id, depth=depth)


@router.get("/node/{node_id}/subgraph", response_model=GraphData)
def get_subgraph(node_id: str, depth: int = 1) -> GraphData:
    """Get the subgraph centered on a node."""
    center = graph_store.get_node(node_id)
    if not center:
        raise HTTPException(status_code=404, detail="节点不存在")

    neighbors = graph_store.get_neighbors(node_id, depth=depth)
    nodes = [center] + neighbors
    node_ids = {n.id for n in nodes}
    edges = [
        e for e in graph_store.get_all_edges()
        if e.source in node_ids and e.target in node_ids
    ]
    return GraphData(nodes=nodes, edges=edges)


@router.post("/search", response_model=list[GraphNode])
def search_nodes(req: SearchRequest) -> list[GraphNode]:
    """Full-text search on graph nodes."""
    return graph_store.search_nodes(req.query, req.node_types)


@router.get("/stats")
def get_stats() -> dict:
    return graph_store.stats()
