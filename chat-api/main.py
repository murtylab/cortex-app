"""Rule-based chat API + optional Gemini LLM for open-ended questions."""
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from engine import DataStore
from gemini_client import get_gemini_reply
from parser import parse_query
from replies import build_reply
from schemas import ChatRequest, ChatResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.post("/api/gemini", response_model=ChatResponse)
def gemini_chat(body: ChatRequest) -> Any:
    """Use Gemini for open-ended questions when rule-chat doesn't apply. Requires GEMINI_API_KEY."""
    reply = get_gemini_reply(body.message)
    if reply is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment.",
        )
    return ChatResponse(reply=reply)


@app.post("/api/chat", response_model=ChatResponse)
def smart_chat(body: ChatRequest) -> Any:
    """Unified endpoint: rule-based data + Gemini explanation for complex questions."""
    store: DataStore = app.state.store
    parsed = parse_query(body.message, store)

    # Intents that benefit from real data + Gemini explanation
    EXPLAIN_INTENTS = {
        "compare_models", "best_model", "worst_model",
        "model_score", "dataset_score", "best_roi_for_model",
        "score_meaning", "model_info",
    }

    if parsed.intent.value in EXPLAIN_INTENTS:
        rule_reply = build_reply(parsed, store)
        # Use rule data as Gemini context so it can explain with real numbers
        gemini_reply = get_gemini_reply(body.message, rule_context=rule_reply.reply)
        if gemini_reply:
            return ChatResponse(
                reply=gemini_reply,
                intent=rule_reply.intent,
                model_value=rule_reply.model_value,
                compare_model_value=rule_reply.compare_model_value,
                roi=rule_reply.roi,
                training=rule_reply.training,
            )
        # Gemini unavailable — return raw rule reply
        return rule_reply

    # Unknown intent → pure Gemini (handles greetings, help, and any open-ended question)
    gemini_reply = get_gemini_reply(body.message)
    if gemini_reply:
        return ChatResponse(reply=gemini_reply)

    # Gemini also failed — fall back to rule-chat's reply
    return build_reply(parsed, store)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
