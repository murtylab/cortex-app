# Cortex Rule-Based Chat API

Rule-based chatbot backend: no LLM. Answers performance questions (best/worst per ROI, model info, scores) using Pydantic schemas and fuzzy matching.

## Setup

From repo root:

```bash
cd chat-api
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Ensure performance data and model metadata exist:

- `../assets/data/new/standardized_results_nsd_1000_models_univariate.json`
- `../assets/data/new/standardized_results_murty185_models_univariate.json`
- `../cortex-web-app/public/assets/data/models_metadata.json` (generated from `assets/js/constants.jsx`)

## Run

From **repo root** (so paths to `assets/` and `cortex-web-app/` resolve):

```bash
cd cortex-app
uvicorn chat-api.main:app --reload --host 0.0.0.0 --port 8000
```

Or from `chat-api/`:

```bash
cd chat-api
uvicorn main:app --reload --port 8000
```

Then open the web app; the widget in the lower-right calls `http://localhost:8000` by default. Set `NEXT_PUBLIC_RULE_CHAT_API` if the API runs elsewhere.

## Endpoints

- `POST /api/rule-chat` — body: `{"message": "best model for PPA?"}` → `{"reply": "...", "intent": "...", ...}`
- `GET /health` — liveness

## Capabilities

- **Best/worst model** for PPA, FFA, or EBA (optionally “trained on NSD” or “Murty185”).
- **Model info** from model card (e.g. “What is BLIP2?”).
- **Score** for a model in a region (e.g. “How does Nomic do in FFA?”).
- Tolerates **spelling and capitalization** (fuzzy match on model names and ROIs).

Scores use univariate data only; “global score” averages over all available datasets excluding the training datasets (Murty185 and NSD1000), matching the Scoreboard’s “Global Score” column.

## Adding an LLM later

Keep `/api/rule-chat` for rule-based answers. Add a separate route (e.g. `/api/chat-compare`) that calls an LLM for comparison or open-ended questions, and have the frontend call the appropriate endpoint based on intent or user choice.
