"""知链 (Zhilian) — AI-driven personal knowledge graph.

FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from graph_store import graph_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown events."""
    init_db()
    print(f"📊 Supabase connected, graph: {graph_store.stats()}")
    yield


app = FastAPI(
    title="知链 API",
    description="AI-driven personal knowledge graph management",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
from routes.notes import router as notes_router
from routes.graph import router as graph_router
from routes.ai import router as ai_router

app.include_router(notes_router)
app.include_router(graph_router)
app.include_router(ai_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "graph": graph_store.stats()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
