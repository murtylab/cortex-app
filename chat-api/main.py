"""Rule-based chat API: no LLM, Pydantic schemas, fuzzy matching."""
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from engine import DataStore
from parser import parse_query
from replies import build_reply
from schemas import ChatRequest, ChatResponse


@asynccontextmanager
def lifespan(app: FastAPI):
    app.state.store = DataStore()
    app.state.store.load()
    yield
    app.state.store = None


app = FastAPI(title="Cortex Rule Chat", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/rule-chat", response_model=ChatResponse)
def rule_chat(body: ChatRequest) -> Any:
    """Handle one user message; return rule-based reply (no LLM)."""
    store: DataStore = app.state.store
    parsed = parse_query(body.message, store)
    return build_reply(parsed, store)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
