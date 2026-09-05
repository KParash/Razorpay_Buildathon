from typing import Annotated, List, Optional, Dict, Any
from typing_extensions import TypedDict
import operator

class CustomerProfile(TypedDict):
    user_id: str
    pincode: str
    fit_preference: str                  # "relaxed", "oversized", "tailored"
    disliked_colors: List[str]
    size_history: Dict[str, str]         # e.g., {"tops": "M", "bottoms": "32"}
    budget_tier: str

class IntentSlots(TypedDict):
    occasion: Optional[str]
    destination_climate: Optional[str]
    target_delivery_date: Optional[str]
    max_budget: Optional[float]
    formality_level: Optional[str]
    is_ready_to_recommend: bool
    is_checkout_requested: bool

class OutfitCoordination(TypedDict):
    anchor_sku_id: str
    paired_skus: List[Dict[str, Any]]
    styling_instructions: str
    pairing_rationale: str

class ProductEvaluation(TypedDict):
    sku_id: str
    size_verdict: Dict[str, Any]
    fabric_verdict: Dict[str, Any]
    delivery_verdict: Dict[str, Any]
    pricing_verdict: Dict[str, Any]
    is_disqualified: bool
    rejection_reason: Optional[str]

class TokenUsage(TypedDict, total=False):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

class AgentState(TypedDict):
    # Appends new messages to chat log
    messages: Annotated[List[Dict[str, str]], operator.add]
    customer_profile: CustomerProfile
    intent: IntentSlots
    candidate_skus: List[Dict[str, Any]]
    anchor_sku: Optional[Dict[str, Any]]
    outfit: Optional[OutfitCoordination]
    # Overwritten per turn (NOT appended) so synthesis/checkout always see the
    # current turn's verdicts; persists across turns via the checkpointer when
    # no node emits it (needed by the checkout-route guard).
    evaluations: List[ProductEvaluation]
    pricing_result: Optional[Dict[str, Any]]
    suggested_questions: Optional[List[str]]
    final_response: Optional[str]
    checkout_ready: bool
    razorpay_order: Optional[Dict[str, Any]]
    # Per-TURN token accounting (plain overwrite channel): the router resets it
    # each turn; downstream nodes merge their own usage onto the running total.
    token_usage: TokenUsage