
from langgraph.graph import StateGraph, START, END

from state import ReviewState

from nodes import (
    prepare_review,
    generate_review,
    validate_review
)


# Create graph
builder = StateGraph(ReviewState)


# Register nodes
builder.add_node(
    "prepare_review",
    prepare_review
)

builder.add_node(
    "generate_review",
    generate_review
)

builder.add_node(
    "validate_review",
    validate_review
)


# Define execution flow
builder.add_edge(
    START,
    "prepare_review"
)

builder.add_edge(
    "prepare_review",
    "generate_review"
)

builder.add_edge(
    "generate_review",
    "validate_review"
)

builder.add_edge(
    "validate_review",
    END
)


# Compile graph
reviewer_graph = builder.compile()
