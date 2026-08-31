"""
checkout_service.py — Razorpay Order Creation & Cart Freeze

Creates a Razorpay Standard order via the official SDK.
Falls back to a mock when Razorpay keys aren't configured (local dev).
"""

import os
import uuid
import time
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# Only initialize the real client if keys are present and non-placeholder
_USE_MOCK = (
    not RAZORPAY_KEY_ID
    or not RAZORPAY_KEY_SECRET
    or RAZORPAY_KEY_ID.startswith("rzp_test_REPLACE")
    or RAZORPAY_KEY_SECRET == "REPLACE_ME_SECRET"
)

_razorpay_client = None
if not _USE_MOCK:
    try:
        import razorpay
        _razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except ImportError:
        print("[checkout_service] razorpay package not installed — using mock mode")
        _USE_MOCK = True


def create_frozen_razorpay_order(cart_payload: dict) -> dict:
    """
    Freeze the cart and create a Razorpay order.

    Args:
        cart_payload: Dict with keys:
            - user_id (str)
            - anchor_sku (str)
            - paired_skus (list[str])
            - final_total (float) — amount in INR
            - coupon (str)
            - timestamp (int)

    Returns:
        Dict with order details (id, amount, currency, status, receipt).
        In mock mode, returns a simulated order for local testing.
    """
    amount_paise = int(cart_payload["final_total"] * 100)  # Razorpay uses paise
    receipt_id = f"rcpt_{cart_payload['user_id']}_{int(time.time())}"

    if _USE_MOCK:
        return _create_mock_order(cart_payload, amount_paise, receipt_id)

    # --- Real Razorpay order creation ---
    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt_id,
        "notes": {
            "user_id": cart_payload["user_id"],
            "anchor_sku": cart_payload["anchor_sku"],
            "coupon": cart_payload.get("coupon", "NONE"),
        }
    }

    order = _razorpay_client.order.create(data=order_data)

    return {
        "id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "status": order["status"],
        "receipt": order["receipt"],
        "razorpay_key_id": RAZORPAY_KEY_ID,  # Needed by frontend checkout modal
        "is_mock": False
    }


def _create_mock_order(cart_payload: dict, amount_paise: int, receipt_id: str) -> dict:
    """Simulated Razorpay order for local development."""
    mock_order_id = f"order_mock_{uuid.uuid4().hex[:16]}"

    print(f"[checkout_service] MOCK MODE — Razorpay keys not configured")
    print(f"  Order ID:  {mock_order_id}")
    print(f"  Amount:    ₹{cart_payload['final_total']} ({amount_paise} paise)")
    print(f"  Receipt:   {receipt_id}")
    print(f"  User:      {cart_payload['user_id']}")
    print(f"  SKU:       {cart_payload['anchor_sku']}")

    return {
        "id": mock_order_id,
        "amount": amount_paise,
        "currency": "INR",
        "status": "created",
        "receipt": receipt_id,
        "razorpay_key_id": "rzp_test_MOCK",
        "is_mock": True
    }
