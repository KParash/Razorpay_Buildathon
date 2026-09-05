import os
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from langchain_openai import ChatOpenAI
from schema import AgentState

load_dotenv(override=True)

# Master LLM (Boutique Stylist Synthesis & Semantic Intent Parsing)
master_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.5,
    max_tokens=500
)

# High-Throughput Worker LLM (Deterministic Tailor, Textile, and Look Tasks)
worker_llm = ChatOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
    model="qwen/qwen3.8-27b",
    temperature=0.1,
    max_tokens=250
)

# -------------------------------------------------------------
# Prompt History Trimming (Context Window Management)
# -------------------------------------------------------------
def _trim_history(history: List[Dict[str, Any]], max_messages: int = 10, max_chars: int = 4000) -> List[Dict[str, Any]]:
    """
    Cap the conversation history embedded into LLM prompts so long-running
    sessions can't overflow the context window. Keeps the newest max_messages
    turns, further trimmed from the front until total content fits max_chars.
    """
    if not history:
        return []
    recent = history[-max_messages:]
    total = sum(len(str(m.get("content", ""))) for m in recent)
    while len(recent) > 1 and total > max_chars:
        dropped = recent.pop(0)
        total -= len(str(dropped.get("content", "")))
    return recent


# -------------------------------------------------------------
# Token Usage Extraction & Per-Turn Accumulation
# -------------------------------------------------------------
ZERO_USAGE: Dict[str, int] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


def _usage_dict(res: Any) -> Dict[str, int]:
    """Extract token usage from a LangChain AIMessage response."""
    u = getattr(res, "usage_metadata", None) or {}
    return {
        "prompt_tokens": int(u.get("input_tokens", 0) or 0),
        "completion_tokens": int(u.get("output_tokens", 0) or 0),
        "total_tokens": int(u.get("total_tokens", 0) or 0),
    }


def _sum_usages(usages: List[Dict[str, int]]) -> Dict[str, int]:
    return {
        "prompt_tokens": sum(u.get("prompt_tokens", 0) for u in usages),
        "completion_tokens": sum(u.get("completion_tokens", 0) for u in usages),
        "total_tokens": sum(u.get("total_tokens", 0) for u in usages),
    }


def _merge_usage(state: AgentState, own: Dict[str, int]) -> Dict[str, int]:
    """
    Accumulate this node's usage onto the running per-turn total.
    (The router RESETS the counter instead of merging, so multi-turn
    sessions report usage per turn, not cumulative across turns.)
    """
    base = state.get("token_usage") or {}
    return {
        "prompt_tokens": base.get("prompt_tokens", 0) + own.get("prompt_tokens", 0),
        "completion_tokens": base.get("completion_tokens", 0) + own.get("completion_tokens", 0),
        "total_tokens": base.get("total_tokens", 0) + own.get("total_tokens", 0),
    }


# -------------------------------------------------------------
# KAZU Inventory Reference (All Segments)
# -------------------------------------------------------------
KAZU_INVENTORY = """
KAZU Atelier has 4 product segments. ONLY recommend products from these segments:

1. MEN — Shirts, T-Shirts, Pants/Trousers, Shoes, Sunglasses
   Examples: Oxford shirts, linen shirts, seersucker, polo tees, graphic tees, chinos, linen trousers, denim jeans, formal trousers, leather sneakers, derby shoes, chelsea boots, aviator sunglasses, wayfarer sunglasses

2. WOMEN — Dresses, Tops, Bottoms, Shoes, Sunglasses, Bags
   Examples: Maxi dresses, wrap dresses, blazer dresses, floral dresses, silk blouses, crop tops, co-ord sets, wide-leg pants, midi skirts, jogger pants, block-heel sandals, canvas sneakers, cat-eye sunglasses, oversized sunglasses, canvas tote, leather crossbody

3. KIDS — Tops, Bottoms, Shoes, Accessories
   Examples: Graphic tees, polo tees, tie-dye shirts, matching sets, zip-up hoodies, cargo joggers, denim shorts, cotton leggings, canvas sneakers, light-up sports shoes, rain boots, caps

4. BEAUTY — Skincare, Makeup, Hair Care, Fragrances, Grooming
   Examples: Vitamin C serum, SPF sunscreen, overnight face mask, face wash, lip balm, lipstick, mascara, eyeliner, argan hair oil, anti-frizz shampoo, EDP perfume, body mist, men's shaving gel
"""


