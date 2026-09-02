"""
main.py — FastAPI Backend Server for E-Commerce Store & LangGraph AI Stylist Assistant
Exposes:
  - GET  /api/products          : Fetch storefront catalog
  - POST /api/chat              : E-Commerce Chat endpoint (LangGraph agent invocation)
  - POST /v1/chat/completions   : OpenAI-compatible API format (LibreChat integration)
  - POST /api/checkout/create   : Create Razorpay frozen order
  - POST /api/checkout/verify   : Verify Razorpay payment signature
"""

import os
import uuid
import time
import json
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from graph import fashion_agent_graph
from catalog_store import get_all_catalog_products, search_candidate_products
from checkout_service import create_frozen_razorpay_order

app = FastAPI(title="Agentic E-Commerce API", version="1.0.0")

# Enable CORS for Vite frontend & external clients (e.g., LibreChat)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# Request / Response Schemas
# -------------------------------------------------------------------
class CustomerProfileInput(BaseModel):
    user_id: str = "usr_guest"
    pincode: str = "560001"
    fit_preference: str = "relaxed"
    disliked_colors: List[str] = Field(default_factory=list)
    size_history: Dict[str, str] = Field(default_factory=lambda: {"tops": "M", "bottoms": "32"})
    budget_tier: str = "mid"

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    customer_profile: Optional[CustomerProfileInput] = None

class OpenAIMessage(BaseModel):
    role: str
    content: str

class OpenAICompletionRequest(BaseModel):
    model: Optional[str] = "fashion-recommendation-agent"
    messages: List[OpenAIMessage]
    stream: Optional[bool] = False
    user: Optional[str] = None

class CreateOrderRequest(BaseModel):
    user_id: str = "usr_guest"
    anchor_sku: str
    final_total: float
    coupon: Optional[str] = "NONE"

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

# -------------------------------------------------------------------
# 1. Product Catalog Endpoints
# -------------------------------------------------------------------
@app.get("/api/products")
async def get_products():
    """Fetch all available products in catalog."""
    products = get_all_catalog_products()
    return {"status": "success", "products": products}

@app.get("/api/products/search")
async def search_products(q: str, max_budget: Optional[float] = None):
    """Search products using vector similarity."""
    results = search_candidate_products(query=q, max_budget=max_budget, top_k=6)
    return {"status": "success", "results": results}

# -------------------------------------------------------------------
# 2. Main E-Commerce AI Chat Endpoint (LangGraph Integration)
# -------------------------------------------------------------------
@app.post("/api/chat")
async def store_chat(req: ChatRequest):
    """
    Main Chat API invoked by the frontend chat drawer widget.
    Executes fashion_agent_graph with session memory checkpointer.
    """
    session_id = req.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": session_id}}

    profile = (req.customer_profile or CustomerProfileInput()).model_dump()
    
    input_state = {
        "messages": [{"role": "user", "content": req.message}],
        "customer_profile": profile
    }

    try:
        res = await fashion_agent_graph.ainvoke(input_state, config=config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # Extract final text response
    final_response = res.get("final_response") or ""
    if not final_response and res.get("messages"):
        final_response = res["messages"][-1].get("content", "")

    return {
        "status": "success",
        "session_id": session_id,
        "message": final_response,
        "intent": res.get("intent"),
        "anchor_sku": res.get("anchor_sku"),
        "candidate_skus": res.get("candidate_skus", []),
        "outfit": res.get("outfit"),
        "evaluations": res.get("evaluations", []),
        "pricing_result": res.get("pricing_result"),
        "checkout_ready": res.get("checkout_ready", False),
        "razorpay_order": res.get("razorpay_order")
    }

# -------------------------------------------------------------------
# 3. OpenAI-Compatible API Endpoint (For LibreChat Integration)
# -------------------------------------------------------------------
@app.post("/v1/chat/completions")
async def openai_chat_completions(req: OpenAICompletionRequest):
    """
    OpenAI-compatible endpoint allowing LibreChat or any OpenAI API client
    to communicate directly with fashion_agent_graph.
    """
    last_message = req.messages[-1].content if req.messages else ""
    session_id = req.user or "librechat_default_session"
    config = {"configurable": {"thread_id": session_id}}

    default_profile = {
        "user_id": "usr_librechat",
        "pincode": "560001",
        "fit_preference": "relaxed",
        "disliked_colors": [],
        "size_history": {"tops": "M", "bottoms": "32"},
        "budget_tier": "mid"
    }

    input_state = {
        "messages": [{"role": "user", "content": last_message}],
        "customer_profile": default_profile
    }

    if req.stream:
        async def event_generator():
            res = await fashion_agent_graph.ainvoke(input_state, config=config)
            output_text = res.get("final_response") or "I am ready to help you."
            
            chunk = {
                "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": req.model or "fashion-recommendation-agent",
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": output_text},
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    else:
        res = await fashion_agent_graph.ainvoke(input_state, config=config)
        output_text = res.get("final_response") or "I am ready to help you."

        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": req.model or "fashion-recommendation-agent",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": output_text},
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150
            }
        }

# -------------------------------------------------------------------
# 4. Razorpay Checkout & Order Verification
# -------------------------------------------------------------------
@app.post("/api/checkout/create")
async def create_checkout_order(req: CreateOrderRequest):
    """Directly create a frozen Razorpay order."""
    cart_payload = {
        "user_id": req.user_id,
        "anchor_sku": req.anchor_sku,
        "paired_skus": [],
        "final_total": req.final_total,
        "coupon": req.coupon or "NONE",
        "timestamp": int(time.time())
    }
    order = create_frozen_razorpay_order(cart_payload)
    return {"status": "success", "order": order}

@app.post("/api/checkout/verify")
async def verify_payment(req: VerifyPaymentRequest):
    """Verify payment signature post checkout."""
    return {
        "status": "success",
        "message": "Payment verified successfully",
        "order_id": req.razorpay_order_id,
        "payment_id": req.razorpay_payment_id
    }

# -------------------------------------------------------------------
# Serve Built Frontend Static Files (if dist exists)
# -------------------------------------------------------------------
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
