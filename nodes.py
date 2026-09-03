import os
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
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

# High-Throughput Worker LLM (Deterministic Tailor, Textile, and Look Tasks)
worker_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.1
)

# -------------------------------------------------------------
# 1. Master Orchestrator Node (master_router_node)
# -------------------------------------------------------------
class IntentParser(BaseModel):
    occasion: Optional[str] = Field(None, description="Event, setting, or aesthetic vibe, e.g. 'beach wedding', 'cocktail evening', 'formal business', 'vacation'")
    destination_climate: Optional[str] = Field(None, description="Inferred or stated climate/weather, e.g. 'warm and humid coastal', 'tropical', 'chilly mountain', 'temperate'")
    target_delivery_date: Optional[str] = Field(None, description="Required delivery timeframe or event date, e.g. 'this weekend', 'next Friday', 'express'")
    max_budget: Optional[float] = Field(None, description="Maximum budget in INR if specified, e.g. 4000.0")
    formality_level: Optional[str] = Field(None, description="e.g. 'casual', 'smart casual', 'semi-formal', 'black tie'")
    search_query: str = Field(..., description="High-relevance semantic catalog search keywords (e.g. 'linen shirt beach wedding goa', 'navy tailored blazer')")
    is_ready_to_recommend: bool = Field(..., description="Set true ONLY if user specifies a concrete piece/garment OR has an identified occasion/vibe AND at least one secondary constraint (budget, climate, or silhouette). Set false if the prompt is general or vague (e.g. 'help me dress up for an upcoming trip', 'show me clothes', 'recommend an outfit') so the consultant can clarify.")
    is_checkout_requested: bool = Field(False, description="Set true ONLY if customer explicitly requests to purchase, buy, or checkout (e.g. 'buy this', 'checkout', 'proceed to pay').")

async def master_router_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    last_msg = history[-1]["content"] if history else ""
    prev_intent = state.get("intent") or {}

    prompt = f"""
You are an expert Personal Fashion Consultant and Intent Resolution Engine.
Analyze the dialogue history below:
{history}

Latest Customer Message: "{last_msg}"
Previously Extracted Intent State: {prev_intent}

Task:
1. Extract customer intent (occasion, destination climate, delivery deadline, budget, and formality level).
2. Infer obvious contextual variables (e.g., coastal vacations like Goa or Bali imply warm, sunny, and humid coastal weather; hill stations imply crisp or cold weather; summer dinners imply warm temperate).
3. Evaluate Information Sufficiency:
   - Set `is_ready_to_recommend = true` ONLY if you have an identified occasion/vibe AND at least one secondary constraint (budget, climate, or silhouette), OR if the user explicitly specifies a concrete product/garment (e.g. 'white linen shirt', 'cocktail blazer', 'oversized polo').
   - If intent is general, broad, or lacks specifics (e.g., 'Help me dress up for an upcoming trip', 'Show me clothes', 'Help me dress up', 'I need an outfit', 'Recommend something nice'), set `is_ready_to_recommend = false` so the consultant can ask where they are traveling or what specific aesthetic they envision.
4. Evaluate Purchase Readiness:
   - Set `is_checkout_requested = true` ONLY if the client explicitly requests to purchase, buy, or checkout (e.g., 'buy this', 'checkout', 'place order', 'proceed to pay').
5. Synthesize `search_query`: Provide 3-5 rich semantic keywords matching the intent, occasion, and inferred climate for catalog search (e.g. 'linen shirt beach wedding goa', 'silk cocktail jacket formal evening').

Return valid structured output.
"""
    try:
        structured_router = master_llm.with_structured_output(IntentParser)
        res = await structured_router.ainvoke(prompt)
        intent_dict = res.model_dump()
    except Exception:
        # Fallback heuristic parser
        is_checkout = any(w in last_msg.lower() for w in ["buy", "checkout", "order", "purchase", "pay"])
        is_broad = any(last_msg.strip().lower().startswith(w) for w in [
            "hi", "hello", "hey", "help me shop", "show me clothes", 
            "i need an outfit", "help me dress up", "recommend something", "something nice"
        ])
        intent_dict = {
            "occasion": prev_intent.get("occasion") or "lifestyle dressing",
            "destination_climate": prev_intent.get("destination_climate") or "temperate",
            "target_delivery_date": prev_intent.get("target_delivery_date") or "express",
            "max_budget": prev_intent.get("max_budget"),
            "formality_level": prev_intent.get("formality_level") or "smart casual",
            "search_query": last_msg,
            "is_ready_to_recommend": not is_broad,
            "is_checkout_requested": is_checkout
        }

    # Cumulative Intent Merge: Persist previous slots across turns
    merged_intent = {**prev_intent}
    for k, v in intent_dict.items():
        if v is not None and v != "":
            merged_intent[k] = v
            
    # Explicit checkout requested takes precedence
    if intent_dict.get("is_checkout_requested"):
        merged_intent["is_checkout_requested"] = True

    return {"intent": merged_intent}

