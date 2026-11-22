
from typing import Literal

from pydantic import BaseModel, Field


class CriterionReview(BaseModel):
    criterion: str = Field(
        description="The requirement or quality criterion being evaluated"
    )

    score: int = Field(
        ge=1,
        le=5,
        description="Score from 1 to 5"
    )

    explanation: str = Field(
        description="Evidence-based explanation for this score"
    )


class ReviewResult(BaseModel):

    overall_score: int = Field(
        ge=1,
        le=5,
        description="Overall submission score from 1 to 5"
    )

    recommendation: Literal[
        "approve",
        "request_changes",
        "manual_review"
    ]

    summary: str

    strengths: list[str]

    issues: list[str]

    criteria: list[CriterionReview]
