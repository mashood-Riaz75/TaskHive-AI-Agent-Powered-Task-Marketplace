
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


# 1. Define shared graph state
class State(TypedDict):
    message: str


# 2. Define first node
def greeting_node(state: State):
    print("Executing greeting node...")
    return {"message": state["message"] + " Hello!"}


# 3. Define second node
def response_node(state: State):
    print("Executing response node...")
    return {"message": state["message"] + " LangGraph is working!"}


# 4. Build graph
builder = StateGraph(State)

builder.add_node("greeting", greeting_node)
builder.add_node("response", response_node)

builder.add_edge(START, "greeting")
builder.add_edge("greeting", "response")
builder.add_edge("response", END)


# 5. Compile graph
graph = builder.compile()


# 6. Execute graph
result = graph.invoke({"message": "TaskHive:"})

print("\nFinal result:")
print(result)
