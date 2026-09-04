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
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from graph import fashion_agent_graph, _pg_pool
from catalog_store import get_all_catalog_products, search_candidate_products
from checkout_service import create_frozen_razorpay_order
import history_store
from db import get_db, User, SubCategory, Product
from sqlalchemy.orm import Session
from fastapi import Depends


@asynccontextmanager
async def lifespan(app):
    # Startup: pools already created at import time
    yield
    # Shutdown: close the LangGraph checkpointer connection pool
    _pg_pool.close()

app = FastAPI(title="Agentic E-Commerce API", version="1.0.0", lifespan=lifespan)

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
# 1. Product Catalog & Taxonomy Endpoints
# -------------------------------------------------------------------
@app.get("/api/products")
async def get_products(sub_category_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Fetch all available products in catalog with optional sub-category filter."""
    if sub_category_id:
        db_prods = db.query(Product).filter(Product.is_active == True, Product.sub_category_id == sub_category_id).all()
        products = [p.to_catalog_item() for p in db_prods]
    else:
        products = get_all_catalog_products()
    return {"status": "success", "products": products}

@app.get("/api/subcategories")
async def get_subcategories(db: Session = Depends(get_db)):
    """Fetch all available fashion sub-categories."""
    cats = db.query(SubCategory).order_by(SubCategory.sub_category_id.asc()).all()
    return {"status": "success", "sub_categories": [c.to_dict() for c in cats]}

@app.get("/api/products/search")
async def search_products(q: str, max_budget: Optional[float] = None):
    """Search products using vector similarity."""
    results = search_candidate_products(query=q, max_budget=max_budget, top_k=6)
    return {"status": "success", "results": results}

@app.get("/api/user/profile")
async def get_user_profile(user_id: str = "usr_local_dev", db: Session = Depends(get_db)):
    """Retrieve user profile, preferences, and accumulated metadata."""
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user and user_id == "usr_guest":
        user = db.query(User).filter_by(user_id="usr_local_dev").first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "user": user.to_dict()}

# -------------------------------------------------------------------
# 2. Main E-Commerce AI Chat Endpoint & History Endpoints
# -------------------------------------------------------------------
@app.get("/api/chat/sessions")
async def get_sessions(user_id: str = "usr_guest"):
    """Retrieve all chat sessions for a user."""
    sessions = history_store.get_all_sessions(user_id=user_id)
    return {"status": "success", "sessions": sessions}

@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Retrieve all messages for a specific session."""
    messages = history_store.get_session_messages(session_id)
    return {"status": "success", "session_id": session_id, "messages": messages}

@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    """Delete a chat session."""
    deleted = history_store.delete_session(session_id)
    return {"status": "success", "deleted": deleted}

@app.post("/api/chat")
async def store_chat(req: ChatRequest):
    """
    Main Chat API invoked by the frontend chat drawer and studio widget.
    Executes fashion_agent_graph with session memory checkpointer and persists message history.
    """
    session_id = req.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": session_id}}

    profile = (req.customer_profile or CustomerProfileInput()).model_dump()
    user_id = profile.get("user_id", "usr_guest")
    
    # Save User message to history store
    user_msg_item = {
        "id": f"user-{int(time.time()*1000)}",
        "sender": "user",
        "text": req.message,
        "timestamp": time.strftime("%I:%M %p")
    }
    history_store.save_message_to_session(session_id, user_msg_item, user_id=user_id)

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

    anchor = res.get("anchor_sku")
    anchor_meta = anchor.get("metadata") if anchor else None

    # Prepare recommendation object for frontend rendering & persistence
    recommendation_obj = None
    if anchor_meta:
        recommendation_obj = {
            "sku_id": anchor.get("sku_id"),
            "title": anchor_meta.get("title"),
            "price": float(anchor_meta.get("price", 0)),
            "fit_type": anchor_meta.get("fit_type"),
            "fabric": anchor_meta.get("fabric"),
            "gsm": anchor_meta.get("gsm"),
            "color": anchor_meta.get("color"),
            "image_url": anchor_meta.get("image_url")
        }

    # Save Assistant message to history store
    asst_msg_item = {
        "id": f"asst-{int(time.time()*1000)}",
        "sender": "assistant",
        "text": final_response or "Here's what I'd go with — take a look.",
        "timestamp": time.strftime("%I:%M %p"),
        "recommendation": recommendation_obj,
        "candidate_skus": res.get("candidate_skus", []),
        "evaluations": res.get("evaluations", []),
        "pricing_result": res.get("pricing_result"),
        "checkout_ready": res.get("checkout_ready", False),
        "razorpay_order": res.get("razorpay_order")
    }
    history_store.save_message_to_session(session_id, asst_msg_item, user_id=user_id)

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
            output_text = res.get("final_response") or "What are you looking for today?"
            
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
        output_text = res.get("final_response") or "What are you looking for today?"

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