# -------------------------------------------------------------
# 1. Master Orchestrator Node (master_router_node)
# -------------------------------------------------------------
class IntentParser(BaseModel):
    occasion: Optional[str] = Field(None, description="Event, setting, or aesthetic vibe, e.g. 'beach vacation', 'formal dinner', 'daily skincare routine', 'school wear'")
    destination_climate: Optional[str] = Field(None, description="Inferred climate/weather, e.g. 'warm coastal', 'tropical', 'chilly mountain', 'temperate'")
    target_delivery_date: Optional[str] = Field(None, description="Required delivery timeframe, e.g. 'this weekend', 'next Friday', 'express'")
    max_budget: Optional[float] = Field(None, description="Maximum budget in INR if specified, e.g. 3000.0")
    formality_level: Optional[str] = Field(None, description="e.g. 'casual', 'smart casual', 'semi-formal', 'glamorous'")
    target_segment: Optional[str] = Field(None, description="Shopping segment — must be exactly one of: 'Men', 'Women', 'Kids', 'Beauty', or 'unknown'. Infer from context: 'my daughter' → 'Kids', 'skincare routine' → 'Beauty', 'husband' → 'Men'. If completely unclear, return 'unknown'.")
    search_query: str = Field(..., description="Rich semantic catalog search keywords tailored to KAZU's inventory and the identified segment (e.g. 'linen shirt beach trousers men', 'maxi dress resort women', 'kids graphic tee jogger', 'vitamin C serum skincare')")
    is_ready_to_recommend: bool = Field(..., description="Set true ONLY if: (a) segment is known AND occasion/vibe is identified, OR (b) user explicitly names a specific product type. Set false if segment is 'unknown' or intent is too vague.")
    is_add_to_cart_requested: bool = Field(False, description="Set true if customer explicitly requests to add the recommended products, look, or curated outfit to their cart/shopping bag.")
    is_checkout_requested: bool = Field(False, description="Set true ONLY if customer explicitly requests to purchase, buy, or checkout directly.")
    target_skus_to_add: List[str] = Field(default_factory=list, description="The list of specific product SKU/product IDs (e.g. ['SKU_019', 'SKU_009']) that the customer explicitly wants to add to their cart in their latest message. Read the dialogue history and the latest user request to identify which specific SKUs they want to add (e.g. the anchor product, or particular coordinate products they liked). Empty if no cart addition is requested.")

