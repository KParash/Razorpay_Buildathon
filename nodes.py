import os
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, List
from langchain_openai import ChatOpenAI
from schema import AgentState

load_dotenv()

# Master LLM (Boutique Stylist Synthesis & Semantic Intent Parsing)
master_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.3
)

# High-Throughput Worker LLM
worker_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.1
)

# -------------------------------------------------------------
# 1. Master Router & Intent Extraction
# -------------------------------------------------------------
class IntentParser(BaseModel):
    search_query: str = Field(..., description="Precise search query for catalog retrieval, e.g. 'linen shirt wedding', 'cocktail blazer jacket', 'hydrating facial moisturizer', 'wireless bluetooth headphones', 'trending fashion STYLE20'")
    occasion: Optional[str] = Field(None, description="Event, setting, or aesthetic vibe")
    destination_climate: Optional[str] = Field(None, description="Climate, weather, or environment context")
    target_delivery_date: Optional[str] = Field(None, description="Required delivery timeframe")
    max_budget: Optional[float] = Field(None, description="Maximum spend ceiling in INR")
    is_ready_to_recommend: bool = Field(..., description="True if user mentions any product, category, occasion, item or feature to recommend. False ONLY if completely vague greeting like 'hi', 'help me shop', 'something nice'.")
    is_checkout_requested: bool = Field(False, description="True if user wants to buy or checkout")

async def master_router_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    last_msg = history[-1]["content"] if history else ""

    prompt = f"""
    You are an expert E-Commerce Director and Luxury Boutique Stylist.
    Analyze the customer conversation history:
    {history}

    Latest User Message: "{last_msg}"

    Extract customer intent:
    - search_query: Extract the best search keywords for vector search (e.g., "linen shirt wedding", "blazer cocktail jacket", "hydrating facial moisturizer dry skin", "wireless bluetooth headphones", "trending fashion STYLE20").
    - max_budget: Extract numeric budget in INR if specified (e.g. "under 4000" -> 4000).
    - is_ready_to_recommend: Set True if user requests any item, outfit, product type, occasion, or category. Set False ONLY for pure open greetings/vague prompts like "hi", "recommend something nice", "help me shop".
    - is_checkout_requested: Set True if user asks to purchase, buy, or checkout.
    
    Return valid structured output.
    """
    try:
        structured_router = master_llm.with_structured_output(IntentParser)
        res = await structured_router.ainvoke(prompt)
        intent_dict = res.model_dump()
    except Exception:
        is_checkout = any(w in last_msg.lower() for w in ["buy", "checkout", "order", "purchase", "pay"])
        is_vague = last_msg.strip().lower() in ["hi", "hello", "hey", "something nice", "help me shop"]
        intent_dict = {
            "search_query": last_msg,
            "occasion": "versatile style",
            "destination_climate": "moderate",
            "target_delivery_date": "express",
            "max_budget": None,
            "is_ready_to_recommend": not is_vague,
            "is_checkout_requested": is_checkout
        }
    return {"intent": intent_dict}

# -------------------------------------------------------------
# 2. Targeted Clarifier Node (Expert Boutique Consultation)
# -------------------------------------------------------------
async def clarifier_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    prompt = f"""
    You are an elite, modern Boutique Personal Stylist and Luxury Lifestyle Concierge.
    
    Conversation History:
    {history}

    Persona Guidelines:
    - Tone: Confident, sophisticated, warm, and inspiring.
    - The customer gave an open, unspecific inquiry. Ask 1 or 2 elegant, evocative questions to discover their immediate mood, occasion, or what category they are shopping for today (e.g. resort vacation wear, formal evening pieces, daily skincare ritual, or tech essentials).
    - Avoid pushy or robotic questions.
    """
    res = await master_llm.ainvoke(prompt)
    return {
        "messages": [{"role": "assistant", "content": res.content}],
        "final_response": res.content
    }

# -------------------------------------------------------------
# 3. Hybrid Candidate Retriever Node
# -------------------------------------------------------------
async def retriever_node(state: AgentState) -> dict:
    from catalog_store import search_candidate_products, get_all_catalog_products
    
    intent = state.get("intent", {})
    search_query = intent.get("search_query") or ""
    
    if not search_query:
        search_query = f"{intent.get('occasion', '')} {intent.get('destination_climate', '')}".strip()
    if not search_query:
        search_query = "trending classic"
        
    max_budget = intent.get("max_budget")
    
    candidates = search_candidate_products(query=search_query, max_budget=max_budget, top_k=6)
    
    # Fallback if budget filter excluded candidates
    if not candidates and max_budget:
        candidates = search_candidate_products(query=search_query, max_budget=None, top_k=4)
        
    if not candidates:
        all_prods = get_all_catalog_products()
        candidates = all_prods[:4] if all_prods else []

    return {
        "candidate_skus": candidates,
        "anchor_sku": candidates[0] if candidates else None
    }

