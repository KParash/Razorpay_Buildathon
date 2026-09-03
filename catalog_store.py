"""
catalog_store.py — Product Catalog & Semantic Retrieval Layer

Uses ChromaDB (ephemeral) + sentence-transformers for embedding-based
product search with optional budget filtering.
"""

import warnings
import os
import json
import logging
import chromadb

# Suppress Hugging Face unauthenticated request warnings
warnings.filterwarnings("ignore", message=".*unauthenticated requests to the HF Hub.*")
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------
# Embedding Model (lightweight, CPU-friendly, zero API cost)
# ---------------------------------------------------------------
_embed_model = SentenceTransformer("all-MiniLM-L6-v2")

class EmbeddingFunction(chromadb.EmbeddingFunction):
    """Adapter to plug sentence-transformers into ChromaDB."""
    def __call__(self, input: list[str]) -> list[list[float]]:
        return _embed_model.encode(input, convert_to_numpy=True).tolist()

# ---------------------------------------------------------------
# Load Full 50-Product Catalog from JSON
# ---------------------------------------------------------------
CATALOG_FILE = os.path.join(os.path.dirname(__file__), "new_catalog.json")

def _load_catalog():
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[catalog_store] Error loading {CATALOG_FILE}: {e}")
    return []

SEED_CATALOG = _load_catalog()

# ---------------------------------------------------------------
# Initialize ChromaDB collection with seed data
# ---------------------------------------------------------------
_client = chromadb.Client()  # Ephemeral in-memory client
_collection = _client.get_or_create_collection(
    name="ecommerce_catalog_v5",
    embedding_function=EmbeddingFunction()
)

def _seed_if_empty():
    """Seed the collection on first call."""
    if _collection.count() == 0 and SEED_CATALOG:
        _collection.add(
            ids=[item["sku_id"] for item in SEED_CATALOG],
            documents=[item["document"] for item in SEED_CATALOG],
            metadatas=[item["metadata"] for item in SEED_CATALOG],
        )

# ---------------------------------------------------------------
# Public API
# ---------------------------------------------------------------
def search_candidate_products(
    query: str,
    max_budget: float | None = None,
    top_k: int = 5
) -> list[dict]:
    """
    Semantic search over the product catalog.

    Args:
        query: Natural language search string (e.g., "beach wedding tropical").
        max_budget: Optional max price filter (INR). Applied post-retrieval.
        top_k: Max number of candidates to return.

    Returns:
        List of dicts with shape {"sku_id": str, "metadata": dict, "score": float}
    """
    _seed_if_empty()

    # Retrieve more than top_k to allow for budget filtering
    fetch_k = min(top_k * 2, _collection.count())
    results = _collection.query(
        query_texts=[query],
        n_results=fetch_k
    )

    candidates = []
    ids = results["ids"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    for sku_id, metadata, distance in zip(ids, metadatas, distances):
        price = float(metadata["price"])

        # Budget filter
        if max_budget is not None and price > max_budget:
            continue

        candidates.append({
            "sku_id": sku_id,
            "metadata": metadata,
            "score": round(1 - distance, 4)  # Convert distance to similarity
        })

        if len(candidates) >= top_k:
            break

    return candidates

def get_all_catalog_products() -> list[dict]:
    """Return all products in the seed catalog for storefront rendering."""
    _seed_if_empty()
    return SEED_CATALOG
