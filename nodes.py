import os
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, List
from langchain_openai import ChatOpenAI
from schema import AgentState

load_dotenv()

# Master LLM (Semantic Nuance & Empathetic Synthesis)
master_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.4
)

# High-Throughput Worker LLM (Sub-second Deterministic JSON)
worker_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.6-27b",
    temperature=0
)

# -------------------------------------------------------------
# 1. Master Router & Intent Extraction
# -------------------------------------------------------------
class IntentParser(BaseModel):
    occasion: Optional[str] = Field(None, description="Event or context of wear")
    destination_climate: Optional[str] = Field(None, description="Weather or season")
    target_delivery_date: Optional[str] = Field(None, description="Needed by date")
    max_budget: Optional[float] = Field(None, description="Max spend threshold in INR")
    is_ready_to_recommend: bool = Field(..., description="True if occasion + budget or climate is known")
    is_checkout_requested: bool = Field(False, description="True if user wants to buy / checkout")

async def master_router_node(state: AgentState) -> dict:
    structured_router = master_llm.with_structured_output(IntentParser)
    history = state["messages"]
    
    prompt = f"""
    You are an expert Personal Fashion Consultant. Analyze dialogue history:
    {history}
    Extract customer intent and check if we have enough clarity to search products.
    """
    res = await structured_router.ainvoke(prompt)
    return {
        "intent": res.model_dump()
    }

# -------------------------------------------------------------
# 2. Targeted Clarifier Node (Prevents Premature Selling)
# -------------------------------------------------------------
async def clarifier_node(state: AgentState) -> dict:
    prompt = f"""
    Identity: Premium offline fashion consultant. Never interrogate.
    Current Known Context: {state['intent']}
    Task: Ask exactly 1 or at most 2 purposeful, warm questions to understand the customer's occasion or aesthetic preferences.
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
    from catalog_store import search_candidate_products
    
    intent = state["intent"]
    query = f"{intent.get('occasion', '')} {intent.get('destination_climate', '')}".strip()
    max_budget = intent.get("max_budget")
    
    candidates = search_candidate_products(query=query, max_budget=max_budget, top_k=5)
    return {
        "candidate_skus": candidates,
        "anchor_sku": candidates[0] if candidates else None
    }

# -------------------------------------------------------------
# 4. Parallel Worker Swarm
# -------------------------------------------------------------
class SizeVerdict(BaseModel):
    recommended_size: str
    fit_confidence: float
    reasoning: str

class FabricVerdict(BaseModel):
    climate_pass: bool
    wrinkle_risk: str
    comfort_notes: str

class StylistVerdict(BaseModel):
    paired_categories: List[str]
    styling_tips: str
    pairing_rationale: str

async def size_worker_task(sku: dict, profile: dict) -> dict:
    prompt = f"Product: {sku['metadata']['title']}. Fit specs: {sku['metadata']['fit_type']}. User: {profile['fit_preference']}."
    llm = worker_llm.with_structured_output(SizeVerdict)
    res = await llm.ainvoke(prompt)
    return res.model_dump()

async def fabric_worker_task(sku: dict, climate: str) -> dict:
    prompt = f"Fabric: {sku['metadata']['fabric']} ({sku['metadata']['gsm']} GSM). Target Climate: {climate}."
    llm = worker_llm.with_structured_output(FabricVerdict)
    res = await llm.ainvoke(prompt)
    return res.model_dump()

async def stylist_worker_task(sku: dict, occasion: str) -> dict:
    prompt = f"Anchor: {sku['metadata']['title']}. Palette: {sku['metadata']['color']}. Occasion: {occasion}."
    llm = worker_llm.with_structured_output(StylistVerdict)
    res = await llm.ainvoke(prompt)
    return res.model_dump()

async def worker_swarm_node(state: AgentState) -> dict:
    anchor = state["anchor_sku"]
    profile = state["customer_profile"]
    climate = state["intent"].get("destination_climate", "moderate")
    occasion = state["intent"].get("occasion", "versatile")
    
    # Run bounded sub-agents concurrently
    size_future = size_worker_task(anchor, profile)
    fabric_future = fabric_worker_task(anchor, climate)
    stylist_future = stylist_worker_task(anchor, occasion)
    
    size_res, fabric_res, stylist_res = await asyncio.gather(
        size_future, fabric_future, stylist_future
    )
    
    # Mock Delivery & Logistics SLA evaluation
    delivery_verdict = {
        "meets_deadline": True,
        "estimated_arrival": "3 days (Express)",
        "warehouse": anchor["metadata"].get("warehouse", "BLR_HUB")
    }
    
    evaluation = {
        "sku_id": anchor["sku_id"],
        "size_verdict": size_res,
        "fabric_verdict": fabric_res,
        "delivery_verdict": delivery_verdict,
        "pricing_verdict": {},
        "is_disqualified": not fabric_res["climate_pass"],
        "rejection_reason": "Fabric unsuited for target climate" if not fabric_res["climate_pass"] else None
    }
    
    outfit = {
        "anchor_sku_id": anchor["sku_id"],
        "paired_skus": [],
        "styling_instructions": stylist_res["styling_tips"],
        "pairing_rationale": stylist_res["pairing_rationale"]
    }
    
    return {
        "evaluations": [evaluation],
        "outfit": outfit
    }

# -------------------------------------------------------------
# 5. Pricing & Promotions Worker Node
# -------------------------------------------------------------
async def pricing_node(state: AgentState) -> dict:
    anchor = state["anchor_sku"]
    base_price = float(anchor["metadata"]["price"])
    coupon = anchor["metadata"].get("eligible_coupon", "NONE")
    
    discount = 0.15 if coupon == "STYLE20" else 0.10
    final_price = round(base_price * (1 - discount), 2)
    
    pricing_verdict = {
        "base_price": base_price,
        "discount_applied": discount,
        "coupon_code": coupon,
        "final_price": final_price
    }
    
    # Store pricing in a dedicated state key (avoids operator.add duplication)
    return {"pricing_result": pricing_verdict}

# -------------------------------------------------------------
# 6. Master Synthesis Node
# -------------------------------------------------------------
async def synthesis_node(state: AgentState) -> dict:
    latest_eval = state["evaluations"][-1]
    pricing = state.get("pricing_result", {})
    anchor = state["anchor_sku"]
    outfit = state["outfit"]
    
    final_price = pricing.get("final_price", anchor["metadata"]["price"])
    
    prompt = f"""
    Act as a trusted Personal Fashion Consultant. Deliver a warm recommendation.
    Product: {anchor['metadata']['title']} (Price: ₹{final_price})
    Sizing Analysis: {latest_eval['size_verdict']}
    Fabric & Comfort: {latest_eval['fabric_verdict']}
    Pricing Details: {pricing}
    Outfit Styling & Pairings: {outfit['styling_instructions']} - {outfit['pairing_rationale']}
    
    Rules:
    - Never say 'Recommended for you'.
    - Explain WHY this matches their occasion.
    - Highlight specific fabric trade-offs and styling guidelines.
    - If there is a discount or coupon, mention the savings.
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
    msg = f"Your outfit is curated and order is locked at ₹{final_total}. Opening Razorpay secure checkout."
    
    return {
        "checkout_ready": True,
        "razorpay_order": razorpay_order,
        "messages": [{"role": "assistant", "content": msg}],
        "final_response": msg
    }