# -------------------------------------------------------------
# 4. Parallel Worker Swarm
# -------------------------------------------------------------
class SizeVerdict(BaseModel):
    recommended_size: str = Field(description="e.g. M, L, XL, 32, Standard")
    fit_confidence: float = Field(description="Confidence between 0.0 and 1.0")
    reasoning: str = Field(description="Expert cut, silhouette, or ergonomic rationale")

class FabricVerdict(BaseModel):
    climate_pass: bool = Field(description="Whether product suits climate or environment")
    wrinkle_risk: str = Field(description="Low, Moderate, or High / N/A")
    comfort_notes: str = Field(description="Material, breathability, formula, or acoustic performance notes")

class StylistVerdict(BaseModel):
    paired_categories: List[str] = Field(description="Categories that pair well")
    styling_tips: str = Field(description="Concrete advice on styling, routine usage, or pairing")
    pairing_rationale: str = Field(description="Synergy, harmony, and lifestyle rationale")

async def size_worker_task(sku: dict, profile: dict) -> dict:
    meta = sku.get("metadata", {})
    prompt = f"""
    Evaluate sizing, proportions, or ergonomic fit:
    Product: {meta.get('title')}.
    Category: {meta.get('category')}.
    Fit Type: {meta.get('fit_type', 'regular')}.
    User Fit Preference: {profile.get('fit_preference', 'relaxed')}.
    Size History: {profile.get('size_history', {})}.
    Return valid JSON.
    """
    try:
        llm = worker_llm.with_structured_output(SizeVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        return {
            "recommended_size": profile.get("size_history", {}).get("tops", "L") if meta.get("category") == "Fashion & Apparel" else "Standard Fit",
            "fit_confidence": 0.95,
            "reasoning": f"Curated {meta.get('fit_type', 'regular')} cut complements your {profile.get('fit_preference', 'relaxed')} aesthetic."
        }

async def fabric_worker_task(sku: dict, climate: str) -> dict:
    meta = sku.get("metadata", {})
    prompt = f"""
    Evaluate textile, formulation, or material performance:
    Product: {meta.get('title')}.
    Category: {meta.get('category')}.
    Material / Formulation: {meta.get('fabric', 'Premium Grade')} ({meta.get('gsm', 'N/A')} GSM).
    Target Environment / Climate: {climate}.
    Return valid JSON.
    """
    try:
        llm = worker_llm.with_structured_output(FabricVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        return {
            "climate_pass": True,
            "wrinkle_risk": "Low",
            "comfort_notes": f"Engineered for high comfort and breathability in {climate} conditions."
        }

async def stylist_worker_task(sku: dict, occasion: str) -> dict:
    meta = sku.get("metadata", {})
    prompt = f"""
    Provide bespoke styling and pairing notes:
    Product: {meta.get('title')} ({meta.get('color', 'Classic')}).
    Category: {meta.get('category')}.
    Occasion / Context: {occasion}.
    Return valid JSON.
    """
    try:
        llm = worker_llm.with_structured_output(StylistVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        return {
            "paired_categories": ["accessories", "complimentary pieces"],
            "styling_tips": "Pair with clean minimalist accents and tonal neutrals for effortless modern elegance.",
            "pairing_rationale": "Harmonizes contemporary aesthetics with functional luxury."
        }

async def worker_swarm_node(state: AgentState) -> dict:
    anchor = state["anchor_sku"]
    if not anchor:
        from catalog_store import get_all_catalog_products
        catalog = get_all_catalog_products()
        anchor = catalog[0] if catalog else None
        state["anchor_sku"] = anchor

    if not anchor:
        return {"evaluations": [], "outfit": None}

    profile = state["customer_profile"]
    climate = state["intent"].get("destination_climate") or "moderate"
    occasion = state["intent"].get("occasion") or "lifestyle curation"
    
    # Run sub-agents concurrently
    size_future = size_worker_task(anchor, profile)
    fabric_future = fabric_worker_task(anchor, climate)
    stylist_future = stylist_worker_task(anchor, occasion)
    
    size_res, fabric_res, stylist_res = await asyncio.gather(
        size_future, fabric_future, stylist_future
    )
    
    delivery_verdict = {
        "meets_deadline": True,
        "estimated_arrival": "2-3 business days (Express Courier)",
        "warehouse": anchor["metadata"].get("warehouse", "BLR_HUB")
    }
    
    evaluation = {
        "sku_id": anchor["sku_id"],
        "size_verdict": size_res,
        "fabric_verdict": fabric_res,
        "delivery_verdict": delivery_verdict,
        "pricing_verdict": {},
        "is_disqualified": not fabric_res.get("climate_pass", True),
        "rejection_reason": None
    }
    
    outfit = {
        "anchor_sku_id": anchor["sku_id"],
        "paired_skus": [],
        "styling_instructions": stylist_res.get("styling_tips", ""),
        "pairing_rationale": stylist_res.get("pairing_rationale", "")
    }
    
    return {
        "evaluations": [evaluation],
        "outfit": outfit
    }

# -------------------------------------------------------------
# 5. Pricing & Promotions Worker Node
# -------------------------------------------------------------
async def pricing_node(state: AgentState) -> dict:
    anchor = state.get("anchor_sku")
    if not anchor:
        return {"pricing_result": None}

    base_price = float(anchor["metadata"].get("price", 0))
    coupon = anchor["metadata"].get("eligible_coupon", "NONE")
    
    user_msgs = " ".join([m.get("content", "") for m in state.get("messages", [])]).upper()
    if "STYLE20" in user_msgs:
        coupon = "STYLE20"

    discount = 0.20 if coupon == "STYLE20" else (0.10 if coupon == "AURA10" else 0.0)
    final_price = round(base_price * (1 - discount), 2)
    
    pricing_verdict = {
        "base_price": base_price,
        "discount_applied": discount,
        "coupon_code": coupon,
        "final_price": final_price
    }
    
    return {"pricing_result": pricing_verdict}

# -------------------------------------------------------------
# 6. Master Synthesis Node (Expert Boutique Consultation Delivery)
# -------------------------------------------------------------
async def synthesis_node(state: AgentState) -> dict:
    if not state.get("evaluations") or not state.get("anchor_sku"):
        return {"final_response": "I'm ready to curate your selection. What specific pieces or occasions are you shopping for today?"}

    latest_eval = state["evaluations"][-1]
    pricing = state.get("pricing_result", {})
    anchor = state["anchor_sku"]
    meta = anchor["metadata"]
    outfit = state.get("outfit") or {}
    category = meta.get("category", "Fashion & Apparel")
    
    final_price = pricing.get("final_price", meta.get("price", 0))
    coupon = pricing.get("coupon_code", "NONE")
    discount = pricing.get("discount_applied", 0.0)
    
    prompt = f"""
    You are an elite Luxury Boutique Stylist and Lifestyle Concierge presenting a bespoke curation.

    Product Details:
    - Title: {meta.get('title')} (Category: {category})
    - Price: ₹{final_price} (Original: ₹{meta.get('price')})
    - Active Coupon Privilege: {coupon} ({int(discount*100)}% Discount Applied)
    - Description & Formulation: {meta.get('description', '')}
    - Material / Fabric: {meta.get('fabric')} ({meta.get('gsm', 'N/A')} GSM)
    - Fit & Proportions: {meta.get('fit_type')} | Sizing: {latest_eval.get('size_verdict')}
    - Comfort/Performance: {latest_eval.get('fabric_verdict')}
    - Styling / Usage Masterclass: {outfit.get('styling_instructions')} | {outfit.get('pairing_rationale')}

    Category-Specific Guidelines:
    - If Fashion & Apparel: Speak with high-fashion expertise about drape, occasion setting, silhouette cut, and styling.
    - If Beauty & Skincare: Focus on skin nourishment, daily glow ritual, deep hydration, and smooth complexion.
    - If Electronics & Gadgets: Highlight sound immersion, wireless freedom, daily workout/commute utility, and ergonomic comfort.
    - If Health / Home: Highlight daily wellness, functionality, and seamless everyday elegance.

    Tone:
    - Confident, sophisticated, warm, and highly knowledgeable.
    - If a coupon (e.g. STYLE20) was unlocked, naturally celebrate the savings privilege.
    - Output crisp, engaging paragraphs without robotic bullet points.
    """
    res = await master_llm.ainvoke(prompt)
    return {
        "messages": [{"role": "assistant", "content": res.content}],
        "final_response": res.content
    }

# -------------------------------------------------------------
# 7. Deterministic Hand-off (Razorpay Boundary)
# -------------------------------------------------------------
async def razorpay_checkout_node(state: AgentState) -> dict:
    import time
    from checkout_service import create_frozen_razorpay_order
    
    pricing = state.get("pricing_result", {})
    final_total = pricing.get("final_price", 0)
    coupon_code = pricing.get("coupon_code", "NONE")
    
    cart_payload = {
        "user_id": state["customer_profile"]["user_id"],
        "anchor_sku": state["anchor_sku"]["sku_id"],
        "paired_skus": [p.get("sku_id") for p in (state.get("outfit") or {}).get("paired_skus", [])],
        "final_total": final_total,
        "coupon": coupon_code,
        "timestamp": int(time.time())
    }
    
    razorpay_order = create_frozen_razorpay_order(cart_payload)
    msg = f"Your tailored selection has been locked at ₹{final_total} with coupon {coupon_code} applied. Click below to complete your order via Razorpay secure checkout."
    
    return {
        "checkout_ready": True,
        "razorpay_order": razorpay_order,
        "messages": [{"role": "assistant", "content": msg}],
        "final_response": msg
    }