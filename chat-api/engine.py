"""Rule-based chat: load performance data and model metadata, parse queries, return answers."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz
from rapidfuzz.process import extractOne

from schemas import Intent, ROI, ScoreType, TrainingDataset

# Paths relative to repo root (run server from repo root or set CORTEX_ROOT)
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "assets" / "data" / "new"
MODELS_META_PATH = REPO_ROOT / "cortex-web-app" / "public" / "assets" / "data" / "models_metadata.json"

# Scoreboard-style aggregation:
# - Compute a per-model "global_score" as the mean over all *available* datasets
#   excluding the training datasets shown in the UI ("murty185" and "nsd_1000").
# - Compute "overall" as the mean across ROIs (PPA/FFA/EBA) and datasets.
#
# This mirrors the logic in `assets/js/Scoreboard/Visualizations/heatmapDetail.jsx`.
EXCLUDED_DATASETS = {"murty185", "nsd_1000"}
ROIS = ["ppa", "ffa", "eba"]
ROI_ALIASES = {"ppa": ["ppa", "parahippocampal", "place"], "ffa": ["ffa", "fusiform", "face"], "eba": ["eba", "extrastriate", "body"]}

# Canonical evaluation dataset keys and their user-facing aliases
EVAL_DATASET_ALIASES: dict[str, list[str]] = {
    "bold_5000": ["bold5000", "bold_5000", "bold 5000", "bold-5000"],
    "bonner_2021": ["bonner2021", "bonner_2021", "bonner 2021", "bonner"],
    "bmd_2024": ["bmd2024", "bmd_2024", "bmd 2024", "bmd"],
    "kingbaker_2019": ["kingbaker2019", "kingbaker_2019", "king2019", "king 2019", "kingbaker", "king baker"],
    "wardle_2020": ["wardle2020", "wardle_2020", "wardle 2020", "wardle"],
    "nsd_syn": ["nsd_syn", "nsd syn", "nsd_synthetic", "nsd synthetic", "nsdsyn"],
}
EVAL_DATASET_LABELS: dict[str, str] = {
    "bold_5000": "BOLD5000",
    "bonner_2021": "Bonner2021",
    "bmd_2024": "BMD2024",
    "kingbaker_2019": "KingBaker2019",
    "wardle_2020": "Wardle2020",
    "nsd_syn": "NSD Synthetic",
}


def _load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _score_key(entry: list) -> float:
    """First element is raw score."""
    if not entry or not isinstance(entry, list):
        return float("-inf")
    try:
        return float(entry[0])
    except (TypeError, ValueError):
        return float("-inf")


class DataStore:
    """Holds model metadata and performance data."""

    def __init__(self) -> None:
        self.models_meta: list[dict] = []
        self.nsd_uni: dict = {}
        self.murty_uni: dict = {}
        self.nsd_multi: dict = {}
        self.murty_multi: dict = {}
        self._model_value_to_meta: dict[str, dict] = {}
        self._model_labels: list[str] = []
        self._model_values: list[str] = []

    def load(self) -> None:
        if MODELS_META_PATH.exists():
            self.models_meta = _load_json(MODELS_META_PATH)
        else:
            self.models_meta = []
        self._model_value_to_meta = {m["value"]: m for m in self.models_meta}
        self._model_values = list(self._model_value_to_meta.keys())
        self._model_labels = [m["label"] for m in self.models_meta]

        for attr, filename in [
            ("nsd_uni",   "standardized_results_nsd_1000_models_univariate.json"),
            ("murty_uni", "standardized_results_murty185_models_univariate.json"),
            ("nsd_multi",   "standardized_results_nsd_1000_models_multivariate.json"),
            ("murty_multi", "standardized_results_murty185_models_multivariate.json"),
        ]:
            p = DATA_DIR / filename
            if p.exists():
                setattr(self, attr, _load_json(p))

    def _data(self, training: TrainingDataset, score_type: ScoreType | None) -> dict:
        """Select the right data dict based on training set and score type."""
        multi = score_type == ScoreType.MULTIVARIATE
        if training == TrainingDataset.MURTY185:
            return self.murty_multi if multi else self.murty_uni
        return self.nsd_multi if multi else self.nsd_uni

    def fuzzy_model(self, text: str) -> str | None:
        """Return best-matching model value (handles spelling/caps), or None."""
        text = text.strip().lower()
        if not text or not self._model_values:
            return None
        # Exact value match first (highest priority)
        for v in self._model_values:
            if v == text:
                return v
        # Match by label exact (e.g. "blip2" label)
        clean = text.replace(" ", "").replace("-", "_").replace(".", "")
        for v in self._model_values:
            if clean == v:
                return v
        # Substring match: text contains model value (e.g. "clip_rn50_model" -> "clip_rn50")
        # Use longest match to avoid "siglip" matching before "siglip2"
        substring_matches = [v for v in self._model_values if v in text]
        if substring_matches:
            return max(substring_matches, key=len)
        # Substring match: model value contains text
        value_contains = [v for v in self._model_values if text in v]
        if value_contains:
            return min(value_contains, key=len)  # prefer shortest (most specific)
        # Match by label substring
        for v in self._model_values:
            if clean in v:
                return v
        # Fuzzy match on value
        match = extractOne(text, self._model_values, scorer=fuzz.ratio, score_cutoff=60)
        if match:
            return match[0]
        # Fuzzy match on label
        match = extractOne(text, self._model_labels, scorer=fuzz.ratio, score_cutoff=55)
        if match:
            idx = self._model_labels.index(match[0])
            return self._model_values[idx]
        return None

    def fuzzy_roi(self, text: str) -> ROI | None:
        """Return matching ROI from normalized text."""
        text = text.strip().lower()
        for roi in ROI:
            if roi.value in text:
                return roi
        for roi_name, aliases in ROI_ALIASES.items():
            for a in aliases:
                if a in text:
                    return ROI(roi_name)
        return None

    def detect_training(self, text: str) -> TrainingDataset | None:
        text = text.strip().lower()
        if "murty" in text or "murty185" in text:
            return TrainingDataset.MURTY185
        if "nsd" in text or "nsd1000" in text or "nsd_1000" in text:
            return TrainingDataset.NSD
        return None

    def detect_eval_dataset(self, text: str) -> str | None:
        """Return canonical eval dataset key from user text, or None."""
        text_lower = text.strip().lower()
        for ds_key, aliases in EVAL_DATASET_ALIASES.items():
            for alias in aliases:
                if alias in text_lower:
                    return ds_key
        return None

    def eval_dataset_label(self, ds_key: str) -> str:
        return EVAL_DATASET_LABELS.get(ds_key, ds_key)

    def model_score_for_specific_dataset(self, model_value: str, roi: str, dataset: str, training: TrainingDataset, score_type: ScoreType | None = None) -> float | None:
        """Score for (model, roi, dataset, training) — raw entry[0]."""
        data = self._data(training, score_type)
        entry = (data.get(roi) or {}).get(model_value, {}).get(dataset)
        if not entry:
            return None
        return _score_key(entry)

    def all_dataset_scores_for_model_roi(self, model_value: str, roi: str, training: TrainingDataset, score_type: ScoreType | None = None) -> dict[str, float]:
        """Return {dataset_key: score} for all eval datasets (excluding training set)."""
        data = self._data(training, score_type)
        model_data = (data.get(roi) or {}).get(model_value, {})
        result = {}
        for ds, entry in model_data.items():
            if ds in EXCLUDED_DATASETS:
                continue
            s = _score_key(entry)
            if s != float("-inf"):
                result[ds] = s
        return result

    def best_worst_for_dataset_roi(self, roi: str, dataset: str, training: TrainingDataset, worst: bool = False, score_type: ScoreType | None = None) -> list[tuple[str, float]]:
        """Best/worst models for a specific eval dataset + roi."""
        data = self._data(training, score_type)
        roi_data = data.get(roi) or {}
        results = []
        for model, model_data in roi_data.items():
            if model == "ceiling":
                continue
            entry = model_data.get(dataset)
            if not entry:
                continue
            s = _score_key(entry)
            if s != float("-inf"):
                results.append((model, s))
        results.sort(key=lambda x: x[1], reverse=not worst)
        return results

    def roi_global_score(self, data: dict, roi: str, model: str) -> float | None:
        """Mean score across datasets for (roi, model), excluding training datasets."""
        roi_data = data.get(roi) or {}
        model_data = roi_data.get(model) or {}
        scores: list[float] = []
        for ds, entry in model_data.items():
            if ds in EXCLUDED_DATASETS:
                continue
            s = _score_key(entry)
            if s != float("-inf"):
                scores.append(s)
        if not scores:
            return None
        return sum(scores) / len(scores)

    def overall_global_score(self, data: dict, model: str) -> float | None:
        """
        Mean score across ROIs and datasets, mirroring the frontend's:
        - addOverall() (average across ROIs per dataset)
        - then global_score (average across datasets, excluding training datasets)
        """
        per_dataset_sum: dict[str, float] = {}
        per_dataset_count: dict[str, int] = {}
        for roi in ROIS:
            roi_data = data.get(roi) or {}
            model_data = roi_data.get(model) or {}
            for ds, entry in model_data.items():
                if ds in EXCLUDED_DATASETS:
                    continue
                s = _score_key(entry)
                if s == float("-inf"):
                    continue
                per_dataset_sum[ds] = per_dataset_sum.get(ds, 0.0) + s
                per_dataset_count[ds] = per_dataset_count.get(ds, 0) + 1

        dataset_means: list[float] = []
        for ds, total in per_dataset_sum.items():
            c = per_dataset_count.get(ds, 0)
            if c > 0:
                dataset_means.append(total / c)
        if not dataset_means:
            return None
        return sum(dataset_means) / len(dataset_means)

    def best_worst_for_roi(self, roi: str, training: TrainingDataset, worst: bool = False, score_type: ScoreType | None = None) -> list[tuple[str, float]]:
        """List of (model_value, avg_score) sorted by score (best or worst first)."""
        data = self._data(training, score_type)
        roi_data = data.get(roi) or {}
        results = []
        for model in roi_data:
            if model == "ceiling":
                continue
            score = self.roi_global_score(data, roi, model)
            if score is not None:
                results.append((model, score))
        results.sort(key=lambda x: x[1], reverse=not worst)
        return results

    def model_info(self, model_value: str) -> dict | None:
        return self._model_value_to_meta.get(model_value)

    def model_score_for_roi(self, model_value: str, roi: str, training: TrainingDataset, score_type: ScoreType | None = None) -> float | None:
        data = self._data(training, score_type)
        return self.roi_global_score(data, roi, model_value)

    def best_worst_overall(self, training: TrainingDataset, worst: bool = False, score_type: ScoreType | None = None) -> list[tuple[str, float]]:
        """Best or worst models overall (scoreboard-style global score)."""
        data = self._data(training, score_type)
        results = []
        seen = set()
        for roi in ROIS:
            roi_data = data.get(roi) or {}
            for model in roi_data:
                if model == "ceiling" or model in seen:
                    continue
                seen.add(model)
                score = self.overall_global_score(data, model)
                if score is not None:
                    results.append((model, score))
        results.sort(key=lambda x: x[1], reverse=not worst)
        return results

    def label_for(self, model_value: str) -> str:
        m = self._model_value_to_meta.get(model_value)
        return m["label"] if m else model_value

    def model_overall_score(self, model_value: str, training: TrainingDataset, score_type: ScoreType | None = None) -> float | None:
        """Scoreboard-style global score for a model across PPA/FFA/EBA and datasets."""
        data = self._data(training, score_type)
        return self.overall_global_score(data, model_value)

    def best_roi_for_model(self, model_value: str, training: TrainingDataset, score_type: ScoreType | None = None) -> tuple[str, float] | None:
        """Return (roi, score) where the model performs best across ROIs."""
        data = self._data(training, score_type)
        best_roi: str | None = None
        best_score = float("-inf")
        for roi in ROIS:
            score = self.roi_global_score(data, roi, model_value)
            if score is not None and score > best_score:
                best_score = score
                best_roi = roi
        if best_roi is None or best_score == float("-inf"):
            return None
        return best_roi, best_score
