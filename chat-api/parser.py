"""Parse user message into structured query (intent + entities)."""
from __future__ import annotations

import re
from unicodedata import normalize

from engine import DataStore
from schemas import Intent, ParsedQuery, ROI, TrainingDataset


def normalize_text(s: str) -> str:
    """Lowercase, collapse spaces, strip."""
    s = normalize("NFKC", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def parse_query(raw: str, store: DataStore) -> ParsedQuery:
    """Rule-based intent and entity extraction with fuzzy model/ROI matching."""
    normalized = normalize_text(raw)
    if not normalized:
        return ParsedQuery(intent=Intent.UNKNOWN, normalized_raw=normalized)

    # Greeting / help
    if re.search(r"\b(hi|hello|hey|help|what can you do)\b", normalized):
        if "help" in normalized or "what can you do" in normalized:
            return ParsedQuery(intent=Intent.HELP, normalized_raw=normalized)
        return ParsedQuery(intent=Intent.GREETING, normalized_raw=normalized)

    # Best / worst model (for a region)
    best_match = re.search(r"\b(best|top)\s+(model|for)\s+(\w+)", normalized) or re.search(
        r"\b(best|top)\s+(\w+)\s+model", normalized
    )
    worst_match = re.search(r"\b(worst|bottom)\s+(model|for)\s+(\w+)", normalized) or re.search(
        r"\b(worst|bottom)\s+(\w+)\s+model", normalized
    )
    # "best model for PPA", "best for ffa", "worst model for eba"
    for_match = re.search(
        r"\b(best|worst)\s+(?:model\s+)?(?:for\s+)?(ppa|ffa|eba|fusiform|parahippocampal|extrastriate|body|face)\b",
        normalized,
    )
    if for_match:
        intent = Intent.WORST_MODEL if for_match.group(1) == "worst" else Intent.BEST_MODEL
        roi_str = for_match.group(2)
        roi = store.fuzzy_roi(roi_str)
        training = store.detect_training(normalized)
        return ParsedQuery(
            intent=intent,
            roi=roi,
            training=training,
            normalized_raw=normalized,
        )

    if best_match or worst_match:
        intent = Intent.WORST_MODEL if worst_match else Intent.BEST_MODEL
        roi = store.fuzzy_roi(normalized)
        training = store.detect_training(normalized)
        return ParsedQuery(intent=intent, roi=roi, training=training, normalized_raw=normalized)

    # "best model", "worst model" (no region)
    if re.search(r"\b(best|top)\s+model\b", normalized):
        training = store.detect_training(normalized)
        return ParsedQuery(intent=Intent.BEST_MODEL, training=training, normalized_raw=normalized)
    if re.search(r"\b(worst|bottom)\s+model\b", normalized):
        training = store.detect_training(normalized)
        return ParsedQuery(intent=Intent.WORST_MODEL, training=training, normalized_raw=normalized)

    # "what is [model]", "info about [model]", "[model] performance", "score for [model] in PPA"
    model_score_roi = re.search(
        r"\b(?:score|performance|how well)\s+(?:for|of)?\s*([\w\-\.]+)\s+(?:in|for)\s+(ppa|ffa|eba)\b",
        normalized,
    )
    if model_score_roi:
        model_val = store.fuzzy_model(model_score_roi.group(1))
        roi = store.fuzzy_roi(model_score_roi.group(2))
        if model_val and roi:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.MODEL_SCORE,
                model_value=model_val,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    # "[model] in PPA" or "how does [model] do in FFA"
    model_in_roi = re.search(
        r"\b(?:how\s+does?|what\s+about|info\s+on|tell\s+me\s+about)\s+([\w\-\.]+)\s+(?:in|for)\s+(ppa|ffa|eba)\b",
        normalized,
    )
    if model_in_roi:
        model_val = store.fuzzy_model(model_in_roi.group(1))
        roi = store.fuzzy_roi(model_in_roi.group(2))
        if model_val and roi:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.MODEL_SCORE,
                model_value=model_val,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    # Model info: "what is blip2", "tell me about nomic", "blip2 card", "info clip_rn50"
    info_pattern = re.search(
        r"\b(?:what\s+is|who\s+is|tell\s+me\s+about|info(?:rmation)?\s+(?:on|about)?|describe)\s+([\w\-\.]+)\b",
        normalized,
    )
    if info_pattern:
        model_val = store.fuzzy_model(info_pattern.group(1))
        if model_val:
            return ParsedQuery(intent=Intent.MODEL_INFO, model_value=model_val, normalized_raw=normalized)

    # Bare model name at end: "blip2", "nomic", "CLIP RN50"
    words = normalized.split()
    for w in words:
        if len(w) >= 2:
            model_val = store.fuzzy_model(w)
            if model_val:
                return ParsedQuery(intent=Intent.MODEL_INFO, model_value=model_val, normalized_raw=normalized)

    return ParsedQuery(intent=Intent.UNKNOWN, normalized_raw=normalized)