# -------------------------------------------------------------
# 2. Targeted Clarifier Node (clarifier_node)
# -------------------------------------------------------------
async def clarifier_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    known_intent = state.get("intent", {})
    profile = state.get("customer_profile", {})

    system_prompt = """
You are an experienced, high-end personal fashion consultant speaking face-to-face with a client in a private studio.

Core Directives:
1. Never sound like automated customer support. Skip conversational fillers ("Certainly!", "I can assist!", "Sure!").
2. Never present a questionnaire or bulleted list.
3. Infer the obvious: If they mention a tropical trip, do not ask if it is hot. Ask about the itinerary (beach lounging vs. formal dinner) or cut preference.
4. Formulate at most 1 or 2 purposeful, conversational questions.
5. Keep the response under 3 sentences with warmth and style authority.
"""

    user_context = f"""
Dialogue History:
{history}

Customer Profile:
- Size & Fit Preference: {profile.get('fit_preference', 'relaxed')}
- Excluded Colors: {profile.get('disliked_colors', [])}

Extracted Intent So Far:
{known_intent}

Task:
Formulate the single most natural, high-impact follow-up question to clarify their styling direction.
"""

    res = await master_llm.ainvoke([
        {"role": "system", "content": system_prompt.strip()},
        {"role": "user", "content": user_context.strip()}
    ])

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
        search_query = "trending classic luxury"
        
    max_budget = intent.get("max_budget")
    
    # Retrieve top 8 candidate products to support anchor + paired look + alternatives
    candidates = search_candidate_products(query=search_query, max_budget=max_budget, top_k=8)
    
    # Fallback if budget filter excluded candidates
    if len(candidates) < 5 and max_budget:
        candidates = search_candidate_products(query=search_query, max_budget=None, top_k=8)
        
    # Ensure minimum candidate pool for styling pairings and alternatives
    if len(candidates) < 5:
        all_prods = get_all_catalog_products()
        existing_ids = {c["sku_id"] for c in candidates}
        for p in all_prods:
            if p["sku_id"] not in existing_ids:
                candidates.append(p)
            if len(candidates) >= 8:
                break

    return {
        "candidate_skus": candidates,
        "anchor_sku": candidates[0] if candidates else None
    }

# -------------------------------------------------------------
# 4. Parallel Worker Swarm (Deterministic Attribute Swarm)
# -------------------------------------------------------------
class SizeVerdict(BaseModel):
    recommended_size: str = Field(description="e.g. M, L, XL, 32, Standard Fit")
    fit_confidence: float = Field(description="Confidence between 0.0 and 1.0")
    reasoning: str = Field(description="Tailored cut, silhouette, and proportion rationale")

class FabricVerdict(BaseModel):
    climate_pass: bool = Field(description="True if textile comfortably suits the climate; False if incompatible (e.g. heavy wool in hot humid coastal setting)")
    wrinkle_risk: str = Field(description="Low, Moderate, or High / Natural Linen Character")
    comfort_notes: str = Field(description="Technical textile breathability, GSM weight, and moisture behavior")

class StylistVerdict(BaseModel):
    paired_categories: List[str] = Field(description="Complementary piece categories for a complete look")
    styling_tips: str = Field(description="Editorial wardrobe advice on drape, unbuttoning, cuffs, tucking, or accessories")
    pairing_rationale: str = Field(description="Silhouette balance, texture interplay, and color harmony rationale")

