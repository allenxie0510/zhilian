"""Notes API routes."""

from fastapi import APIRouter, HTTPException

from database import create_note, delete_note, get_note, list_notes, search_notes, update_note
from models import Note, NoteCreate, NoteUpdate

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.post("", response_model=Note, status_code=201)
def create(note: NoteCreate) -> Note:
    """Create a new note. After creation, trigger AI extraction via the /api/ai/extract endpoint."""
    return create_note(note)


@router.get("", response_model=list[Note])
def list_all(limit: int = 50, offset: int = 0) -> list[Note]:
    return list_notes(limit=limit, offset=offset)


@router.get("/search", response_model=list[Note])
def search(q: str, limit: int = 20) -> list[Note]:
    return search_notes(q, limit=limit)


@router.get("/{note_id}", response_model=Note)
def get_one(note_id: str) -> Note:
    note = get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note


@router.put("/{note_id}", response_model=Note)
def update(note_id: str, data: NoteUpdate) -> Note:
    note = update_note(note_id, data)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note


@router.delete("/{note_id}")
def delete(note_id: str) -> dict:
    if not delete_note(note_id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"ok": True}
