
import os
from functools import lru_cache

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from schemas import ReviewResult
from prompts import SYSTEM_PROMPT, build_review_prompt
from state import ReviewState


@lru_cache(maxsize=1)
def get_reviewer_model():

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing")

    model = ChatGroq(
        model=os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-20b"
        ),
        temperature=0,
        api_key=api_key
    )

    return model.with_structured_output(
        ReviewResult,
        method="json_schema",
        strict=True
    )


# NODE 1: Prepare context
def prepare_review(state: ReviewState):

    context = build_review_prompt(
        task_title=state["task_title"],
        task_description=state["task_description"],
        category=state["category"],
        submission=state["submission"]
    )

    return {
        "review_context": context
    }


# NODE 2: Generate AI review
def generate_review(state: ReviewState):

    model = get_reviewer_model()

    result = model.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=state["review_context"])
    ])

    return {
        "review": result.model_dump(mode="json")
    }


# NODE 3: Validate final review
def validate_review(state: ReviewState):

    validated = ReviewResult.model_validate(
        state["review"]
    )

    return {
        "review": validated.model_dump(mode="json")
    }
