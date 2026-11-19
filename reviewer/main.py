
import os
import secrets
import logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

from graph import reviewer_graph


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TaskHive AI Reviewer",
    version="1.0.0"
)


class ReviewRequest(BaseModel):

    task_id: int
    deliverable_id: int

    task_title: str = Field(min_length=1)
    task_description: str = Field(min_length=1)

    category: str | None = None

    submission: str = Field(
        min_length=1,
        max_length=50000
    )


def verify_service_token(authorization: str | None):

    expected = os.getenv("REVIEWER_SERVICE_TOKEN")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Reviewer service token is not configured"
        )

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization"
        )

    scheme, _, provided = authorization.partition(" ")

    if (
        scheme.lower() != "bearer"
        or not provided
        or not secrets.compare_digest(provided, expected)
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid service token"
        )


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "taskhive-reviewer"
    }


@app.post("/review")
def review_submission(
    request: ReviewRequest,
    authorization: str | None = Header(default=None)
):

    verify_service_token(authorization)

    try:

        result = reviewer_graph.invoke(
            request.model_dump()
        )

        return {
            "ok": True,
            "review": result["review"]
        }

    except Exception:
        logger.exception("AI review execution failed")

        raise HTTPException(
            status_code=502,
            detail="AI review could not be completed"
        )
