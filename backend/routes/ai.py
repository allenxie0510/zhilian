"""AI service API routes."""

from fastapi import APIRouter, HTTPException

from ai_service import answer_question, extract_entities_and_relations
from database import get_note, get_notes_by_ids
from graph_store import graph_store
from models import (
    AIExtractRequest,
    AIExtractResponse,
    GraphNodeCreate,
    NodeType,
    QuestionRequest,
    QuestionResponse,
    RelationCreate,
    RelationType,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/extract", response_model=AIExtractResponse)
async def extract(req: AIExtractRequest) -> AIExtractResponse:
    """Extract entities and relations from text, then update the graph."""
    note = get_note(req.note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 1. Run AI extraction
    result = await extract_entities_and_relations(req.text)

    # 2. Clean up old graph data for this note
    graph_store.delete_edges_by_note(req.note_id)
    old_nodes = graph_store.get_nodes_by_source_note(req.note_id)
    for node in old_nodes:
        graph_store.delete_node(node.id)

    # 3. Add entities as graph nodes
    name_to_id: dict[str, str] = {}
    for entity in result.entities:
        node = graph_store.add_node(GraphNodeCreate(
            name=entity.name,
            type=entity.type,
            source_note_id=req.note_id,
        ))
        name_to_id[entity.name] = node.id

    # 4. Add relations as graph edges
    for rel in result.relations:
        source_id = name_to_id.get(rel.source)
        target_id = name_to_id.get(rel.target)
        if source_id and target_id:
            try:
                rel_type = RelationType(rel.type)
            except ValueError:
                rel_type = RelationType.references
            graph_store.add_edge(RelationCreate(
                source=source_id,
                target=target_id,
                type=rel_type,
                source_note_id=req.note_id,
                confidence=0.8,
            ))

    return result


@router.post("/ask", response_model=QuestionResponse)
async def ask(req: QuestionRequest) -> QuestionResponse:
    """Ask a question, get KG-enhanced answer."""
    # 1. Search graph for relevant nodes
    matching_nodes = graph_store.search_nodes(req.question)

    # 2. Build graph context
    node_names = [n.name for n in matching_nodes[:10]]
    node_ids = {n.id for n in matching_nodes[:10]}
    related_edges = [
        e for e in graph_store.get_all_edges()
        if e.source in node_ids or e.target in node_ids
    ]
    edge_descriptions = [
        f"{graph_store.get_node(e.source).name if graph_store.get_node(e.source) else '?'} "
        f"--[{e.type.value}]--> "
        f"{graph_store.get_node(e.target).name if graph_store.get_node(e.target) else '?'}"
        for e in related_edges[:20]
    ]
    graph_context = (
        f"匹配节点：{', '.join(node_names)}\n"
        f"相关关系：\n" + "\n".join(f"  {d}" for d in edge_descriptions)
    )

    # 3. Get related notes
    note_ids = list({n.source_note_id for n in matching_nodes[:10]})
    related_notes = get_notes_by_ids(note_ids)
    note_contexts = [f"《{n.title}》：{n.content[:300]}" for n in related_notes]

    # 4. Generate answer
    answer = await answer_question(req.question, graph_context, note_contexts)

    return QuestionResponse(
        answer=answer,
        sources=[n.id for n in matching_nodes[:10]],
    )