async def master_router_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    last_msg = history[-1]["content"] if history else ""
    prompt_history = _trim_history(history)
    prev_intent = state.get("intent") or {}
    profile = state.get("customer_profile") or {}
    active_cart = profile.get("cart") or []
    active_cart_summary = ", ".join([f"{item['product_id']} (size: {item['size']})" for item in active_cart]) if active_cart else "Empty"

    prompt = f"""
You are the Intent Resolution Engine for KAZU — a premium multi-segment fashion and beauty store.

{KAZU_INVENTORY}

Dialogue History:
{prompt_history}

Latest Customer Message: "{last_msg}"
Previously Extracted Intent: {prev_intent}
Customer's Active Shopping Cart: {active_cart_summary}

Your Task:
1. Identify the shopping SEGMENT (Men / Women / Kids / Beauty) from conversation context.
   - Use pronouns, mentions of relationships (my daughter, husband, baby, herself), product types, or explicit mentions.
   - If user mentions skincare, makeup, fragrance, or hair → segment is 'Beauty'.
   - If user says "for my kids", "for my son/daughter", mentions age < 12 → segment is 'Kids'.
   - If user mentions "for me" and seems female or mentions women's items → 'Women'.
   - If still truly unclear after 2+ turns → segment stays 'unknown'.

2. Extract occasion, climate, budget, formality from the conversation.

3. Set is_ready_to_recommend = true ONLY when:
   - Segment is known (not 'unknown') AND
   - There's at least one specific intent (occasion, product type, or style preference)
   - CRITICAL OVERRIDE: If the user explicitly asks about, specifies, or names a particular product from KAZU's catalog (e.g. they say "Tell me more about...: Skinny Fit Dark Wash Jeans", "Stretch Slim Fit Chinos", etc., or name a specific SKU), you MUST set is_ready_to_recommend = true, extract the target segment from the product (e.g. 'Men' for chinos/jeans), set the search_query to that exact product title, and proceed directly to retriever. Do NOT ask clarifying questions when the user asks about a specific product.

4. Distinguish between adding to cart and direct checkout:
   - Set is_add_to_cart_requested = true if the customer asks to "add to cart", "add these to my bag/cart", "put all three in the cart", etc.
   - If is_add_to_cart_requested is true, analyze the dialogue history and latest message to find exactly WHICH specific products the user requested to add (e.g. they say 'add these 2 products' or specify particular items from the prior discussion). Populate only the matching product SKU/product IDs (e.g., ['SKU_019', 'SKU_009']) in target_skus_to_add. Do NOT blindly add all paired/complementary products unless they explicitly ask to add 'all' of them.
   - Set is_checkout_requested = true ONLY if the customer explicitly requests to "checkout", "buy", "pay", "checkout with Razorpay", or finalize the transaction immediately.

5. Synthesize a semantic search_query with 3-6 keywords that match KAZU's exact inventory.
   - For Men: use words like 'shirt', 'chinos', 'polo', 'sneakers', 'sunglasses'
   - For Women: use words like 'dress', 'blouse', 'wide-leg', 'sandals', 'tote'
   - For Kids: use words like 'kids tee', 'joggers', 'sneakers', 'hoodie'
   - For Beauty: use words like 'serum', 'lipstick', 'shampoo', 'perfume', 'face wash'

Return valid structured output.
"""

    router_usage = dict(ZERO_USAGE)
    try:
        structured_router = master_llm.with_structured_output(IntentParser, include_raw=True)
        out = await structured_router.ainvoke(prompt)
        parsed = out.get("parsed")
        if parsed is None:
            raise ValueError(f"structured intent parse failed: {out.get('parsing_error')}")
        intent_dict = parsed.model_dump()
        router_usage = _usage_dict(out.get("raw"))
    except Exception as parse_err:
        print(f"[router] Intent extraction failed ({parse_err}) — using heuristic fallback")

  
        # Fallback heuristic parser
        is_checkout = any(w in last_msg.lower() for w in ["buy", "checkout", "order", "purchase", "pay"])
        msg_lower = last_msg.lower()
        
        # Infer segment from keywords
        segment = prev_intent.get("target_segment") or "unknown"
        if any(w in msg_lower for w in ["serum", "moisturizer", "lipstick", "mascara", "shampoo", "perfume", "skincare", "makeup", "hair oil", "face wash", "sunscreen", "eyeliner", "grooming", "shaving"]):
            segment = "Beauty"
        elif any(w in msg_lower for w in ["kid", "son", "daughter", "child", "boy", "girl", "baby", "toddler"]):
            segment = "Kids"
        elif any(w in msg_lower for w in ["dress", "blouse", "skirt", "maxi", "co-ord", "kurta", "her", "she", "women"]):
            segment = "Women"
        elif any(w in msg_lower for w in ["shirt", "trouser", "polo", "chino", "sneaker", "loafer", "he", "men"]):
            segment = "Men"

        is_broad = any(last_msg.strip().lower().startswith(w) for w in [
            "hi", "hello", "hey", "help me shop", "show me", 
            "i need", "help me dress", "recommend", "something nice", "what do you have"
        ])
        is_direct_product = "tell me more about this" in last_msg.lower() or "suggest complete styling" in last_msg.lower()
        intent_dict = {
            "occasion": prev_intent.get("occasion") or "lifestyle dressing",
            "destination_climate": prev_intent.get("destination_climate") or "temperate",
            "target_delivery_date": prev_intent.get("target_delivery_date") or "express",
            "max_budget": prev_intent.get("max_budget"),
            "formality_level": prev_intent.get("formality_level") or "smart casual",
            "target_segment": segment,
            "search_query": last_msg,
            "is_ready_to_recommend": is_direct_product or (not is_broad and segment != "unknown"),
            "is_add_to_cart_requested": False,
            "is_checkout_requested": is_checkout,
            "target_skus_to_add": []
        }

    # Cumulative Intent Merge: Persist previous slots across turns
    merged_intent = {**prev_intent}
    for k, v in intent_dict.items():
        if v is not None and v != "" and v != "unknown":
            merged_intent[k] = v
    
    # Carry segment forward even if current turn doesn't re-assert it
    if not merged_intent.get("target_segment") or merged_intent.get("target_segment") == "unknown":
        if intent_dict.get("target_segment") and intent_dict["target_segment"] != "unknown":
            merged_intent["target_segment"] = intent_dict["target_segment"]
            
    # Explicit checkout requested takes precedence
    if intent_dict.get("is_checkout_requested"):
        merged_intent["is_checkout_requested"] = True

    # Reset the per-turn token counter (downstream nodes merge onto this)
    return {"intent": merged_intent, "token_usage": router_usage}

