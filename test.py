import asyncio
import sys
from dotenv import load_dotenv

load_dotenv()

from graph import fashion_agent_graph

async def test_run():
    initial_state = {
        "messages": [{"role": "user", "content": "I need an outfit for an outdoor beach wedding in Goa under 4000."}],
        "customer_profile": {
            "user_id": "usr_77",
            "pincode": "403001",
            "fit_preference": "relaxed",
            "disliked_colors": ["neon"],
            "size_history": {"top": "L", "bottom": "34"},
            "budget_tier": "mid"
        },
        "intent": {},
        "candidate_skus": [],
        "anchor_sku": None,
        "outfit": None,
        "evaluations": [],
        "pricing_result": None,
        "final_response": None,
        "checkout_ready": False,
        "razorpay_order": None
    }

    # thread_id enables multi-turn state persistence via MemorySaver
    config = {"configurable": {"thread_id": "test_session_1"}}
    result = await fashion_agent_graph.ainvoke(initial_state, config=config)
    print("=== FINAL AGENT RESPONSE ===")
    try:
        print(result.get("final_response", ""))
    except UnicodeEncodeError:
        print(result.get("final_response", "").encode('ascii', 'replace').decode('ascii'))
    print("=== ANCHOR SKU ===")
    print(result.get("anchor_sku", {}).get("sku_id"), result.get("anchor_sku", {}).get("metadata", {}).get("title"))

if __name__ == "__main__":
    asyncio.run(test_run())