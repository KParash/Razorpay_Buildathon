from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from schema import AgentState
from nodes import (
    master_router_node,
    clarifier_node,
    retriever_node,
    worker_swarm_node,
    pricing_node,
    synthesis_node,
    razorpay_checkout_node
)

# 1. Initialize StateGraph
builder = StateGraph(AgentState)

# 2. Add Nodes
builder.add_node("router", master_router_node)
builder.add_node("clarifier", clarifier_node)
builder.add_node("retriever", retriever_node)
builder.add_node("worker_swarm", worker_swarm_node)
builder.add_node("pricing", pricing_node)
builder.add_node("synthesis", synthesis_node)
builder.add_node("checkout", razorpay_checkout_node)

# 3. Routing Edge Conditions
def route_after_input(state: AgentState) -> str:
    intent = state["intent"]
    # Only allow checkout if evaluations exist (i.e., a recommendation was made)
    if intent.get("is_checkout_requested") and state.get("evaluations"):
        return "checkout"
    if intent.get("is_ready_to_recommend"):
        return "retriever"
    return "clarifier"

# 4. Connect Graph Topology
builder.add_edge(START, "router")

builder.add_conditional_edges(
    "router",
    route_after_input,
    {
        "checkout": "checkout",
        "retriever": "retriever",
        "clarifier": "clarifier"
    }
)

builder.add_edge("clarifier", END)
builder.add_edge("retriever", "worker_swarm")
builder.add_edge("worker_swarm", "pricing")
builder.add_edge("pricing", "synthesis")
builder.add_edge("synthesis", END)
builder.add_edge("checkout", END)

# 5. Compile Runnable Graph with Memory (multi-turn state persistence)
memory = MemorySaver()
fashion_agent_graph = builder.compile(checkpointer=memory)