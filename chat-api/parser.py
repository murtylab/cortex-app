"""Parse user message into structured query (intent + entities)."""
from __future__ import annotations

import re
from unicodedata import normalize

from engine import DataStore, EVAL_DATASET_ALIASES
from schemas import Intent, ParsedQuery, ROI, ScoreType, TrainingDataset


def normalize_text(s: str) -> str:
    """Lowercase, collapse spaces, strip punctuation; normalize contractions."""
    s = normalize("NFKC", s)
    s = s.strip().lower()
    # Strip punctuation (replace with space so word boundaries work)
    s = re.sub(r"[?!.,;:'\"]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Expand common contractions so intent patterns match
    s = re.sub(r"\bwhat's\b", "what is", s)
    s = re.sub(r"\bwhat're\b", "what are", s)
    s = re.sub(r"\bwhats\b", "what is", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _detect_score_type(text: str) -> ScoreType | None:
    if re.search(r"\bmultivariate\b|\bmulti\b|\brdm\b|\brdms\b", text):
        return ScoreType.MULTIVARIATE
    if re.search(r"\bunivariate\b|\buni\b|\bvoxel\b", text):
        return ScoreType.UNIVARIATE
    return None


def parse_query(raw: str, store: DataStore) -> ParsedQuery:
    """Rule-based intent and entity extraction with fuzzy model/ROI matching."""
    normalized = normalize_text(raw)
    score_type = _detect_score_type(normalized)
    result = _parse_query_inner(normalized, store)
    result = result.model_copy(update={"score_type": score_type})
    # "blip2 multivariate score" → inner parser returns MODEL_INFO; promote to MODEL_SCORE
    if score_type is not None and result.intent == Intent.MODEL_INFO and result.model_value:
        result = result.model_copy(update={"intent": Intent.MODEL_SCORE})
    return result


def _parse_query_inner(normalized: str, store: DataStore) -> ParsedQuery:
    """Core rule-based parser — returns ParsedQuery without score_type."""
    if not normalized:
        return ParsedQuery(intent=Intent.UNKNOWN, normalized_raw=normalized)

    roi_tokens = {"ppa", "ffa", "eba"}
    # Words that should never be interpreted as model names when doing
    # fuzzy matching (prevents cases like "where" → "hrnet").
    stopwords_models = {
        "models",
        "model",
        "datasets",
        "dataset",
        "scores",
        "score",
        "performance",
        "global",
        "activity",
        "predict",
        "brain",
        "across",
        "mean",
        "the",
        "what",
        "which",
        "where",
        "can",
        "see",
        "ai",
        "do",
        "does",
        "best",
        "worst",
        "better",
        "compare",
        "how",
        "well",
        "rank",
        "ranking",
        "rankings",
        "top",
        "bottom",
        "on",
        "in",
        "for",
        "at",
        "of",
        "is",
        "are",
    }

    # Greeting / help
    if re.search(r"\b(hi|hello|hey|help|what can you do)\b", normalized):
        if "help" in normalized or "what can you do" in normalized:
            return ParsedQuery(intent=Intent.HELP, normalized_raw=normalized)
        return ParsedQuery(intent=Intent.GREETING, normalized_raw=normalized)

    # Dataset-specific score — check FIRST so "blip2 on bold5000" isn't swallowed by generic patterns
    eval_ds = store.detect_eval_dataset(normalized)
    if eval_ds:
        training = store.detect_training(normalized)
        roi = store.fuzzy_roi(normalized)
        # Try to find a model name
        ds_model_pattern = re.search(
            r"\b(?:score|performance|how\s+(?:well|does?)\s+)?(?:for\s+|of\s+)?([\w\-\.]+)\s+(?:on|in|for|at)\s+",
            normalized,
        )
        model_val = None
        if ds_model_pattern:
            cand = ds_model_pattern.group(1)
            if cand not in stopwords_models and cand not in roi_tokens:
                model_val = store.fuzzy_model(cand)
        if not model_val:
            for w in normalized.split():
                if len(w) >= 2 and w not in stopwords_models and w not in roi_tokens:
                    candidate = store.fuzzy_model(w)
                    if candidate:
                        model_val = candidate
                        break
        is_ranking = bool(re.search(r"\b(best|top|worst|bottom)\b", normalized))
        if model_val and not is_ranking:
            return ParsedQuery(intent=Intent.DATASET_SCORE, model_value=model_val, roi=roi, eval_dataset=eval_ds, training=training, normalized_raw=normalized)
        if is_ranking:
            intent = Intent.WORST_MODEL if re.search(r"\b(worst|bottom)\b", normalized) else Intent.BEST_MODEL
            return ParsedQuery(intent=intent, roi=roi, eval_dataset=eval_ds, training=training, normalized_raw=normalized)
        if roi:
            return ParsedQuery(intent=Intent.DATASET_SCORE, model_value=model_val, roi=roi, eval_dataset=eval_ds, training=training, normalized_raw=normalized)

    # Model comparison: "is blip2 better than dinov2 (in EBA)?", "compare blip2 and dinov2"
    better_than = re.search(
        r"\bis\s+([\w\-\.]+)\s+better\s+than\s+([\w\-\.]+)(?:\s+(?:overall|in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    if better_than:
        m1_raw, m2_raw, roi_raw = better_than.groups()
        model1 = store.fuzzy_model(m1_raw)
        model2 = store.fuzzy_model(m2_raw)
        roi = store.fuzzy_roi(roi_raw) if roi_raw else None
        training = store.detect_training(normalized)
        if model1 and model2:
            return ParsedQuery(
                intent=Intent.COMPARE_MODELS,
                model_value=model1,
                compare_model_value=model2,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    # "is dinov2 or blip2 better?", "is A or B better (in EBA)?"
    is_a_or_b_better = re.search(
        r"\bis\s+([\w\-\.]+)\s+or\s+([\w\-\.]+)\s+better(?:\s+(?:overall|in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    if is_a_or_b_better:
        m1_raw, m2_raw, roi_raw = is_a_or_b_better.groups()
        model1 = store.fuzzy_model(m1_raw)
        model2 = store.fuzzy_model(m2_raw)
        roi = store.fuzzy_roi(roi_raw) if roi_raw else None
        training = store.detect_training(normalized)
        if model1 and model2:
            return ParsedQuery(
                intent=Intent.COMPARE_MODELS,
                model_value=model1,
                compare_model_value=model2,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    compare_and = re.search(
        r"\bcompare\s+([\w\-\.]+)\s+(?:and|vs)\s+([\w\-\.]+)(?:\s+(?:overall|in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    if compare_and:
        m1_raw, m2_raw, roi_raw = compare_and.groups()
        model1 = store.fuzzy_model(m1_raw)
        model2 = store.fuzzy_model(m2_raw)
        roi = store.fuzzy_roi(roi_raw) if roi_raw else None
        training = store.detect_training(normalized)
        if model1 and model2:
            return ParsedQuery(
                intent=Intent.COMPARE_MODELS,
                model_value=model1,
                compare_model_value=model2,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    # "which is better, dinov2 or blip2?", "dinov2 or blip2, which is better?"
    which_better_a_or_b = re.search(
        r"\b(?:which\s+is\s+better,?\s+)?([\w\-\.]+)\s+or\s+([\w\-\.]+)(?:\s*,?\s*which\s+is\s+better)?(?:\s+(?:in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    if which_better_a_or_b and "better" in normalized:
        m1_raw, m2_raw, roi_raw = which_better_a_or_b.groups()
        model1 = store.fuzzy_model(m1_raw)
        model2 = store.fuzzy_model(m2_raw)
        roi = store.fuzzy_roi(roi_raw) if roi_raw else None
        training = store.detect_training(normalized)
        if model1 and model2:
            return ParsedQuery(
                intent=Intent.COMPARE_MODELS,
                model_value=model1,
                compare_model_value=model2,
                roi=roi,
                training=training,
                normalized_raw=normalized,
            )

    # Best / worst model (for a region)
    # e.g. "Which model performs best overall?", "What model performs best on EBA?"
    # Also: "Which AI models best predict brain activity across datasets?"
    which_models_best = re.search(
        r"\b(?:which|what)\s+(?:ai\s+)?models\s+(?:best|most)\s+(?:predict|explain)",
        normalized,
    )
    if which_models_best:
        training = store.detect_training(normalized)
        return ParsedQuery(intent=Intent.BEST_MODEL, training=training, normalized_raw=normalized)

    which_best = re.search(
        r"\b(?:which|what)\s+model\s+(?:performs|does)\s+best(?:\s+(?:overall|in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    which_worst = re.search(
        r"\b(?:which|what)\s+model\s+(?:performs|does)\s+worst(?:\s+(?:overall|in|for|on)\s+(ppa|ffa|eba))?\b",
        normalized,
    )
    if which_best or which_worst:
        intent = Intent.WORST_MODEL if which_worst else Intent.BEST_MODEL
        m = which_worst or which_best
        roi = None
        if m.group(1):
            roi = store.fuzzy_roi(m.group(1))
        training = store.detect_training(normalized)
        return ParsedQuery(intent=intent, roi=roi, training=training, normalized_raw=normalized)

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

    # "best model", "best nsd trained model", "best murty model" (no region)
    if re.search(r"\b(best|top)\s+(?:(?:nsd|murty(?:185)?)[-\s]*)?(?:trained\s+)?model\b", normalized) or re.search(r"\b(best|top)\s+model\b", normalized):
        training = store.detect_training(normalized)
        return ParsedQuery(intent=Intent.BEST_MODEL, training=training, normalized_raw=normalized)
    if re.search(r"\b(worst|bottom)\s+(?:(?:nsd|murty(?:185)?)[-\s]*)?(?:trained\s+)?model\b", normalized) or re.search(r"\b(worst|bottom)\s+model\b", normalized):
        training = store.detect_training(normalized)
        return ParsedQuery(intent=Intent.WORST_MODEL, training=training, normalized_raw=normalized)

    # Overall performance for a model (no ROI specified)
    # e.g. "What is the performance of BLIP2?", "Score for DINOv2?"
    model_score_overall = re.search(
        r"\b(?:what\s+is\s+)?(?:the\s+)?(?:score|performance)\s+(?:for|of)\s+([\w\-\.]+)\b",
        normalized,
    )
    if model_score_overall:
        model_val = store.fuzzy_model(model_score_overall.group(1))
        if model_val:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.MODEL_SCORE,
                model_value=model_val,
                training=training,
                normalized_raw=normalized,
            )

    # "[model] performance" / "[model] score" / "[model] multivariate score"
    _SCORE_TYPE_WORDS = {"multivariate", "univariate", "multi", "uni"}
    model_then_metric = re.search(
        r"\b([\w\-\.]+)\s+(?:(?:multivariate|univariate|multi|uni)\s+)?(?:performance|score)\b",
        normalized,
    )
    if model_then_metric:
        cand = model_then_metric.group(1)
        model_val = store.fuzzy_model(cand) if cand not in _SCORE_TYPE_WORDS else None
        if model_val:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.MODEL_SCORE,
                model_value=model_val,
                training=training,
                normalized_raw=normalized,
            )

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

    # "what does [model] perform best on?"
    best_on = re.search(
        r"\bwhat\s+does\s+([\w\-\.]+)\s+perform\s+best\s+on\b",
        normalized,
    )
    if best_on:
        model_val = store.fuzzy_model(best_on.group(1))
        if model_val:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.BEST_ROI_FOR_MODEL,
                model_value=model_val,
                training=training,
                normalized_raw=normalized,
            )

    # "[model] in PPA" or "how does [model] do in FFA"
    model_in_roi = re.search(
        r"\b(?:how\s+does?|what\s+about|info\s+on|tell\s+me\s+about)\s+([\w\-\.]+)\s+(?:do\s+)?(?:in|for)\s+(ppa|ffa|eba)\b",
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

    # Bare: "[model] in ppa"
    bare_model_in_roi = re.search(r"\b([\w\-\.]+)\s+(?:in|for)\s+(ppa|ffa|eba)\b", normalized)
    if bare_model_in_roi:
        candidate, roi_raw = bare_model_in_roi.groups()
        # Avoid treating generic tokens and common verbs as a model name
        if candidate not in {"model", "models", "do", "does", "is", "are", "perform", "score"}:
            model_val = store.fuzzy_model(candidate)
            roi = store.fuzzy_roi(roi_raw)
            if model_val and roi:
                training = store.detect_training(normalized)
                return ParsedQuery(
                    intent=Intent.MODEL_SCORE,
                    model_value=model_val,
                    roi=roi,
                    training=training,
                    normalized_raw=normalized,
                )

    # "how well does [model] perform?" / "how does [model] do?"
    model_how_well = re.search(r"\bhow\s+(?:well\s+)?does?\s+([\w\-\.]+)\s+(?:perform|do)\b", normalized)
    if model_how_well:
        model_val = store.fuzzy_model(model_how_well.group(1))
        if model_val:
            training = store.detect_training(normalized)
            return ParsedQuery(
                intent=Intent.MODEL_SCORE,
                model_value=model_val,
                training=training,
                normalized_raw=normalized,
            )

    # "What do the performance scores mean?" / "What is global score?"
    # Treat these as score-meaning questions, not model info.
    if (
        re.search(r"\bwhat\s+do\s+.*\b(?:performance\s+)?scores?\s+mean\b", normalized)
        or re.search(r"\b(?:score\s+meaning|performance\s+scores?)\b", normalized)
        or re.search(r"\bwhat\s+is\s+global\s+score\b", normalized)
        or re.search(r"\bglobal\s+score\b", normalized)
    ):
        return ParsedQuery(intent=Intent.SCORE_MEANING, normalized_raw=normalized)

    # Model info: "what is blip2", "tell me about nomic", "blip2 card", "info clip_rn50"
    info_pattern = re.search(
        r"\b(?:what\s+is|who\s+is|tell\s+me\s+about|info(?:rmation)?\s+(?:on|about)?|describe)\s+([\w\-\.]+)\b",
        normalized,
    )
    if info_pattern:
        candidate = info_pattern.group(1)
        # Avoid treating ROI names like "eba" as models
        if candidate not in roi_tokens:
            model_val = store.fuzzy_model(candidate)
            if model_val:
                return ParsedQuery(intent=Intent.MODEL_INFO, model_value=model_val, normalized_raw=normalized)

    # Bare model name at end: "blip2", "nomic", "CLIP RN50"
    # To avoid false positives like "Where can I see model rankings?"
    # turning into arbitrary model info, only apply this heuristic when
    # the message is very short (1–3 words) and treat only the final
    # token(s) as candidates.
    words = normalized.split()
    if 1 <= len(words) <= 3:
        for w in reversed(words):
            if len(w) >= 2 and w not in roi_tokens and w not in stopwords_models:
                model_val = store.fuzzy_model(w)
                if model_val:
                    return ParsedQuery(
                        intent=Intent.MODEL_INFO,
                        model_value=model_val,
                        normalized_raw=normalized,
                    )

    return ParsedQuery(intent=Intent.UNKNOWN, normalized_raw=normalized)
