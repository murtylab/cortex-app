"""Rule-based chat: load performance data and model metadata, parse queries, return answers."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz
from rapidfuzz.process import extractOne

from schemas import Intent, ROI, TrainingDataset

# Paths relative to repo root (run server from repo root or set CORTEX_ROOT)
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "assets" / "data" / "new"
MODELS_META_PATH = REPO_ROOT / "cortex-web-app" / "public" / "assets" / "data" / "models_metadata.json"

# Evaluation datasets only (exclude training set when aggregating)
EVAL_DATASETS_NSD = {"bold_5000", "bonner_2021", "bmd_2024", "kingbaker_2019", "wardle_2020", "nsd_syn"}
EVAL_DATASETS_MURTY = {"nsd_1000", "bold_5000", "bonner_2021", "bmd_2024", "kingbaker_2019", "wardle_2020", "nsd_syn"}
ROIS = ["ppa", "ffa", "eba"]
ROI_ALIASES = {"ppa": ["ppa", "parahippocampal", "place"], "ffa": ["ffa", "fusiform", "face"], "eba": ["eba", "extrastriate", "body"]}


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

        nsd_path = DATA_DIR / "standardized_results_nsd_1000_models_univariate.json"
        murty_path = DATA_DIR / "standardized_results_murty185_models_univariate.json"
        if nsd_path.exists():
            self.nsd_uni = _load_json(nsd_path)
        if murty_path.exists():
            self.murty_uni = _load_json(murty_path)

    def fuzzy_model(self, text: str) -> str | None:
        """Return best-matching model value (handles spelling/caps), or None."""
        text = text.strip().lower()
        if not text or not self._model_values:
            return None
        # Try exact value match first
        for v in self._model_values:
            if v == text or text in v or v in text:
                return v
        # Match by label (e.g. "blip2" -> blip2, "BLIP 2" -> blip2)
        clean = text.replace(" ", "").replace("-", "_").replace(".", "")
        for v in self._model_values:
            if clean == v or clean in v:
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

    def roi_avg(self, data: dict, roi: str, model: str, training: TrainingDataset) -> float | None:
        """Average raw score for one model in one ROI over evaluation datasets only."""
        eval_set = EVAL_DATASETS_MURTY if training == TrainingDataset.MURTY185 else EVAL_DATASETS_NSD
        roi_data = data.get(roi) or {}
        model_data = roi_data.get(model) or {}
        scores = []
        for ds in eval_set:
            entry = model_data.get(ds)
            if entry is not None:
                s = _score_key(entry)
                if s != float("-inf"):
                    scores.append(s)
        if not scores:
            return None
        return sum(scores) / len(scores)

    def best_worst_for_roi(self, roi: str, training: TrainingDataset, worst: bool = False) -> list[tuple[str, float]]:
        """List of (model_value, avg_score) sorted by score (best or worst first)."""
        data = self.murty_uni if training == TrainingDataset.MURTY185 else self.nsd_uni
        roi_data = data.get(roi) or {}
        results = []
        for model in roi_data:
            if model == "ceiling":
                continue
            avg = self.roi_avg(data, roi, model, training)
            if avg is not None:
                results.append((model, avg))
        results.sort(key=lambda x: x[1], reverse=not worst)
        return results

    def model_info(self, model_value: str) -> dict | None:
        return self._model_value_to_meta.get(model_value)

    def model_score_for_roi(self, model_value: str, roi: str, training: TrainingDataset) -> float | None:
        data = self.murty_uni if training == TrainingDataset.MURTY185 else self.nsd_uni
        return self.roi_avg(data, roi, model_value, training)

    def overall_avg(self, data: dict, model: str, training: TrainingDataset) -> float | None:
        """Average across PPA, FFA, EBA (eval datasets only)."""
        totals = []
        for roi in ROIS:
            avg = self.roi_avg(data, roi, model, training)
            if avg is not None:
                totals.append(avg)
        if not totals:
            return None
        return sum(totals) / len(totals)

    def best_worst_overall(self, training: TrainingDataset, worst: bool = False) -> list[tuple[str, float]]:
        """Best or worst models overall (avg across ROIs and eval datasets)."""
        data = self.murty_uni if training == TrainingDataset.MURTY185 else self.nsd_uni
        results = []
        seen = set()
        for roi in ROIS:
            roi_data = data.get(roi) or {}
            for model in roi_data:
                if model == "ceiling" or model in seen:
                    continue
                seen.add(model)
                avg = self.overall_avg(data, model, training)
                if avg is not None:
                    results.append((model, avg))
        results.sort(key=lambda x: x[1], reverse=not worst)
        return results

    def label_for(self, model_value: str) -> str:
        m = self._model_value_to_meta.get(model_value)
        return m["label"] if m else model_value
