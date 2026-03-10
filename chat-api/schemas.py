"""Pydantic schemas for rule-based chat API."""
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Intent(str, Enum):
    BEST_MODEL = "best_model"
    WORST_MODEL = "worst_model"
    MODEL_INFO = "model_info"
    MODEL_SCORE = "model_score"
    DATASET_SCORE = "dataset_score"
    BEST_ROI_FOR_MODEL = "best_roi_for_model"
    COMPARE_MODELS = "compare_models"
    SCORE_MEANING = "score_meaning"
    GREETING = "greeting"
    HELP = "help"
    UNKNOWN = "unknown"


class TrainingDataset(str, Enum):
    NSD = "nsd"
    MURTY185 = "murty185"


class ScoreType(str, Enum):
    UNIVARIATE = "univariate"
    MULTIVARIATE = "multivariate"


class ROI(str, Enum):
    PPA = "ppa"
    FFA = "ffa"
    EBA = "eba"


class ParsedQuery(BaseModel):
    """Structured parse of the user message."""
    intent: Intent = Intent.UNKNOWN
    roi: Optional[ROI] = None
    training: Optional[TrainingDataset] = None
    score_type: Optional[ScoreType] = None
    model_value: Optional[str] = None
    compare_model_value: Optional[str] = None
    eval_dataset: Optional[str] = None
    normalized_raw: str = ""


class ModelMeta(BaseModel):
    """Model card / metadata entry."""
    value: str
    label: str
    type: str
    cardUrl: str = ""


class ChatRequest(BaseModel):
    """Incoming chat message."""
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    """Reply and optional structured data."""
    reply: str
    intent: Optional[str] = None
    model_value: Optional[str] = None
    compare_model_value: Optional[str] = None
    roi: Optional[str] = None
    training: Optional[str] = None
    eval_dataset: Optional[str] = None