# -------------------------------------------------------------
# 2. Targeted Clarifier Node (clarifier_node)
# -------------------------------------------------------------
async def clarifier_node(state: AgentState) -> dict:
    history = state.get("messages", [])
    known_intent = state.get("intent", {})
    profile = state.get("customer_profile", {})
    segment = known_intent.get("target_segment") or "unknown"

    # Determine what category information to give the consultant
    segment_context = ""
    if segment == "Men":
        segment_context = "Men's range: Shirts, T-Shirts, Trousers, Shoes, and Sunglasses."
    elif segment == "Women":
        segment_context = "Women's range: Dresses, Tops, Wide-Leg Pants, Skirts, Shoes, Bags, and Sunglasses."
    elif segment == "Kids":
        segment_context = "Kids' range: Graphic Tees, Matching Sets, Hoodies, Denim Shorts, Joggers, Sneakers, Rain Boots, and Caps."
    elif segment == "Beauty":
        segment_context = "Beauty range: Skincare (serums, face wash, sunscreen, moisturizer), Makeup (lipstick, mascara, eyeliner), Hair Care (hair oil, shampoo), and Fragrances (EDP, body mist)."
    else:
        segment_context = "KAZU has four segments: Men's Fashion, Women's Fashion, Kids' Clothing, and Beauty & Personal Care."

    system_prompt = f"""
You are STYLO — KAZU's personal AI fashion and beauty consultant, speaking with a private client.

Core Directives:
1. KAZU has 4 segments: Men, Women, Kids, and Beauty. {segment_context}
2. If the client asks for something outside KAZU's catalog, politely redirect to the nearest relevant category.
3. If the client's segment is unknown, your FIRST priority is to determine who they are shopping for with one warm, natural question.
4. Never sound like automated support. Skip filler phrases ("Certainly!", "Sure thing!", "I can help!").
5. Ask at most 1-2 purposeful questions. Be conversational and warm.
6. If you already know the segment, dive straight into style clarifications (occasion, budget, preference).
"""

    user_context = f"""
Conversation so far:
{_trim_history(history)}

Customer Profile:
- Fit Preference: {profile.get('fit_preference', 'relaxed')}
- Excluded Colors: {profile.get('disliked_colors', [])}

Intent extracted so far:
{known_intent}

Task:
{"Since the segment is unknown, ask who they are shopping for in one warm, natural sentence. Then ask about occasion or style." if segment == "unknown" else f"The customer is shopping for the {segment} segment. Ask one focused question to clarify their occasion, style preference, or budget so you can make the ideal recommendation."}
"""

    res = await master_llm.ainvoke([
        {"role": "system", "content": system_prompt.strip()},
        {"role": "user", "content": user_context.strip()}
    ])

    return {
        "messages": [{"role": "assistant", "content": res.content}],
        "final_response": res.content,
        "token_usage": _merge_usage(state, _usage_dict(res))
    }


# -------------------------------------------------------------
# 3. Hybrid Candidate Retriever Node
# -------------------------------------------------------------
async def retriever_node(state: AgentState) -> dict:
    from catalog_store import search_candidate_products, get_all_catalog_products
    
    intent = state.get("intent", {})
    search_query = intent.get("search_query") or ""
    segment = intent.get("target_segment") or None
    
    if not search_query:
        search_query = f"{intent.get('occasion', '')} {intent.get('destination_climate', '')}".strip()
    if not search_query:
        search_query = "trending essential fashion"
        
    max_budget = intent.get("max_budget")
    
    # Retrieve top 8 candidates scoped to the identified segment
    candidates = search_candidate_products(
        query=search_query,
        max_budget=max_budget,
        segment=segment,
        top_k=8
    )
    
    # Fallback if budget filter excluded too many candidates
    if len(candidates) < 4 and max_budget:
        candidates = search_candidate_products(
            query=search_query,
            max_budget=None,
            segment=segment,
            top_k=8
        )
        
    # Fallback if segment filter still yields too few — search without segment filter
    if len(candidates) < 4 and segment:
        candidates = search_candidate_products(
            query=search_query,
            max_budget=max_budget,
            segment=None,
            top_k=8
        )
        
    # Final fallback: pull all products for the segment
    if len(candidates) < 4:
        all_prods = get_all_catalog_products()
        existing_ids = {c["sku_id"] for c in candidates}
        for p in all_prods:
            if p["sku_id"] not in existing_ids:
                # Prefer matching segment
                p_seg = p["metadata"].get("segment", "").lower()
                if not segment or p_seg == (segment or "").lower():
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
    recommended_size: str = Field(description="e.g. M, L, XL, 32, Standard Fit, 30ml")
    fit_confidence: float = Field(description="Confidence between 0.0 and 1.0")
    reasoning: str = Field(description="Tailored cut, silhouette, or product usage rationale")

