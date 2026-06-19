"""SQLite database for note metadata — using sqlmodel."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, Session, SQLModel, create_engine, select

DATA_DIR = Path(os.environ.get("ZHILIAN_DATA_DIR", "./data"))
DATABASE_URL = f"sqlite:///{DATA_DIR / 'zhilian.db'}"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


class NoteRow(SQLModel, table=True):
    __tablename__ = "notes"
    id: str = Field(default_factory=lambda: uuid4().hex[:12], primary_key=True)
    title: str = Field(index=True)
    content: str
    type: str = Field(default="text")
    tags_json: str = Field(default="[]")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)


# ── Helper to convert between Row and Pydantic model ──

from models import Note, NoteCreate, NoteUpdate, NoteType


def row_to_note(row: NoteRow) -> Note:
    import json
    return Note(
        id=row.id,
        title=row.title,
        content=row.content,
        type=NoteType(row.type),
        tags=json.loads(row.tags_json) if row.tags_json else [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def note_to_row(note: NoteCreate) -> NoteRow:
    import json
    return NoteRow(
        title=note.title,
        content=note.content,
        type=note.type.value,
        tags_json=json.dumps(note.tags, ensure_ascii=False),
    )


# ── CRUD operations ──

def create_note(data: NoteCreate) -> Note:
    import json
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
    import json
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
                (NoteRow.title.contains(query)) | (NoteRow.content.contains(query))
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
