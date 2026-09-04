"""
catalog_store.py — Product Catalog & Semantic Retrieval Layer

Uses ChromaDB (ephemeral) + sentence-transformers for embedding-based
product search backed by the SQLAlchemy `products` table in PostgreSQL (Supabase).
"""

import warnings
import os
import logging
import chromadb
from typing import List, Dict, Any, Optional

# Suppress Hugging Face unauthenticated request warnings
warnings.filterwarnings("ignore", message=".*unauthenticated requests to the HF Hub.*")
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import joinedload
from db import SessionLocal, Product

# ---------------------------------------------------------------
# Embedding Model (lightweight, CPU-friendly, zero API cost)
# ---------------------------------------------------------------
_embed_model = SentenceTransformer("all-MiniLM-L6-v2")


class EmbeddingFunction(chromadb.EmbeddingFunction):
    """Adapter to plug sentence-transformers into ChromaDB."""
    def __call__(self, input: list[str]) -> list[list[float]]:
        return _embed_model.encode(input, convert_to_numpy=True).tolist()


# ---------------------------------------------------------------
# ChromaDB Client & Collection Setup
# ---------------------------------------------------------------
_client = chromadb.Client()
_collection = _client.get_or_create_collection(
    name="ecommerce_catalog_v2_segments",
    embedding_function=EmbeddingFunction()
)


def _load_products_from_db() -> List[Dict[str, Any]]:
    """Fetch active products from SQLAlchemy DB and convert to catalog format."""
    db = SessionLocal()
    try:
        products = (
            db.query(Product)
            .options(joinedload(Product.sub_category))
            .filter(Product.is_active == True)
            .all()
        )
        return [p.to_catalog_item() for p in products]
    finally:
        db.close()


def _seed_if_empty():
    """Ensure ChromaDB index is populated with current active DB products."""
    if _collection.count() == 0:
        catalog_items = _load_products_from_db()
        if catalog_items:
            _collection.add(
                ids=[item["sku_id"] for item in catalog_items],
                documents=[item["document"] for item in catalog_items],
                metadatas=[item["metadata"] for item in catalog_items],
            )


def rebuild_index():
    """Force-rebuild the ChromaDB index from DB. Call after re-seeding."""
    global _collection
    try:
        _client.delete_collection("ecommerce_catalog_v2_segments")
    except Exception:
        pass
    _collection = _client.get_or_create_collection(
        name="ecommerce_catalog_v2_segments",
        embedding_function=EmbeddingFunction()
    )
    catalog_items = _load_products_from_db()
    if catalog_items:
        _collection.add(
            ids=[item["sku_id"] for item in catalog_items],
            documents=[item["document"] for item in catalog_items],
            metadatas=[item["metadata"] for item in catalog_items],
        )
    return len(catalog_items)


# ---------------------------------------------------------------
# Public API
# ---------------------------------------------------------------
def search_candidate_products(
    query: str,
    max_budget: Optional[float] = None,
    segment: Optional[str] = None,
    top_k: int = 6
) -> List[Dict[str, Any]]:
    """
    Semantic search over active product catalog.

    Args:
        query: Natural language search string (e.g., "breathable linen shirt").
        max_budget: Optional max price filter (INR). Applied post-retrieval.
        segment: Optional segment filter — "Men", "Women", "Kids", "Beauty".
        top_k: Max number of candidates to return.

    Returns:
        List of dicts with shape {"sku_id": str, "metadata": dict, "score": float}
    """
    _seed_if_empty()

    fetch_k = min(top_k * 4, _collection.count())
    if fetch_k == 0:
        return []

    # Build ChromaDB where filter if segment is specified
    where_filter = None
    if segment and segment.lower() not in ("all", "unknown", ""):
        # Normalize to title-case to match stored values
        seg_normalized = segment.title()
        where_filter = {"segment": {"$eq": seg_normalized}}

    query_kwargs = {
        "query_texts": [query],
        "n_results": fetch_k,
    }
    if where_filter:
        query_kwargs["where"] = where_filter

    try:
        results = _collection.query(**query_kwargs)
    except Exception:
        # Fallback without filter if ChromaDB rejects the where clause
        results = _collection.query(
            query_texts=[query],
            n_results=fetch_k,
        )

    candidates = []
    ids = results["ids"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for sku_id, metadata, distance in zip(ids, metadatas, distances):
        try:
            price = float(metadata.get("price", 0))
        except (ValueError, TypeError):
            price = 0.0

        # Budget filter (post-retrieval)
        if max_budget is not None and price > max_budget:
            continue

        # Soft segment filter fallback (in case ChromaDB filter wasn't applied)
        if segment and segment.lower() not in ("all", "unknown", ""):
            item_segment = metadata.get("segment", "").lower()
            if item_segment and item_segment != segment.lower():
                continue

        candidates.append({
            "sku_id": sku_id,
            "metadata": metadata,
            "score": round(1 - distance, 4)  # Convert distance to similarity
        })

        if len(candidates) >= top_k:
            break

    return candidates


def get_all_catalog_products() -> List[Dict[str, Any]]:
    """Return all active products from DB for storefront rendering."""
    _seed_if_empty()
    return _load_products_from_db()


def get_products_by_segment(segment: str) -> List[Dict[str, Any]]:
    """Return all active products for a given segment (Men/Women/Kids/Beauty)."""
    _seed_if_empty()
    all_products = _load_products_from_db()
    if not segment or segment.lower() == "all":
        return all_products
    return [
        p for p in all_products
        if p["metadata"].get("segment", "").lower() == segment.lower()
    ]