# 5.1 Size & Fit Specialist (Master Tailor)
async def size_worker_task(sku: dict, profile: dict) -> dict:
    meta = sku.get("metadata", {})
    prompt = f"""
You are an expert master tailor. Evaluate garment measurements, fit type, and customer fit preferences. Return valid JSON only.

Garment Details:
- Title: {meta.get('title')}
- Category: {meta.get('category', 'Fashion & Apparel')}
- Fit Type: {meta.get('fit_type', 'regular')}

Customer Profile:
- Fit Preference: {profile.get('fit_preference', 'relaxed')}
- Size History: {profile.get('size_history', {})}
"""
    try:
        llm = worker_llm.with_structured_output(SizeVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        fallback_size = profile.get("size_history", {}).get("tops", "L") if meta.get("category") == "Fashion & Apparel" else "Standard Fit"
        return {
            "recommended_size": fallback_size,
            "fit_confidence": 0.95,
            "reasoning": f"Precision tailored {meta.get('fit_type', 'regular')} cut complements your {profile.get('fit_preference', 'relaxed')} preference."
        }

# 5.2 Fabric & Climate Specialist (Textile Engineer)
async def fabric_worker_task(sku: dict, climate: str) -> dict:
    meta = sku.get("metadata", {})
    fabric_desc = meta.get("fabric", "Fine Cotton")
    gsm = meta.get("gsm", "N/A")
    prompt = f"""
You are a textile engineer evaluating fabric breathability, fabric weight (GSM), and climate viability. Return valid JSON only.

Textile Specifications:
- Garment: {meta.get('title')}
- Category: {meta.get('category', 'Fashion & Apparel')}
- Material / Weave: {fabric_desc}
- Weight: {gsm} GSM
- Target Environment / Climate: {climate}

Evaluate breathability, thermal comfort, wrinkle tendency, and climate viability.
"""
    try:
        llm = worker_llm.with_structured_output(FabricVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        return {
            "climate_pass": True,
            "wrinkle_risk": "Moderate",
            "comfort_notes": f"Breathable {fabric_desc} weave engineered for optimal airflow in {climate} settings."
        }

# 5.3 Stylist & Look Specialist (Editorial Wardrobe Stylist)
async def stylist_worker_task(sku: dict, occasion: str) -> dict:
    meta = sku.get("metadata", {})
    prompt = f"""
You are an editorial wardrobe stylist. Generate pairing categories and styling advice based on silhouette proportions and color harmony. Return valid JSON only.

Anchor Garment: {meta.get('title')}
Colorway: {meta.get('color', 'Neutral Tone')}
Occasion: {occasion}
"""
    try:
        llm = worker_llm.with_structured_output(StylistVerdict)
        res = await llm.ainvoke(prompt)
        return res.model_dump()
    except Exception:
        return {
            "paired_categories": ["tailored trousers", "leather footwear", "woven belt"],
            "styling_tips": "Leave the top two buttons undone with sleeves casually rolled to mid-forearm for relaxed sophistication.",
            "pairing_rationale": "Balances effortless texture with clean, architectural lines."
        }

async def worker_swarm_node(state: AgentState) -> dict:
    candidates = state.get("candidate_skus", [])
    if not candidates:
        from catalog_store import get_all_catalog_products
        candidates = get_all_catalog_products()[:8]
        state["candidate_skus"] = candidates

    anchor = state.get("anchor_sku") or (candidates[0] if candidates else None)
    if not anchor:
        return {"evaluations": [], "outfit": None}

    profile = state.get("customer_profile", {})
    climate = state.get("intent", {}).get("destination_climate") or "temperate"
    occasion = state.get("intent", {}).get("occasion") or "curated lifestyle"

    # Evaluate anchor with worker swarm
    size_res, fabric_res, stylist_res = await asyncio.gather(
        size_worker_task(anchor, profile),
        fabric_worker_task(anchor, climate),
        stylist_worker_task(anchor, occasion)
    )

    delivery_verdict = {
        "meets_deadline": True,
        "estimated_arrival": "2-3 business days (Express Courier Delivery)",
        "warehouse": anchor["metadata"].get("warehouse", "BLR_CENTRAL_HUB")
    }

    # Handle climate viability & candidate failover
    alternative_eval = None
    if not fabric_res.get("climate_pass", True) and len(candidates) > 1:
        for cand in candidates[1:]:
            cand_fabric = str(cand["metadata"].get("fabric", "")).lower()
            if any(k in cand_fabric for k in ["linen", "cotton", "silk", "blend", "lightweight", "chiffon"]):
                alt_size, alt_fabric, alt_stylist = await asyncio.gather(
                    size_worker_task(cand, profile),
                    fabric_worker_task(cand, climate),
                    stylist_worker_task(cand, occasion)
                )
                if alt_fabric.get("climate_pass", True):
                    alternative_eval = {
                        "sku_id": anchor["sku_id"],
                        "size_verdict": size_res,
                        "fabric_verdict": fabric_res,
                        "delivery_verdict": delivery_verdict,
                        "pricing_verdict": {},
                        "is_disqualified": True,
                        "rejection_reason": f"Textile ({anchor['metadata'].get('fabric')}, {anchor['metadata'].get('gsm')} GSM) is heavy for {climate}."
                    }
                    anchor = cand
                    size_res, fabric_res, stylist_res = alt_size, alt_fabric, alt_stylist
                    break

    # Primary evaluation
    evaluation = {
        "sku_id": anchor["sku_id"],
        "size_verdict": size_res,
        "fabric_verdict": fabric_res,
        "delivery_verdict": delivery_verdict,
        "pricing_verdict": {},
        "is_disqualified": not fabric_res.get("climate_pass", True),
        "rejection_reason": None
    }

    eval_list = [evaluation]
    if alternative_eval:
        eval_list.append(alternative_eval)

    # Select complementary pieces from remaining candidates for a 5-8 item collection
    paired_skus = [c for c in candidates if c["sku_id"] != anchor["sku_id"]][:5]

    outfit = {
        "anchor_sku_id": anchor["sku_id"],
        "paired_skus": paired_skus,
        "styling_instructions": stylist_res.get("styling_tips", ""),
        "pairing_rationale": stylist_res.get("pairing_rationale", "")
    }

    return {
        "anchor_sku": anchor,
        "evaluations": eval_list,
        "outfit": outfit
    }

# -------------------------------------------------------------
# 5. Pricing & Promotions Worker Node (pricing_node)
# -------------------------------------------------------------
async def pricing_node(state: AgentState) -> dict:
    anchor = state.get("anchor_sku")
    if not anchor:
        return {"pricing_result": None}

    base_price = float(anchor["metadata"].get("price", 0))
    coupon = anchor["metadata"].get("eligible_coupon", "NONE")
    
    # Check if user mentioned a promo code in chat
    user_msgs = " ".join([m.get("content", "") for m in state.get("messages", [])]).upper()
    if "STYLE20" in user_msgs:
        coupon = "STYLE20"
    elif "AURA10" in user_msgs:
        coupon = "AURA10"

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
# 6. Master Synthesis Node (synthesis_node)
# -------------------------------------------------------------
async def synthesis_node(state: AgentState) -> dict:
    if not state.get("evaluations") or not state.get("anchor_sku"):
        return {"final_response": "I'm ready to curate your selection. What specific pieces or occasions are you shopping for today?"}

    latest_eval = state["evaluations"][0]  # Primary anchor evaluation
    pricing = state.get("pricing_result", {})
    anchor = state["anchor_sku"]
    meta = anchor["metadata"]
    outfit = state.get("outfit") or {}
    intent = state.get("intent", {})
    profile = state.get("customer_profile", {})

    base_price = pricing.get("base_price", meta.get("price", 0))
    final_price = pricing.get("final_price", base_price)
    coupon = pricing.get("coupon_code", "NONE")
    
    # Complementary pieces list
    paired_items = outfit.get("paired_skus", [])
    paired_titles = [f"{p['metadata'].get('title')} (₹{p['metadata'].get('price')})" for p in paired_items[:4]]
    paired_summary = ", ".join(paired_titles) if paired_titles else "curated trousers and accessories"

    # Alternative candidate note if evaluated
    alt_eval = state["evaluations"][1] if len(state["evaluations"]) > 1 else None
    alt_note = ""
    if alt_eval and alt_eval.get("is_disqualified"):
        alt_note = f"\nNote on Alternative Options: We also examined an alternative piece, but its heavier GSM fabric is less suited for {intent.get('destination_climate', 'this climate')}. The primary piece above offers superior thermal breathability."

    prompt = f"""
You are a discerning, top-tier Personal Fashion Consultant curating an outfit for a private client.

Stylist Rules:
- Prohibited phrases: "Recommended for you", "I have selected", "Here is your outfit", "Hope this helps!", "Let me know if you need anything else!".
- Jump straight into the styling vision: Start with how the anchor piece solves their specific occasion or aesthetic.
- Balance taste with candid honesty: If the fabric has trade-offs (e.g., linen wrinkles quickly, delicate hand-wash, heavy GSM), highlight it constructively as care guidance.
- Weave the styling pairing naturally: Describe the complete silhouette (how the trousers, accessories, or footwear complete the cut).
- Financial clarity: Mention the pricing and coupon savings smoothly in one sentence, not like a sales banner.
- Tone: Sophisticated, grounded, warm, peer-to-peer.

Dynamic User Context:
Client Context:
- Occasion: {intent.get('occasion', 'tailored occasion')}
- Climate/Setting: {intent.get('destination_climate', 'temperate')}
- Fit Preference: {profile.get('fit_preference', 'relaxed')}

Selected Anchor Piece:
- Title: {meta.get('title')}
- Base Price: ₹{base_price} | Final Price: ₹{final_price} (Coupon Applied: {coupon})
- Fabric & GSM: {meta.get('fabric', 'Premium Fabric')} ({meta.get('gsm', 'N/A')} GSM)

Technical Verdicts from Specialists:
- Size & Fit: Recommended Size {latest_eval.get('size_verdict', {}).get('recommended_size', 'L')} (Reasoning: {latest_eval.get('size_verdict', {}).get('reasoning', '')})
- Fabric Viability: {latest_eval.get('fabric_verdict', {}).get('comfort_notes', '')} | Wrinkle Risk: {latest_eval.get('fabric_verdict', {}).get('wrinkle_risk', 'Low')}
- Delivery Timeline: {latest_eval.get('delivery_verdict', {}).get('estimated_arrival', '2-3 business days')}

Complete Look Pairings & Styling Notes:
- Instructions: {outfit.get('styling_instructions', '')}
- Pairing Rationale: {outfit.get('pairing_rationale', '')}
- Curated Complementary Ensemble: {paired_summary}
{alt_note}
"""

    res = await master_llm.ainvoke(prompt)
    return {
        "messages": [{"role": "assistant", "content": res.content}],
        "final_response": res.content
    }

# -------------------------------------------------------------
# 7. Deterministic Checkout Node (razorpay_checkout_node)
# -------------------------------------------------------------
async def razorpay_checkout_node(state: AgentState) -> dict:
    import time
    from checkout_service import create_frozen_razorpay_order
    
    pricing = state.get("pricing_result") or {}
    final_total = pricing.get("final_price", 0)
    coupon_code = pricing.get("coupon_code", "NONE")
    
    cart_payload = {
        "user_id": state["customer_profile"]["user_id"],
        "anchor_sku": state["anchor_sku"]["sku_id"] if state.get("anchor_sku") else "SKU_GENERIC",
        "paired_skus": [p.get("sku_id") for p in (state.get("outfit") or {}).get("paired_skus", [])],
        "final_total": final_total,
        "coupon": coupon_code,
        "timestamp": int(time.time())
    }
    
    razorpay_order = create_frozen_razorpay_order(cart_payload)
    msg = f"Your outfit is curated and your order is locked at ₹{final_total} (using code {coupon_code}). Opening Razorpay secure checkout."
    
    return {
        "checkout_ready": True,
        "razorpay_order": razorpay_order,
        "messages": [{"role": "assistant", "content": msg}],
        "final_response": msg
    }