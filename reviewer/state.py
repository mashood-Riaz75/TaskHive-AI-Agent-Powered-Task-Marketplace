
from typing import Any
from typing_extensions import NotRequired, TypedDict


class ReviewState(TypedDict):

    # Original TaskHive information
    task_id: int
    deliverable_id: int

    task_title: str
    task_description: str
    category: str | None

    # Submitted work
    submission: str

    # Internal workflow data
    review_context: NotRequired[str]

    # Final structured review
    review: NotRequired[dict[str, Any]]