class FabricVerdict(BaseModel):
    climate_pass: bool = Field(description="True if the product comfortably suits the climate/setting; False if incompatible")
    wrinkle_risk: str = Field(description="Low, Moderate, or High / N/A for non-apparel items")
    comfort_notes: str = Field(description="Technical notes on breathability, weight, or product suitability for the setting")

class StylistVerdict(BaseModel):
    paired_categories: List[str] = Field(description="Complementary product categories for a complete look or routine")
    styling_tips: str = Field(description="Editorial advice on how to wear, apply, or style this product")
    pairing_rationale: str = Field(description="Why these pairings work together — texture, color harmony, or routine synergy")

# 5.1 Size & Fit Specialist
async def size_worker_task(sku: dict, profile: dict) -> dict:
    meta = sku.get("metadata", {})
    segment = meta.get("segment", "Men")
    prompt = f"""
You are a product specialist. Evaluate the right size/variant for this customer. Return valid JSON only.

Product Details:
- Title: {meta.get('title')}
- Category: {meta.get('sub_category', 'Fashion')}
- Segment: {segment}
- Fit Type: {meta.get('fit_type', 'regular')}
- Size Options: {meta.get('size_options', [])}

Customer Profile:
- Fit Preference: {profile.get('fit_preference', 'relaxed')}
- Size History: {profile.get('size_history', {})}

For beauty/skincare, return standard size. For kids' items, infer age group if known.
"""
    try:
        llm = worker_llm.with_structured_output(SizeVerdict, include_raw=True)
        out = await llm.ainvoke(prompt)
        if out.get("parsed") is None:
            raise ValueError(f"structured parse failed: {out.get('parsing_error')}")
        return out["parsed"].model_dump(), _usage_dict(out.get("raw"))
    except Exception as e:
        print(f"[size_worker] LLM evaluation failed for {meta.get('title')}: {e} — using flagged fallback verdict")
        return {
            "recommended_size": profile.get("size_history", {}).get("tops", "M"),
            "fit_confidence": 0.5,
            "reasoning": f"Heuristic default for {meta.get('fit_type', 'regular')} fit (specialist evaluation unavailable).",
            "is_fallback": True
        }, dict(ZERO_USAGE)

# 5.2 Fabric & Climate Specialist
async def fabric_worker_task(sku: dict, climate: str) -> dict:
    meta = sku.get("metadata", {})
    segment = meta.get("segment", "Men")
    fabric_desc = meta.get("fabric", "Premium Material")
    gsm = meta.get("gsm", "N/A")
    prompt = f"""
You are a product material specialist. Evaluate suitability for the customer's setting. Return valid JSON only.

Product: {meta.get('title')}
Segment: {segment}
Material: {fabric_desc} (GSM: {gsm})
Customer Setting / Climate: {climate}

For apparel: assess breathability and climate viability.
For beauty products: climate_pass is always true. Assess shelf suitability.
For shoes/bags: assess durability and occasion fit.
"""
    try:
        llm = worker_llm.with_structured_output(FabricVerdict, include_raw=True)
        out = await llm.ainvoke(prompt)
        if out.get("parsed") is None:
            raise ValueError(f"structured parse failed: {out.get('parsing_error')}")
        return out["parsed"].model_dump(), _usage_dict(out.get("raw"))
    except Exception as e:
        print(f"[fabric_worker] LLM evaluation failed for {meta.get('title')}: {e} — using flagged fallback verdict")
        return {
            "climate_pass": True,
            "wrinkle_risk": "Low",
            "comfort_notes": f"Suitable {fabric_desc} for {climate} setting (textile specialist evaluation unavailable).",
            "is_fallback": True
        }, dict(ZERO_USAGE)

# 5.3 Stylist / Look Specialist
async def stylist_worker_task(sku: dict, occasion: str) -> dict:
    meta = sku.get("metadata", {})
    segment = meta.get("segment", "Men")
    prompt = f"""
You are an editorial stylist and beauty advisor. Generate pairing and styling advice. Return valid JSON only.

Anchor Product: {meta.get('title')}
Segment: {segment}
Colorway / Variant: {meta.get('color', 'Classic')}
Occasion / Setting: {occasion}

For apparel: suggest complementary pieces and how to wear.
For beauty: suggest complementary products in a routine or gifting set.
For accessories: suggest outfits or occasions this best suits.
"""
    try:
        llm = worker_llm.with_structured_output(StylistVerdict, include_raw=True)
        out = await llm.ainvoke(prompt)
        if out.get("parsed") is None:
            raise ValueError(f"structured parse failed: {out.get('parsing_error')}")
        return out["parsed"].model_dump(), _usage_dict(out.get("raw"))
    except Exception as e:
        print(f"[stylist_worker] LLM evaluation failed for {meta.get('title')}: {e} — using flagged fallback verdict")
        return {
            "paired_categories": ["complementary accessory", "classic essential"],
            "styling_tips": "Pair with minimal accessories for a clean, elevated look.",
            "pairing_rationale": "Balances the look with clean, harmonious elements.",
            "is_fallback": True
        }, dict(ZERO_USAGE)

