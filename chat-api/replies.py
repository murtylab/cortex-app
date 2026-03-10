"""Build reply text from parsed query and data store."""
from __future__ import annotations

from engine import DataStore
from schemas import ChatResponse, Intent, ParsedQuery, ScoreType, TrainingDataset


ROIS = ["ppa", "ffa", "eba"]


def _training_label(t: TrainingDataset) -> str:
    return "NSD" if t == TrainingDataset.NSD else "Murty185"


def _score_label(s: ScoreType | None) -> str:
    if s == ScoreType.MULTIVARIATE:
        return "multivariate"
    if s == ScoreType.UNIVARIATE:
        return "univariate"
    return "univariate"  # default


def build_reply(parsed: ParsedQuery, store: DataStore) -> ChatResponse:
    """Generate a rule-based reply. No LLM."""

    # Greeting / help
    if parsed.intent == Intent.GREETING:
        return ChatResponse(
            reply=(
                "Hi! I can tell you the best or worst model for PPA, FFA, or EBA; "
                "model card info; or a model's score in a region. "
                'Try: "Best model for PPA?" or "What is BLIP2?".'
            ),
        )

    if parsed.intent == Intent.HELP:
        return ChatResponse(
            reply=(
                "Ask me: (1) Best or worst model for a region — e.g. "
                '"Best model for FFA?", "Worst for PPA trained on Murty185?" '
                "(2) Model info — e.g. \"What is Nomic?\", \"Tell me about CLIP RN50\". "
                '(3) Score — e.g. "How does BLIP2 do in PPA?". '
                "I use univariate scores and compute a global score that excludes the training set."
            ),
        )

    training = parsed.training or TrainingDataset.NSD
    training_str = _training_label(training)
    score_type = parsed.score_type
    score_label = _score_label(score_type)

    # Best / worst model
    if parsed.intent == Intent.BEST_MODEL:
        if parsed.roi:
            rows = store.best_worst_for_roi(parsed.roi.value, training, worst=False, score_type=score_type)
            if not rows:
                return ChatResponse(
                    reply=(
                        f"No performance data found for {parsed.roi.value.upper()} "
                        f"with {training_str}-trained models."
                    ),
                    intent=parsed.intent.value,
                    roi=parsed.roi.value,
                    training=training_str,
                )
            model_val, score = rows[0]
            label = store.label_for(model_val)
            return ChatResponse(
                reply=(
                    f"The best {training_str}-trained model for {parsed.roi.value.upper()} ({score_label}) is {label} "
                    f"(global score {score:.4f}; averaged across evaluation datasets, excluding "
                    "Murty185 and NSD1000)."
                ),
                intent=parsed.intent.value,
                model_value=model_val,
                roi=parsed.roi.value,
                training=training_str,
            )

        rows = store.best_worst_overall(training, worst=False, score_type=score_type)
        if not rows:
            return ChatResponse(
                reply=f"No performance data found for {training_str}-trained models.",
                intent=parsed.intent.value,
                training=training_str,
            )
        model_val, score = rows[0]
        label = store.label_for(model_val)
        return ChatResponse(
            reply=(
                f"The best {training_str}-trained model overall ({score_label}; PPA/FFA/EBA; global score excludes "
                f"Murty185 and NSD1000) is {label} (score {score:.4f})."
            ),
            intent=parsed.intent.value,
            model_value=model_val,
            training=training_str,
        )

    if parsed.intent == Intent.WORST_MODEL:
        if parsed.roi:
            rows = store.best_worst_for_roi(parsed.roi.value, training, worst=True, score_type=score_type)
            if not rows:
                return ChatResponse(
                    reply=(
                        f"No performance data found for {parsed.roi.value.upper()} "
                        f"with {training_str}-trained models."
                    ),
                    intent=parsed.intent.value,
                    roi=parsed.roi.value,
                    training=training_str,
                )
            model_val, score = rows[0]
            label = store.label_for(model_val)
            return ChatResponse(
                reply=(
                    f"The worst {training_str}-trained model for {parsed.roi.value.upper()} ({score_label}) is {label} "
                    f"(global score {score:.4f}; averaged across evaluation datasets, excluding "
                    "Murty185 and NSD1000)."
                ),
                intent=parsed.intent.value,
                model_value=model_val,
                roi=parsed.roi.value,
                training=training_str,
            )

        rows = store.best_worst_overall(training, worst=True, score_type=score_type)
        if not rows:
            return ChatResponse(
                reply=f"No performance data found for {training_str}-trained models.",
                intent=parsed.intent.value,
                training=training_str,
            )
        model_val, score = rows[0]
        label = store.label_for(model_val)
        return ChatResponse(
            reply=(
                f"The worst {training_str}-trained model overall ({score_label}; PPA/FFA/EBA; global score excludes "
                f"Murty185 and NSD1000) is {label} (score {score:.4f})."
            ),
            intent=parsed.intent.value,
            model_value=model_val,
            training=training_str,
        )

    # Model info (definition/model card)
    if parsed.intent == Intent.MODEL_INFO and parsed.model_value:
        meta = store.model_info(parsed.model_value)
        if not meta:
            return ChatResponse(
                reply=f"I don't have metadata for \"{parsed.model_value}\".",
                model_value=parsed.model_value,
            )
        label = meta.get("label", parsed.model_value)
        model_type = meta.get("type", "")
        card = meta.get("cardUrl", "").strip()
        if card:
            linked_label = (
                f'<a href="{card}" target="_blank" rel="noopener noreferrer">{label}</a>'
            )
        else:
            linked_label = label
        if model_type:
            msg = f"{linked_label} is a {model_type}."
        else:
            msg = linked_label
        return ChatResponse(
            reply=msg,
            intent=parsed.intent.value,
            model_value=parsed.model_value,
        )

    # Model score (per ROI)
    if parsed.intent == Intent.MODEL_SCORE and parsed.model_value and parsed.roi:
        label = store.label_for(parsed.model_value)
        roi_str = parsed.roi.value.upper()

        if parsed.training is None:
            # No training specified — show both NSD and Murty185
            nsd_s = store.model_score_for_roi(parsed.model_value, parsed.roi.value, TrainingDataset.NSD, score_type)
            murty_s = store.model_score_for_roi(parsed.model_value, parsed.roi.value, TrainingDataset.MURTY185, score_type)
            parts = []
            if nsd_s is not None:
                parts.append(f"NSD-trained: {nsd_s:.4f}")
            if murty_s is not None:
                parts.append(f"Murty185-trained: {murty_s:.4f}")
            if not parts:
                return ChatResponse(
                    reply=f"No score found for {label} in {roi_str}.",
                    model_value=parsed.model_value,
                    roi=parsed.roi.value,
                )
            return ChatResponse(
                reply=f"{label} in {roi_str} ({score_label}): {'; '.join(parts)}.",
                intent=parsed.intent.value,
                model_value=parsed.model_value,
                roi=parsed.roi.value,
            )

        training_used = parsed.training
        score = store.model_score_for_roi(parsed.model_value, parsed.roi.value, training_used, score_type)
        if score is None:
            return ChatResponse(
                reply=(
                    f"No score found for {label} in {roi_str} "
                    f"({_training_label(training_used)}-trained)."
                ),
                model_value=parsed.model_value,
                roi=parsed.roi.value,
                training=_training_label(training_used),
            )
        return ChatResponse(
            reply=(
                f"{label} in {roi_str} "
                f"({_training_label(training_used)}-trained, {score_label}): {score:.4f}."
            ),
            intent=parsed.intent.value,
            model_value=parsed.model_value,
            roi=parsed.roi.value,
            training=_training_label(training_used),
        )

    # Model score (overall)
    if parsed.intent == Intent.MODEL_SCORE and parsed.model_value and not parsed.roi:
        label = store.label_for(parsed.model_value)

        def _roi_parts(training: TrainingDataset) -> tuple[float | None, str]:
            s = store.model_overall_score(parsed.model_value, training, score_type=score_type)
            roi_parts = []
            for roi in ROIS:
                rs = store.model_score_for_roi(parsed.model_value, roi, training, score_type=score_type)
                if rs is not None:
                    roi_parts.append(f"{roi.upper()}: {rs:.4f}")
            roi_str = " (" + ", ".join(roi_parts) + ")" if roi_parts else ""
            return s, roi_str

        if parsed.training is None:
            # No training specified — show both NSD and Murty185
            nsd_score, nsd_roi = _roi_parts(TrainingDataset.NSD)
            murty_score, murty_roi = _roi_parts(TrainingDataset.MURTY185)
            lines = []
            if nsd_score is not None:
                lines.append(f"NSD-trained: {nsd_score:.4f}{nsd_roi}")
            if murty_score is not None:
                lines.append(f"Murty185-trained: {murty_score:.4f}{murty_roi}")
            if not lines:
                return ChatResponse(
                    reply=f"No overall score found for {label}.",
                    model_value=parsed.model_value,
                )
            return ChatResponse(
                reply=f"{label} overall {score_label} scores — " + "; ".join(lines) + ".",
                intent=parsed.intent.value,
                model_value=parsed.model_value,
            )

        training_used = parsed.training
        score, roi_str = _roi_parts(training_used)
        if score is None:
            return ChatResponse(
                reply=f"No overall score found for {label} ({_training_label(training_used)}-trained).",
                model_value=parsed.model_value,
                training=_training_label(training_used),
            )
        return ChatResponse(
            reply=(
                f"{label} ({_training_label(training_used)}-trained, {score_label}) overall: {score:.4f}{roi_str}."
            ),
            intent=parsed.intent.value,
            model_value=parsed.model_value,
            training=_training_label(training_used),
        )

    # Best ROI for a given model
    if parsed.intent == Intent.BEST_ROI_FOR_MODEL and parsed.model_value:
        training_used = parsed.training or TrainingDataset.NSD
        label = store.label_for(parsed.model_value)
        best = store.best_roi_for_model(parsed.model_value, training_used, score_type=score_type)
        if not best:
            return ChatResponse(
                reply=(
                    f"No ROI scores found for {label} "
                    f"({_training_label(training_used)}-trained)."
                ),
                model_value=parsed.model_value,
                training=_training_label(training_used),
            )
        best_roi, best_score = best

        parts = []
        for roi in ROIS:
            s = store.model_score_for_roi(parsed.model_value, roi, training_used, score_type=score_type)
            if s is not None:
                parts.append(f"{roi.upper()}: {s:.4f}")
        extra = ""
        if parts:
            extra = " Scores — " + ", ".join(parts) + "."

        return ChatResponse(
            reply=(
                f"{label} performs best in {best_roi.upper()} "
                f"({_training_label(training_used)}-trained, {best_score:.4f})."
                f"{extra}"
            ),
            intent=parsed.intent.value,
            model_value=parsed.model_value,
            roi=best_roi,
            training=_training_label(training_used),
        )

    # Model comparison
    if parsed.intent == Intent.COMPARE_MODELS and parsed.model_value and parsed.compare_model_value:
        training_used = parsed.training or TrainingDataset.NSD
        m1 = parsed.model_value
        m2 = parsed.compare_model_value
        label1 = store.label_for(m1)
        label2 = store.label_for(m2)

        scores: dict[str, tuple[float | None, float | None]] = {}
        for roi in ROIS:
            s1 = store.model_score_for_roi(m1, roi, training_used, score_type=score_type)
            s2 = store.model_score_for_roi(m2, roi, training_used, score_type=score_type)
            scores[roi] = (s1, s2)

        any_data = any(s1 is not None or s2 is not None for s1, s2 in scores.values())
        if not any_data:
            return ChatResponse(
                reply=(
                    f"I couldn't find performance data to compare {label1} and {label2} "
                    f"({_training_label(training_used)}-trained)."
                ),
                intent=parsed.intent.value,
                model_value=m1,
                compare_model_value=m2,
                training=_training_label(training_used),
            )

        better1: list[str] = []
        better2: list[str] = []
        ties: list[str] = []
        margin = 0.005

        parts = []
        for roi, (s1, s2) in scores.items():
            if s1 is None and s2 is None:
                continue
            if s1 is not None and s2 is not None:
                if s1 - s2 > margin:
                    better1.append(roi)
                elif s2 - s1 > margin:
                    better2.append(roi)
                else:
                    ties.append(roi)
                parts.append(
                    f"{roi.upper()}: {label1} {s1:.4f} vs {label2} {s2:.4f}"
                )
            elif s1 is not None:
                parts.append(
                    f"{roi.upper()}: only {label1} has a score ({s1:.4f}); "
                    f"{label2} has no data."
                )
            elif s2 is not None:
                parts.append(
                    f"{roi.upper()}: only {label2} has a score ({s2:.4f}); "
                    f"{label1} has no data."
                )

        summary_bits: list[str] = []
        if better1 and not better2:
            summary_bits.append(
                f"{label1} is consistently better than {label2} "
                f"across {', '.join(r.upper() for r in better1)}"
            )
        elif better2 and not better1:
            summary_bits.append(
                f"{label2} is consistently better than {label1} "
                f"across {', '.join(r.upper() for r in better2)}"
            )
        else:
            if better1:
                summary_bits.append(
                    f"{label1} is better in {', '.join(r.upper() for r in better1)}"
                )
            if better2:
                summary_bits.append(
                    f"{label2} is better in {', '.join(r.upper() for r in better2)}"
                )
            if ties:
                summary_bits.append(
                    f"they are similar in {', '.join(r.upper() for r in ties)}"
                )

        summary = (
            "; ".join(summary_bits)
            if summary_bits
            else "They have similar performance where data is available."
        )
        detail = ""
        if parts:
            detail = " Scores — " + "; ".join(parts) + "."

        return ChatResponse(
            reply=f"{summary} ({_training_label(training_used)}-trained).{detail}",
            intent=parsed.intent.value,
            model_value=m1,
            compare_model_value=m2,
            training=_training_label(training_used),
        )

    # Score meaning / global score explanation
    if parsed.intent == Intent.SCORE_MEANING:
        return ChatResponse(
            reply=(
                "Performance scores are Pearson correlations between model-predicted and actual "
                "fMRI responses (range roughly 0–1; higher is better). The global score used in "
                "the Scoreboard is computed from raw (non-normalized) correlations, first "
                "averaged across PPA, FFA, and EBA per dataset and then averaged across all "
                "evaluation datasets, excluding the training datasets (Murty185 and NSD1000). "
                "Scores above about 0.4 are strong, and differences of 0.01–0.02 are typically "
                "meaningful."
            ),
            intent=parsed.intent.value,
        )

    # Dataset-specific scores
    if parsed.intent == Intent.DATASET_SCORE and parsed.eval_dataset:
        ds_label = store.eval_dataset_label(parsed.eval_dataset)
        trainings = (
            [parsed.training]
            if parsed.training is not None
            else [TrainingDataset.NSD, TrainingDataset.MURTY185]
        )

        # Model + ROI + dataset
        if parsed.model_value and parsed.roi:
            label = store.label_for(parsed.model_value)
            roi_str = parsed.roi.value.upper()
            parts = []
            for tr in trainings:
                s = store.model_score_for_specific_dataset(
                    parsed.model_value, parsed.roi.value, parsed.eval_dataset, tr, score_type
                )
                if s is not None:
                    parts.append(f"{_training_label(tr)}-trained: {s:.4f}")
            if not parts:
                return ChatResponse(
                    reply=f"No score for {label} in {roi_str} on {ds_label}."
                )
            return ChatResponse(
                reply=f"{label} in {roi_str} on {ds_label} ({score_label}): {'; '.join(parts)}.",
                intent=parsed.intent.value,
                model_value=parsed.model_value,
                roi=parsed.roi.value,
                eval_dataset=ds_label,
                training=_training_label(trainings[0]) if len(trainings) == 1 else None,
            )

        # Model + dataset (all ROIs)
        if parsed.model_value:
            label = store.label_for(parsed.model_value)
            lines = []
            for tr in trainings:
                roi_scores = {
                    roi.upper(): store.model_score_for_specific_dataset(
                        parsed.model_value, roi, parsed.eval_dataset, tr, score_type
                    )
                    for roi in ROIS
                }
                roi_scores = {k: v for k, v in roi_scores.items() if v is not None}
                if roi_scores:
                    parts = ", ".join(f"{roi}: {s:.4f}" for roi, s in roi_scores.items())
                    lines.append(f"{_training_label(tr)}-trained: {parts}")
            if not lines:
                return ChatResponse(reply=f"No data for {label} on {ds_label}.")
            return ChatResponse(
                reply=f"{label} on {ds_label} ({score_label}) — {'; '.join(lines)}.",
                intent=parsed.intent.value,
                model_value=parsed.model_value,
                eval_dataset=ds_label,
                training=_training_label(trainings[0]) if len(trainings) == 1 else None,
            )

        # ROI + dataset (best model per training set)
        if parsed.roi:
            roi_str = parsed.roi.value.upper()
            lines = []
            for tr in trainings:
                rows = store.best_worst_for_dataset_roi(
                    parsed.roi.value, parsed.eval_dataset, tr, worst=False, score_type=score_type
                )
                if rows:
                    model_val, score = rows[0]
                    lines.append(
                        f"{_training_label(tr)}-trained: {store.label_for(model_val)} ({score:.4f})"
                    )
            if not lines:
                return ChatResponse(reply=f"No data for {ds_label} + {roi_str}.")
            return ChatResponse(
                reply=f"Best model on {ds_label} for {roi_str} ({score_label}) — {'; '.join(lines)}.",
                intent=parsed.intent.value,
                roi=parsed.roi.value,
                eval_dataset=ds_label,
                training=_training_label(trainings[0]) if len(trainings) == 1 else None,
            )

    # Fallback
    return ChatResponse(
        reply=(
            "I didn't understand that. Try: \"Best model for PPA?\", "
            "\"Worst for FFA?\", \"What is Nomic?\", or "
            "\"How does BLIP2 do in EBA?\"."
        ),
    )
