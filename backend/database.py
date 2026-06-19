"""Supabase PostgreSQL database — notes metadata and graph persistence.

Replaces the old SQLite + JSON-file approach. Everything survives redeploys.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, Session, SQLModel, create_engine, select, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=5)


# ── Notes table ────────────────────────────────────────────


class NoteRow(SQLModel, table=True):
    __tablename__ = "notes"
    id: str = Field(default_factory=lambda: uuid4().hex[:12], primary_key=True)
    title: str = Field(index=True)
    content: str
    type: str = Field(default="text")
    tags_json: str = Field(default="[]")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


# ── Graph nodes table ──────────────────────────────────────


class GraphNodeRow(SQLModel, table=True):
    __tablename__ = "graph_nodes"
    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    type: str
    source_note_id: str = Field(index=True)
    created_at: str
    metadata_json: str = Field(default="{}")


# ── Graph edges table ──────────────────────────────────────


class GraphEdgeRow(SQLModel, table=True):
    __tablename__ = "graph_edges"
    id: str = Field(primary_key=True)
    source: str = Field(index=True)
    target: str = Field(index=True)
    type: str
    source_note_id: str
    confidence: float = Field(default=1.0)


# ── Init ───────────────────────────────────────────────────


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)


# ── Note helpers ───────────────────────────────────────────

from models import Note, NoteCreate, NoteUpdate, NoteType


def row_to_note(row: NoteRow) -> Note:
    return Note(
        id=row.id,
        title=row.title,
        content=row.content,
        type=NoteType(row.type),
        tags=json.loads(row.tags_json) if row.tags_json else [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_note(data: NoteCreate) -> Note:
    with get_session() as session:
        row = NoteRow(
            title=data.title,
            content=data.content,
            type=data.type.value,
            tags_json=json.dumps(data.tags, ensure_ascii=False),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row_to_note(row)


def get_note(note_id: str) -> Optional[Note]:
    with get_session() as session:
        row = session.get(NoteRow, note_id)
        return row_to_note(row) if row else None


def list_notes(limit: int = 50, offset: int = 0) -> list[Note]:
    with get_session() as session:
        stmt = select(NoteRow).order_by(NoteRow.updated_at.desc()).offset(offset).limit(limit)
        rows = session.exec(stmt).all()
        return [row_to_note(r) for r in rows]


def update_note(note_id: str, data: NoteUpdate) -> Optional[Note]:
    with get_session() as session:
        row = session.get(NoteRow, note_id)
        if not row:
            return None
        if data.title is not None:
            row.title = data.title
        if data.content is not None:
            row.content = data.content
        if data.tags is not None:
            row.tags_json = json.dumps(data.tags, ensure_ascii=False)
        row.updated_at = datetime.now()
        session.add(row)
        session.commit()
        session.refresh(row)
        return row_to_note(row)


def delete_note(note_id: str) -> bool:
    with get_session() as session:
        row = session.get(NoteRow, note_id)
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True


def search_notes(query: str, limit: int = 20) -> list[Note]:
    with get_session() as session:
        pattern = f"%{query}%"
        stmt = (
            select(NoteRow)
            .where(
                (NoteRow.title.ilike(pattern)) | (NoteRow.content.ilike(pattern))
            )
            .order_by(NoteRow.updated_at.desc())
            .limit(limit)
        )
        rows = session.exec(stmt).all()
        return [row_to_note(r) for r in rows]


def get_notes_by_ids(note_ids: list[str]) -> list[Note]:
    with get_session() as session:
        rows = [session.get(NoteRow, nid) for nid in note_ids]
        return [row_to_note(r) for r in rows if r]