async def worker_swarm_node(state: AgentState) -> dict:
    candidates = state.get("candidate_skus", [])
    if not candidates:
        # Retrieval found nothing — do NOT fabricate a catalog recommendation.
        # Return empty and let synthesis produce an honest out-of-stock response.
        print("[worker_swarm] No candidates from retriever — skipping evaluation, honest no-match response")
        return {"evaluations": [], "anchor_sku": None, "outfit": None, "token_usage": _merge_usage(state, ZERO_USAGE)}

    anchor = state.get("anchor_sku") or candidates[0]

    profile = state.get("customer_profile", {})
    climate = state.get("intent", {}).get("destination_climate") or "temperate"
    occasion = state.get("intent", {}).get("occasion") or "curated lifestyle"

    # Evaluate anchor with worker swarm
    (size_res, size_u), (fabric_res, fabric_u), (stylist_res, stylist_u) = await asyncio.gather(
        size_worker_task(anchor, profile),
        fabric_worker_task(anchor, climate),
        stylist_worker_task(anchor, occasion)
    )
    swarm_usages = [size_u, fabric_u, stylist_u]

    delivery_verdict = {
        "meets_deadline": True,
        "estimated_arrival": "2-3 business days (Express Delivery)",
        "warehouse": anchor["metadata"].get("warehouse", "BLR_CENTRAL_HUB")
    }

    # Handle climate viability & candidate failover (apparel only)
    alternative_eval = None
    segment = anchor["metadata"].get("segment", "Men")
    if segment in ("Men", "Women", "Kids") and not fabric_res.get("climate_pass", True) and len(candidates) > 1:
        for cand in candidates[1:]:
            cand_fabric = str(cand["metadata"].get("fabric", "")).lower()
            if any(k in cand_fabric for k in ["linen", "cotton", "silk", "blend", "lightweight", "chiffon", "canvas"]):
                (alt_size, alt_su), (alt_fabric, alt_fu), (alt_stylist, alt_sku_u) = await asyncio.gather(
                    size_worker_task(cand, profile),
                    fabric_worker_task(cand, climate),
                    stylist_worker_task(cand, occasion)
                )
                swarm_usages.extend([alt_su, alt_fu, alt_sku_u])
                if alt_fabric.get("climate_pass", True):
                    alternative_eval = {
                        "sku_id": anchor["sku_id"],
                        "size_verdict": size_res,
                        "fabric_verdict": fabric_res,
                        "delivery_verdict": delivery_verdict,
                        "pricing_verdict": {},
                        "is_disqualified": True,
                        "rejection_reason": f"Material ({anchor['metadata'].get('fabric')}) is heavy for {climate}."
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

    from catalog_store import search_candidate_products

    anchor_segment = anchor["metadata"].get("segment", "Men")
    anchor_title = anchor["metadata"].get("title", "")
    comp_query = f"complementary items that pair well with {anchor_title} in {anchor_segment} fashion"
    
    paired_candidates = search_candidate_products(comp_query, n_results=5, segment=anchor_segment)
    paired_skus = [c for c in paired_candidates if c["sku_id"] != anchor["sku_id"]][:4]
    
    if not paired_skus:
        paired_skus = [c for c in candidates if c["sku_id"] != anchor["sku_id"]][:4]
        
    outfit = {
        "anchor_sku_id": anchor["sku_id"],
        "paired_skus": paired_skus,
        "styling_instructions": stylist_res.get("styling_tips", ""),
        "pairing_rationale": stylist_res.get("pairing_rationale", "")
    }

    return {
        "anchor_sku": anchor,
        "evaluations": eval_list,
        "outfit": outfit,
        "token_usage": _merge_usage(state, _sum_usages(swarm_usages))
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
    
    # Check if user mentioned a promo code in their LATEST message only —
    # scanning the full checkpointed history made coupons stick to every
    # subsequent recommendation in the session.
    last_user_msg = next(
        (str(m.get("content", "")) for m in reversed(state.get("messages", [])) if m.get("role") == "user"),
        ""
    ).upper()
    if "STYLE20" in last_user_msg:
        coupon = "STYLE20"
    elif "AURA10" in last_user_msg:
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
        intent = state.get("intent") or {}
        if intent.get("is_ready_to_recommend") or intent.get("is_add_to_cart_requested"):
            # Retrieval ran but surfaced no match — be honest instead of fabricating.
            honesty_msg = (
                "I searched the KAZU catalog for that, but we don't currently stock a piece that fits your request. "
                "If you'd like, I can suggest the closest alternatives from our Men's collection, or something entirely different."
            )
            return {"final_response": honesty_msg}
        return {"final_response": "I'm ready to curate your selection. Who are we shopping for today — yourself, a partner, kids, or are you looking for beauty essentials?"}

    latest_eval = state["evaluations"][0]
    pricing = state.get("pricing_result", {})
    anchor = state["anchor_sku"]
    meta = anchor["metadata"]
    outfit = state.get("outfit") or {}
    intent = state.get("intent", {})
    profile = state.get("customer_profile", {})
    segment = meta.get("segment", "Men")
    active_cart = profile.get("cart") or []
    active_cart_text = ", ".join([f"{item['product_id']} (size: {item['size']})" for item in active_cart]) if active_cart else "Empty"

    base_price = pricing.get("base_price", meta.get("price", 0))
    final_price = pricing.get("final_price", base_price)
    coupon = pricing.get("coupon_code", "NONE")
    
    # Complementary pieces — just names, no price dump
    paired_items = outfit.get("paired_skus", [])
    paired_titles = [f"{p['metadata'].get('title')} (₹{p['metadata'].get('price')})" for p in paired_items[:4]]
    paired_summary = ", ".join(paired_titles) if paired_titles else "curated complementary pieces"

    # Build segment-specific persona for the synthesis
    if segment == "Beauty":
        persona = "beauty advisor and skincare specialist"
        context_label = "Skin Type / Setting"
        context_value = intent.get("occasion", "daily routine")
    elif segment == "Kids":
        persona = "kids' fashion expert and parent advisor"
        context_label = "Age Group / Occasion"
        context_value = intent.get("occasion", "everyday school and play")
    elif segment == "Women":
        persona = "personal stylist for women's fashion"
        context_label = "Occasion"
        context_value = intent.get("occasion", "curated lifestyle")
    else:
        persona = "personal fashion consultant"
        context_label = "Occasion"
        context_value = intent.get("occasion", "curated lifestyle")

    alt_eval = state["evaluations"][1] if len(state["evaluations"]) > 1 else None
    alt_note = ""
    if alt_eval and alt_eval.get("is_disqualified"):
        alt_note = f"\nNote: We also examined an alternative, but its heavier material is less suited for {intent.get('destination_climate', 'this setting')}."

    cart_instruction = ""
    if intent.get("is_add_to_cart_requested"):
        cart_instruction = (
            "\n- THE CLIENT HAS REQUESTED TO ADD ITEMS FROM THIS SELECTION TO THEIR CART. "
            "Start your response by confirming that the pieces they asked for are now in their "
            "KAZU shopping bag (they can review them in the shopping bag drawer). Only claim "
            "the items they explicitly requested — do NOT claim you added every complementary piece "
            "or any item they did not ask for."
        )

    prompt = f"""
You are a discerning {persona} for KAZU Atelier curating a selection for a private client.

Stylist Rules:
- BE EXTREMELY CONCISE. Tell only what is needed. Do not output a wall of text. Speak like a high-end expert who values the client's time.
{cart_instruction}
- Prohibited phrases: "Recommended for you", "I have selected", "Here is your", "Hope this helps!", "Let me know if you need anything else!".
- Jump straight into the styling vision: Start with how the anchor product solves their specific need in 1-2 short sentences.
- Weave in complementary products naturally as part of the complete look or routine (max 1 sentence).
- Financial clarity: Mention pricing and coupon savings smoothly.
- Tone: Sophisticated, warm, expert-level. Like talking to a trusted stylist.
- AT THE VERY END of your response, you MUST provide exactly 3 suggested follow-up questions the user might ask next. Format them like this:
IDEAS:
- [Question 1]
- [Question 2]
- [Question 3]

Client Context:
- {context_label}: {context_value}
- Climate/Setting: {intent.get('destination_climate', 'temperate')}
- Fit / Style Preference: {profile.get('fit_preference', 'relaxed')}
- Active Cart Contents: {active_cart_text}

Anchor Product:
- Title: {meta.get('title')}
- Segment: {segment}
- Price: ₹{base_price} → ₹{final_price} (Coupon: {coupon})
- Material: {meta.get('fabric', 'Premium Material')} ({meta.get('gsm', 'N/A')} GSM)

Specialist Verdicts:
- Size/Fit: {latest_eval.get('size_verdict', {}).get('recommended_size', 'Standard')} — {latest_eval.get('size_verdict', {}).get('reasoning', '')}
- Material Notes: {latest_eval.get('fabric_verdict', {}).get('comfort_notes', '')} | Wrinkle/Quality Risk: {latest_eval.get('fabric_verdict', {}).get('wrinkle_risk', 'Low')}
- Delivery: {latest_eval.get('delivery_verdict', {}).get('estimated_arrival', '2-3 business days')}

Complete Look / Routine:
- Styling Tips: {outfit.get('styling_instructions', '')}
- Pairing Rationale: {outfit.get('pairing_rationale', '')}
- Complementary Picks: {paired_summary}
{alt_note}
"""

    res = await master_llm.ainvoke(prompt, config={"run_name": "synthesis_llm"})
    content = res.content
    
    suggested_questions = []
    final_text = content
    if "IDEAS:" in content:
        parts = content.split("IDEAS:")
        final_text = parts[0].strip()
        ideas_text = parts[1].strip()
        # parse lines starting with - or *
        for line in ideas_text.split("\n"):
            line = line.strip()
            if line.startswith("-") or line.startswith("*"):
                suggested_questions.append(line.lstrip("-* ").strip())
    
    # Fallback if parsing fails
    if len(suggested_questions) < 3:
        if segment == "Beauty":
            suggested_questions = ["What's a good nighttime routine?", "Is this suitable for sensitive skin?", "Suggest a hydrating serum."]
        else:
            suggested_questions = ["What shoes go with this?", "Is the fit true to size?", "Show me some accessories."]

    return {
        "messages": [{"role": "assistant", "content": final_text}],
        "final_response": final_text,
        "suggested_questions": suggested_questions[:3],
        "token_usage": _merge_usage(state, _usage_dict(res))
    }

# -------------------------------------------------------------
# 7. Deterministic Checkout Node (razorpay_checkout_node)
# -------------------------------------------------------------
async def razorpay_checkout_node(state: AgentState) -> dict:
    import time
    import uuid
    from checkout_service import create_frozen_razorpay_order
    from db import SessionLocal, Order, User

    pricing = state.get("pricing_result") or {}
    final_total = pricing.get("final_price", 0)
    coupon_code = pricing.get("coupon_code", "NONE")
    anchor = state.get("anchor_sku")
    paired_list = [
        p.get("sku_id")
        for p in (state.get("outfit") or {}).get("paired_skus", [])
        if p.get("sku_id")
    ]

    cart_payload = {
        "user_id": state["customer_profile"]["user_id"],
        "anchor_sku": anchor["sku_id"] if anchor else "SKU_GENERIC",
        "paired_skus": paired_list,
        "final_total": final_total,
        "coupon": coupon_code,
        "timestamp": int(time.time())
    }

    razorpay_order = create_frozen_razorpay_order(cart_payload)

    # Persist the order history record immediately so /api/checkout/verify can
    # resolve it and the transaction appears in /api/orders once paid.
    try:
        db = SessionLocal()
        try:
            user_id = cart_payload["user_id"] or "usr_guest"
            if not db.query(User).filter_by(user_id=user_id).first():
                if db.query(User).filter_by(user_id="usr_local_dev").first():
                    user_id = "usr_local_dev"
                else:
                    user = User(
                        user_id=user_id,
                        username=f"guest_{uuid.uuid4().hex[:6]}",
                        email=f"{user_id}@example.com"
                    )
                    db.add(user)
                    db.commit()
            db_order = Order(
                order_id=f"ord_{uuid.uuid4().hex[:12]}",
                user_id=user_id,
                anchor_sku=cart_payload["anchor_sku"],
                paired_skus=paired_list,
                amount=float(final_total),
                currency=razorpay_order.get("currency", "INR"),
                status="created",
                coupon=coupon_code,
                razorpay_order_id=razorpay_order.get("id"),
                receipt=razorpay_order.get("receipt"),
                notes={"is_mock": razorpay_order.get("is_mock", False)}
            )
            db.add(db_order)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        # Order persistence must never crash the chat turn
        print(f"[razorpay_checkout_node] Failed to persist order history: {e}")

    msg = f"Your selection is curated and your order is locked at ₹{final_total} (using code {coupon_code}). Opening KAZU secure checkout powered by Razorpay."
    
    return {
        "checkout_ready": True,
        "razorpay_order": razorpay_order,
        "messages": [{"role": "assistant", "content": msg}],
        "final_response": msg
    }