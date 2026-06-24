"""Import all models so ``Base.metadata`` is fully populated for Alembic autogenerate
and for ``create_all`` in the test suite."""

from app.models.ocr import OcrResult, OcrTask
from app.models.psychology import (
    PsychologyAssessmentResult,
    PsychologyAssessmentTask,
)
from app.models.video import VideoAnalysisResult, VideoAnalysisTask

__all__ = [
    "VideoAnalysisTask",
    "VideoAnalysisResult",
    "PsychologyAssessmentTask",
    "PsychologyAssessmentResult",
    "OcrTask",
    "OcrResult",
]
