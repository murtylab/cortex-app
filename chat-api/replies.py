"""Build reply text from parsed query and data store."""
from __future__ import annotations

from engine import DataStore
from parser import parse_query
from schemas import ChatResponse, Intent, ParsedQuery, TrainingDataset


def _training_label(t: TrainingDataset) -> str:
    return "NSD" if t == TrainingDataset.NSD else "Murty185"


def build_reply(parsed: ParsedQuery, store: DataStore) -> ChatResponse:
    """Generate a rule-based reply. No LLM."""
    if parsed.intent == Intent.GREETING:
        return ChatResponse(
            reply="Hi! I can tell you the best or worst model for PPA, FFA, or EBA; model card info; or a model’s score in a region. Try: “Best model for PPA?” or “What is BLIP2?”",
        )
    if parsed.intent == Intent.HELP:
        return ChatResponse(
            reply="Ask me: (1) Best or worst model for a region — e.g. “Best model for FFA?”, “Worst for PPA trained on Murty185?” (2) Model info — e.g. “What is Nomic?”, “Tell me about CLIP RN50”. (3) Score — e.g. “How does Blip2 do in PPA?”. I use univariate scores and exclude the training set from evaluation.",
        )

    training = parsed.training or TrainingDataset.NSD
    training_str = _training_label(training)

    if parsed.intent == Intent.BEST_MODEL:
        if parsed.roi:
            rows = store.best_worst_for_roi(parsed.roi.value, training, worst=False)
            if not rows:
                return ChatResponse(
                    reply=f"No performance data found for {parsed.roi.value.upper()} with {training_str}-trained models.",
                    intent=parsed.intent.value,
                    roi=parsed.roi.value,
                    training=training_str,
                )
            model_val, score = rows[0]
            label = store.label_for(model_val)
            return ChatResponse(
                reply=f"The best {training_str}-trained model for {parsed.roi.value.upper()} is {label} (score {score:.4f}, averaged over evaluation datasets only).",
                intent=parsed.intent.value,
                model_value=model_val,
                roi=parsed.roi.value,
                training=training_str,
            )
        # Overall best
        rows = store.best_worst_overall(training, worst=False)
        if not rows:
            return ChatResponse(
                reply=f"No performance data found for {training_str}-trained models.",
                intent=parsed.intent.value,
                training=training_str,
            )
        model_val, score = rows[0]
        label = store.label_for(model_val)
        return ChatResponse(
            reply=f"The best {training_str}-trained model overall (PPA/FFA/EBA, eval datasets only) is {label} (score {score:.4f}).",
            intent=parsed.intent.value,
            model_value=model_val,
            training=training_str,
        )

    if parsed.intent == Intent.WORST_MODEL:
        if parsed.roi:
            rows = store.best_worst_for_roi(parsed.roi.value, training, worst=True)
            if not rows:
                return ChatResponse(
                    reply=f"No performance data found for {parsed.roi.value.upper()} with {training_str}-trained models.",
                    intent=parsed.intent.value,
                    roi=parsed.roi.value,
                    training=training_str,
                )
            model_val, score = rows[0]
            label = store.label_for(model_val)
            return ChatResponse(
                reply=f"The worst {training_str}-trained model for {parsed.roi.value.upper()} is {label} (score {score:.4f}, averaged over evaluation datasets only).",
                intent=parsed.intent.value,
                model_value=model_val,
                roi=parsed.roi.value,
                training=training_str,
            )
        rows = store.best_worst_overall(training, worst=True)
        if not rows:
            return ChatResponse(
                reply=f"No performance data found for {training_str}-trained models.",
                intent=parsed.intent.value,
                training=training_str,
            )
        model_val, score = rows[0]
        label = store.label_for(model_val)
        return ChatResponse(
            reply=f"The worst {training_str}-trained model overall (PPA/FFA/EBA) is {label} (score {score:.4f}).",
            intent=parsed.intent.value,
            model_value=model_val,
            training=training_str,
        )

    if parsed.intent == Intent.MODEL_INFO and parsed.model_value:
        meta = store.model_info(parsed.model_value)
        if not meta:
            return ChatResponse(
                reply=f"I don’t have metadata for “{parsed.model_value}”.",
                model_value=parsed.model_value,
            )
        label = meta.get("label", parsed.model_value)
        model_type = meta.get("type", "")
        card = meta.get("cardUrl", "").strip()
        msg = f"{label} is a {model_type}."
        if card:
            msg += f" Model card: {card}"
        return ChatResponse(reply=msg, intent=parsed.intent.value, model_value=parsed.model_value)

    if parsed.intent == Intent.MODEL_SCORE and parsed.model_value and parsed.roi:
        training_used = parsed.training or TrainingDataset.NSD
        score = store.model_score_for_roi(parsed.model_value, parsed.roi.value, training_used)
        if score is None:
            return ChatResponse(
                reply=f"No score found for {store.label_for(parsed.model_value)} in {parsed.roi.value.upper()} ({_training_label(training_used)}-trained).",
                model_value=parsed.model_value,
                roi=parsed.roi.value,
                training=_training_label(training_used),
            )
        label = store.label_for(parsed.model_value)
        return ChatResponse(
            reply=f"{label} in {parsed.roi.value.upper()} ({_training_label(training_used)}-trained): {score:.4f} (avg over evaluation datasets).",
            intent=parsed.intent.value,
            model_value=parsed.model_value,
            roi=parsed.roi.value,
            training=_training_label(training_used),
        )

    return ChatResponse(
        reply="I didn’t understand that. Try: “Best model for PPA?”, “Worst for FFA?”, “What is Nomic?”, or “How does BLIP2 do in EBA?”.",
    )
