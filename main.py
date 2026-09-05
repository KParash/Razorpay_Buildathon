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

from graph import fashion_agent_graph, _pg_conn
from catalog_store import get_all_catalog_products, search_candidate_products
from checkout_service import create_frozen_razorpay_order, verify_razorpay_payment_signature
import history_store
from db import get_db, User, SubCategory, Product, Order, CartItem
from sqlalchemy.orm import Session
from fastapi import Depends


@asynccontextmanager
async def lifespan(app):
    # Startup: pools already created at import time
    yield
    # Shutdown: close the LangGraph checkpointer connection
    _pg_conn.close()

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
    stream: Optional[bool] = False

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

class AddCartItemRequest(BaseModel):
    user_id: str = "usr_guest"
    product_id: str
    quantity: Optional[int] = 1
    size: Optional[str] = "L"

class RemoveCartItemRequest(BaseModel):
    user_id: str = "usr_guest"
    product_id: str
    size: Optional[str] = "L"

class ClearCartRequest(BaseModel):
    user_id: str = "usr_guest"

class SaveSearchRequest(BaseModel):
    user_id: str = "usr_guest"
    query: str



# -------------------------------------------------------------------
# 1. Product Catalog & Taxonomy Endpoints
# -------------------------------------------------------------------
@app.get("/api/products")
async def get_products(
    sub_category_id: Optional[int] = None,
    segment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Fetch all available products in catalog with optional sub-category or segment filter."""
    query = db.query(Product).filter(Product.is_active == True)
    if sub_category_id:
        query = query.filter(Product.sub_category_id == sub_category_id)
    if segment and segment.lower() != "all":
        query = query.filter(Product.segment == segment.title())
    
    if sub_category_id or segment:
        from sqlalchemy.orm import joinedload
        db_prods = query.options(joinedload(Product.sub_category)).all()
        products = [p.to_catalog_item() for p in db_prods]
    else:
        products = get_all_catalog_products()
    
    return {"status": "success", "products": products, "count": len(products)}

@app.get("/api/subcategories")
async def get_subcategories(db: Session = Depends(get_db)):
    """Fetch all available fashion sub-categories."""
    cats = db.query(SubCategory).order_by(SubCategory.sub_category_id.asc()).all()
    return {"status": "success", "sub_categories": [c.to_dict() for c in cats]}

@app.get("/api/products/search")
async def search_products(q: str, max_budget: Optional[float] = None, segment: Optional[str] = None):
    """Search products using Postgres-backed ranking with optional segment filter."""
    results = search_candidate_products(query=q, max_budget=max_budget, segment=segment, top_k=8)
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
    Supports SSE streaming (req.stream=True) emitting live agent thinking steps and full payload.
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

    if req.stream:
        async def chat_event_stream():
            node_labels = {
                "router": "Deciphering occasion, climate & styling parameters...",
                "clarifier": "Consulting on fit & personal aesthetic preferences...",
                "retriever": "Curating high-match candidate pieces from collection...",
                "worker_swarm": "Tailor & textile sub-agents evaluating fabric breathability & drape...",
                "pricing": "Formulating exclusive member discounts & pricing tiers...",
                "synthesis": "Master stylist synthesizing bespoke private consultation...",
                "checkout": "Freezing cart & provisioning Razorpay checkout gateway..."
            }

            accumulated_state: Dict[str, Any] = {}

            # Initial handshake
            yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

            try:
                async for event in fashion_agent_graph.astream(input_state, config=config, stream_mode="updates"):
                    for node_name, node_output in event.items():
                        accumulated_state.update(node_output)
                        label = node_labels.get(node_name, f"Executing {node_name}...")
                        yield f"data: {json.dumps({'type': 'step', 'node': node_name, 'label': label})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
                return

            # Extract final text response
            final_response = accumulated_state.get("final_response") or ""
            if not final_response and accumulated_state.get("messages"):
                final_response = accumulated_state["messages"][-1].get("content", "")

            anchor = accumulated_state.get("anchor_sku")
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
                "text": final_response or "Here is my tailored recommendation for you.",
                "timestamp": time.strftime("%I:%M %p"),
                "recommendation": recommendation_obj,
                "candidate_skus": accumulated_state.get("candidate_skus", []),
                "evaluations": accumulated_state.get("evaluations", []),
                "pricing_result": accumulated_state.get("pricing_result"),
                "suggested_questions": accumulated_state.get("suggested_questions", []),
                "checkout_ready": accumulated_state.get("checkout_ready", False),
                "razorpay_order": accumulated_state.get("razorpay_order")
            }
            history_store.save_message_to_session(session_id, asst_msg_item, user_id=user_id)

            final_payload = {
                "type": "final",
                "status": "success",
                "session_id": session_id,
                "message": final_response,
                "intent": accumulated_state.get("intent"),
                "anchor_sku": accumulated_state.get("anchor_sku"),
                "candidate_skus": accumulated_state.get("candidate_skus", []),
                "outfit": accumulated_state.get("outfit"),
                "evaluations": accumulated_state.get("evaluations", []),
                "pricing_result": accumulated_state.get("pricing_result"),
                "suggested_questions": accumulated_state.get("suggested_questions", []),
                "checkout_ready": accumulated_state.get("checkout_ready", False),
                "razorpay_order": accumulated_state.get("razorpay_order")
            }

            yield f"data: {json.dumps(final_payload)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(chat_event_stream(), media_type="text/event-stream")

    # Non-streaming fallback
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
# 5. Persistent Cart Endpoints
# -------------------------------------------------------------------
@app.get("/api/cart")
async def get_cart(user_id: str = "usr_guest", db: Session = Depends(get_db)):
    """Retrieve all cart items for a specific user, including product details."""
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        return {"status": "success", "cart": [], "count": 0}
    
    from sqlalchemy.orm import joinedload
    items = db.query(CartItem).filter_by(user_id=user_id).options(joinedload(CartItem.product)).all()
    
    # Format to match frontend expectations
    cart_items_formatted = []
    for item in items:
        if item.product:
            catalog_item = item.product.to_catalog_item()
            # Inject chosen size and quantity into the returned product meta or top-level
            catalog_item["selected_size"] = item.size
            catalog_item["quantity"] = item.quantity
            cart_items_formatted.append(catalog_item)
            
    return {
        "status": "success",
        "cart": cart_items_formatted,
        "count": sum(item.quantity for item in items)
    }

@app.post("/api/cart/add")
async def add_to_cart(req: AddCartItemRequest, db: Session = Depends(get_db)):
    """Add a product item to the user's persistent cart database."""
    user_id = req.user_id or "usr_guest"
    existing_user = db.query(User).filter_by(user_id=user_id).first()
    if not existing_user:
        guest_user = User(
            user_id=user_id,
            username=f"guest_{uuid.uuid4().hex[:6]}",
            email=f"{user_id}@example.com"
        )
        db.add(guest_user)
        db.commit()

    prod = db.query(Product).filter_by(product_id=req.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    item = db.query(CartItem).filter_by(user_id=user_id, product_id=req.product_id, size=req.size).first()
    if item:
        item.quantity += (req.quantity or 1)
    else:
        item = CartItem(
            user_id=user_id,
            product_id=req.product_id,
            quantity=req.quantity or 1,
            size=req.size or "L"
        )
        db.add(item)

    db.commit()
    db.refresh(item)
    return {"status": "success", "message": "Product added to cart", "cart_item_id": item.cart_item_id}

@app.post("/api/cart/remove")
async def remove_from_cart(req: RemoveCartItemRequest, db: Session = Depends(get_db)):
    """Remove a product item from the user's persistent cart database."""
    user_id = req.user_id or "usr_guest"
    item = db.query(CartItem).filter_by(user_id=user_id, product_id=req.product_id, size=req.size).first()
    if not item:
        # Fallback: remove any item matching product_id regardless of size if specific size not found
        item = db.query(CartItem).filter_by(user_id=user_id, product_id=req.product_id).first()
    
    if item:
        db.delete(item)
        db.commit()
        return {"status": "success", "message": "Product removed from cart"}
    
    return {"status": "success", "message": "Product was not in cart"}

@app.post("/api/cart/clear")
async def clear_cart(req: ClearCartRequest, db: Session = Depends(get_db)):
    """Empty all cart items for a specific user."""
    user_id = req.user_id or "usr_guest"
    db.query(CartItem).filter_by(user_id=user_id).delete()
    db.commit()
    return {"status": "success", "message": "Cart cleared successfully"}


@app.get("/api/user/search-history")
async def get_search_history(user_id: str = "usr_guest", db: Session = Depends(get_db)):
    """Retrieve persistent search history list (last 5 queries) for a specific user."""
    user = db.query(User).filter_by(user_id=user_id).first()
    return {
        "status": "success",
        "search_history": user.search_history if user and user.search_history else []
    }

@app.post("/api/user/search-history")
async def save_search_history(req: SaveSearchRequest, db: Session = Depends(get_db)):
    """Chronologically append a new keyword to the user's recent search list (caps at 5 items)."""
    user_id = req.user_id or "usr_guest"
    query = req.query.strip()
    if not query:
        return {"status": "success", "search_history": []}

    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        user = User(
            user_id=user_id,
            username=f"guest_{uuid.uuid4().hex[:6]}",
            email=f"{user_id}@example.com"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    history = list(user.search_history or [])
    if query in history:
        history.remove(query)
    history.insert(0, query)
    user.search_history = history[:5]
    
    db.commit()
    db.refresh(user)
    return {"status": "success", "search_history": user.search_history}


@app.get("/api/orders")
async def get_orders(user_id: str = "usr_guest", db: Session = Depends(get_db)):
    """Retrieve all successful paid purchases for a specific user."""
    orders = db.query(Order).filter(Order.user_id == user_id, Order.status == "paid").order_by(Order.created_at.desc()).all()
    
    orders_formatted = []
    for order in orders:
        order_dict = order.to_dict()
        
        # Load details for anchor_sku
        items = []
        if order.anchor_sku:
            p = db.query(Product).filter_by(product_id=order.anchor_sku).first()
            if p:
                items.append(p.to_catalog_item())
                
        # Load details for any paired SKUs
        if order.paired_skus:
            for sku in order.paired_skus:
                p = db.query(Product).filter_by(product_id=sku).first()
                if p:
                    items.append(p.to_catalog_item())
                    
        order_dict["items"] = items
        orders_formatted.append(order_dict)
        
    return {"status": "success", "orders": orders_formatted}


# -------------------------------------------------------------------
# 4. Razorpay Checkout & Order Verification
# -------------------------------------------------------------------
@app.post("/api/checkout/create")
async def create_checkout_order(req: CreateOrderRequest, db: Session = Depends(get_db)):
    """Directly create a frozen Razorpay order and persist order record to database."""
    # Ensure guest or valid user exists in db
    user_id = req.user_id or "usr_guest"
    existing_user = db.query(User).filter_by(user_id=user_id).first()
    if not existing_user:
        # Fallback to dev user or create guest user row
        dev_user = db.query(User).filter_by(user_id="usr_local_dev").first()
        if dev_user:
            user_id = "usr_local_dev"
        else:
            guest_user = User(
                user_id=user_id,
                username=f"guest_{uuid.uuid4().hex[:6]}",
                email=f"{user_id}@example.com"
            )
            db.add(guest_user)
            db.commit()

    cart_payload = {
        "user_id": user_id,
        "anchor_sku": req.anchor_sku,
        "paired_skus": [],
        "final_total": req.final_total,
        "coupon": req.coupon or "NONE",
        "timestamp": int(time.time())
    }
    
    order = create_frozen_razorpay_order(cart_payload)

    # Persist in DB
    db_order = Order(
        order_id=f"ord_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        anchor_sku=req.anchor_sku,
        paired_skus=[],
        amount=req.final_total,
        currency=order.get("currency", "INR"),
        status="created",
        coupon=req.coupon or "NONE",
        razorpay_order_id=order.get("id"),
        receipt=order.get("receipt"),
        notes={"is_mock": order.get("is_mock", False)}
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    return {"status": "success", "order": order, "db_order_id": db_order.order_id}

@app.post("/api/checkout/verify")
async def verify_payment(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    """Cryptographically verify payment signature post checkout and update order status."""
    is_valid = verify_razorpay_payment_signature(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature
    )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed: invalid signature"
        )

    # Update database record if found
    db_order = db.query(Order).filter_by(razorpay_order_id=req.razorpay_order_id).first()
    if db_order:
        db_order.status = "paid"
        db_order.razorpay_payment_id = req.razorpay_payment_id
        db_order.razorpay_signature = req.razorpay_signature
        
        # Clear user's database cart on successful payment verification
        db.query(CartItem).filter_by(user_id=db_order.user_id).delete()
        
        db.commit()
        db.refresh(db_order)

    return {
        "status": "success",
        "message": "Payment verified successfully",
        "order_id": req.razorpay_order_id,
        "payment_id": req.razorpay_payment_id,
        "order_status": "paid"
    }

# -------------------------------------------------------------------
# Serve Built Frontend Static Files (if dist exists)
# -------------------------------------------------------------------
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
