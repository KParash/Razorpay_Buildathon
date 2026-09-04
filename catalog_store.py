"""
catalog_store.py — Product Catalog & Postgres-backed Search

Loads active products from PostgreSQL (Supabase) and ranks them in Python for
simple catalog search without a local vector database.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import joinedload

from db import SessionLocal, Product

_SEARCH_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
    "into", "is", "it", "of", "on", "or", "the", "to", "with", "this",
    "that", "these", "those", "your", "you", "me", "my", "our", "their",
    "pair", "pairs", "paired", "item", "items", "look", "wear", "style",
    "fashion", "product", "products", "best", "good", "nice", "complementary",
    "recommend", "recommended", "trending", "essential", "modern", "classic",
    "simple", "versatile", "perfect", "ideal", "try", "want",
}


def _normalize_segment(segment: Optional[str]) -> Optional[str]:
    if not segment or segment.lower() in {"all", "unknown"}:
        return None
    return segment.title()


def _load_products_from_db(segment: Optional[str] = None) -> List[Product]:
    """Fetch active products from SQLAlchemy DB."""
    db = SessionLocal()
    try:
        query = (
            db.query(Product)
            .options(joinedload(Product.sub_category))
            .filter(Product.is_active == True)
        )
        normalized_segment = _normalize_segment(segment)
        if normalized_segment:
            query = query.filter(Product.segment == normalized_segment)
        return query.order_by(Product.created_at.desc()).all()
    finally:
        db.close()


def _tokenize_query(query: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", (query or "").lower())
    return [token for token in tokens if token not in _SEARCH_STOPWORDS]


def _product_search_text(product: Product) -> str:
    sub_category = product.sub_category.name if product.sub_category else ""
    parts = [
        product.title or "",
        product.brand_name or "",
        product.description or "",
        product.document or "",
        product.segment or "",
        product.color or "",
        product.fit_type or "",
        product.fabric or "",
        sub_category,
    ]
    return " ".join(parts).lower()


def _score_product(product: Product, query_tokens: List[str], query_text: str) -> float:
    if not query_tokens:
        return 0.0

    title = (product.title or "").lower()
    brand = (product.brand_name or "").lower()
    description = (product.description or "").lower()
    document = (product.document or "").lower()
    searchable = _product_search_text(product)

    score = 0.0
    for token in query_tokens:
        if token in title:
            score += 4.0
        if token in brand:
            score += 3.0
        if token in description:
            score += 2.0
        if token in document:
            score += 1.0
        if token in searchable:
            score += 0.5

    # Boost exact phrase matches and close intent matches.
    if query_text and query_text in searchable:
        score += 8.0
    if product.segment and product.segment.lower() in query_text:
        score += 2.0

    return score


# ---------------------------------------------------------------
# Public API
# ---------------------------------------------------------------
def search_candidate_products(
    query: str,
    max_budget: Optional[float] = None,
    segment: Optional[str] = None,
    top_k: int = 6,
    n_results: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Search the active product catalog using simple Postgres-backed ranking.

    Args:
        query: Natural language search string.
        max_budget: Optional max price filter (INR).
        segment: Optional segment filter — Men, Women, Kids, or Beauty.
        top_k: Max number of candidates to return.
        n_results: Compatibility alias for older callers.

    Returns:
        List of dicts with shape {"sku_id": str, "metadata": dict, "score": float}
    """
    limit = n_results if n_results is not None else top_k
    normalized_segment = _normalize_segment(segment)
    query_text = (query or "").strip().lower()
    query_tokens = _tokenize_query(query)

    products = _load_products_from_db(normalized_segment)
    if not products:
        return []

    candidates = []
    for product in products:
        try:
            price = float(product.price or 0)
        except (TypeError, ValueError):
            price = 0.0

        if max_budget is not None and price > max_budget:
            continue

        score = _score_product(product, query_tokens, query_text)
        if score <= 0 and query_tokens:
            continue

        item = product.to_catalog_item()
        candidates.append((score, price, item))

    candidates.sort(key=lambda row: (-row[0], row[1], row[2]["sku_id"]))

    results: List[Dict[str, Any]] = []
    for score, _price, item in candidates[: max(limit, 0)]:
        results.append({
            "sku_id": item["sku_id"],
            "metadata": item["metadata"],
            "score": round(score, 4),
        })

    return results


def get_all_catalog_products() -> List[Dict[str, Any]]:
    """Return all active products from DB for storefront rendering."""
    return [product.to_catalog_item() for product in _load_products_from_db()]


def get_products_by_segment(segment: str) -> List[Dict[str, Any]]:
    """Return all active products for a given segment (Men/Women/Kids/Beauty)."""
    normalized_segment = _normalize_segment(segment)
    if not normalized_segment:
        return get_all_catalog_products()
    return [product.to_catalog_item() for product in _load_products_from_db(normalized_segment)]
