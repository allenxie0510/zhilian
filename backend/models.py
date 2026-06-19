"""Pydantic data models for 知链 - shared across the application."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────


class NodeType(str, Enum):
    concept = "concept"
    person = "person"
    project = "project"
    note = "note"
    topic = "topic"


class RelationType(str, Enum):
    belongs_to = "belongs_to"
    depends_on = "depends_on"
    references = "references"
    similar_to = "similar_to"
    derives_from = "derives_from"


class NoteType(str, Enum):
    text = "text"
    doc = "doc"
    link = "link"


# ── Note ───────────────────────────────────────────────────


class NoteBase(BaseModel):
    title: str
    content: str
    type: NoteType = NoteType.text
    tags: list[str] = []


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class Note(NoteBase):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


# ── Graph Node ─────────────────────────────────────────────


class GraphNode(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    name: str
    type: NodeType
    source_note_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = {}


class GraphNodeCreate(BaseModel):
    name: str
    type: NodeType
    source_note_id: str
    metadata: dict[str, Any] = {}


# ── Relation ───────────────────────────────────────────────


class Relation(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    source: str  # source node id
    target: str  # target node id
    type: RelationType
    source_note_id: str
    confidence: float = 1.0


class RelationCreate(BaseModel):
    source: str
    target: str
    type: RelationType
    source_note_id: str
    confidence: float = 1.0


# ── AI Extraction ──────────────────────────────────────────


class AIExtractRequest(BaseModel):
    text: str
    note_id: str


class AIEntity(BaseModel):
    name: str
    type: NodeType


class AIRelation(BaseModel):
    source: str   # entity name
    target: str   # entity name
    type: RelationType


class AIExtractResponse(BaseModel):
    entities: list[AIEntity]
    relations: list[AIRelation]


# ── Graph Query ────────────────────────────────────────────


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[Relation]


class SearchRequest(BaseModel):
    query: str
    node_types: Optional[list[NodeType]] = None


# ── AI Question ────────────────────────────────────────────


class QuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    answer: str
    sources: list[str] = []  # node ids referenced
