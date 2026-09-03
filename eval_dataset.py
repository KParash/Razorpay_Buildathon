"""
eval_dataset.py — Curated Evaluation Scenarios for Agentic E-Commerce System

Defines standard test cases across diverse user intents, categories, and constraints
to evaluate the LangGraph agent across multiple quality benchmarks.
"""

from typing import List, Dict, Any

EVALUATION_DATASET: List[Dict[str, Any]] = [
    {
        "id": "tc_01_beach_wedding",
        "name": "Beach Wedding in Goa (Budget & Climate Constraint)",
        "input_message": "I need a breathable linen outfit for an outdoor beach wedding in Goa under 4000.",
        "customer_profile": {
            "user_id": "usr_eval_1",
            "pincode": "403001",
            "fit_preference": "relaxed",
            "disliked_colors": ["neon"],
            "size_history": {"tops": "L", "bottoms": "34"},
            "budget_tier": "mid"
        },
        "expected_intent": {
            "is_ready_to_recommend": True,
            "max_budget": 4000.0,
            "expected_climate_keywords": ["tropical", "humid", "beach", "goa", "warm"]
        },
        "target_category": "Fashion & Apparel",
        "evaluation_criteria": {
            "budget_compliance": "Must recommend items priced <= ₹4000",
            "fabric_suitability": "Must evaluate linen or breathable lightweight textile",
            "persona_tone": "Must sound like an elite boutique stylist, not a robotic chatbot"
        }
    },
    {
        "id": "tc_02_cocktail_blazer",
        "name": "Rooftop Cocktail Party (Evening Formality)",
        "input_message": "Recommend a sharp evening look or structured blazer for a summer rooftop cocktail party.",
        "customer_profile": {
            "user_id": "usr_eval_2",
            "pincode": "110001",
            "fit_preference": "tailored",
            "disliked_colors": [],
            "size_history": {"tops": "M", "bottoms": "32"},
            "budget_tier": "luxury"
        },
        "expected_intent": {
            "is_ready_to_recommend": True,
            "expected_occasion": "cocktail party"
        },
        "target_category": "Fashion & Apparel",
        "evaluation_criteria": {
            "formality_match": "Must recommend evening-appropriate tailored/smart piece",
            "styling_masterclass": "Must provide concrete styling advice (cuffs, layering, footwear)"
        }
    },
    {
        "id": "tc_03_skincare_moisturizer",
        "name": "Skincare & Hydration (Cross-Category Beauty)",
        "input_message": "I have dry skin and need a deeply hydrating facial moisturizer for daily daily glow.",
        "customer_profile": {
            "user_id": "usr_eval_3",
            "pincode": "560001",
            "fit_preference": "standard",
            "disliked_colors": [],
            "size_history": {},
            "budget_tier": "mid"
        },
        "expected_intent": {
            "is_ready_to_recommend": True
        },
        "target_category": "Beauty & Personal Care",
        "evaluation_criteria": {
            "semantic_precision": "Must retrieve relevant skincare/moisturizer product from 50-item catalog",
            "product_fidelity": "Must explain nourishment and formula benefits accurately"
        }
    },
    {
        "id": "tc_04_wireless_audio",
        "name": "Wireless Audio Headphones (Electronics)",
        "input_message": "Suggest top-notch wireless bluetooth headphones for workouts and daily commuting.",
        "customer_profile": {
            "user_id": "usr_eval_4",
            "pincode": "400001",
            "fit_preference": "ergonomic",
            "disliked_colors": [],
            "size_history": {},
            "budget_tier": "high"
        },
        "expected_intent": {
            "is_ready_to_recommend": True
        },
        "target_category": "Electronics & Gadgets",
        "evaluation_criteria": {
            "semantic_precision": "Must retrieve audio/headphones from catalog",
            "feature_highlighting": "Must reference battery, wireless fidelity, or ergonomic fit"
        }
    },
    {
        "id": "tc_05_vague_needs_clarification",
        "name": "Ambiguous Query (Clarifier Routing)",
        "input_message": "Hi, I just want something nice to buy today.",
        "customer_profile": {
            "user_id": "usr_eval_5",
            "pincode": "560001",
            "fit_preference": "relaxed",
            "disliked_colors": [],
            "size_history": {"tops": "M", "bottoms": "32"},
            "budget_tier": "mid"
        },
        "expected_intent": {
            "is_ready_to_recommend": False
        },
        "target_category": "Any",
        "evaluation_criteria": {
            "conversational_inquiry": "Must ask evocative, inspiring styling questions without being pushy",
            "no_premature_checkout": "Must not trigger checkout or order creation prematurely"
        }
    },
    {
        "id": "tc_06_discount_coupon",
        "name": "Discount Hunter (STYLE20 Coupon)",
        "input_message": "Show me trending fashion pieces eligible for the STYLE20 discount coupon.",
        "customer_profile": {
            "user_id": "usr_eval_6",
            "pincode": "560001",
            "fit_preference": "relaxed",
            "disliked_colors": [],
            "size_history": {"tops": "M", "bottoms": "32"},
            "budget_tier": "mid"
        },
        "expected_intent": {
            "is_ready_to_recommend": True
        },
        "target_category": "Fashion & Apparel",
        "evaluation_criteria": {
            "discount_computation": "Pricing node must accurately apply 20% discount and show savings",
            "coupon_acknowledgement": "Synthesis should naturally highlight the STYLE20 privilege"
        }
    }
]
