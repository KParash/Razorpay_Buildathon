"""
catalog_store.py — Product Catalog & Semantic Retrieval Layer

Uses ChromaDB (ephemeral) + sentence-transformers for embedding-based
product search with optional budget filtering.
"""

import warnings
import os
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
# Seed Catalog — 8 Fashion SKUs
# ---------------------------------------------------------------
SEED_CATALOG = [
    {
        "sku_id": "SKU_001",
        "document": "Linen mandarin-collar shirt for beach weddings and tropical occasions, breathable and relaxed fit",
        "metadata": {
            "title": "Ivory Linen Mandarin Collar Shirt",
            "fit_type": "relaxed",
            "fabric": "100% Linen",
            "gsm": "140",
            "color": "Ivory",
            "price": "2499",
            "warehouse": "BLR_HUB",
            "eligible_coupon": "STYLE20",
            "category": "tops"
        }
    },
    {
        "sku_id": "SKU_002",
        "document": "Cotton chino trousers beige casual smart for outdoor events and beach parties",
        "metadata": {
            "title": "Beige Cotton Chino Trousers",
            "fit_type": "slim",
            "fabric": "Cotton Twill",
            "gsm": "220",
            "color": "Beige",
            "price": "1899",
            "warehouse": "BLR_HUB",
            "eligible_coupon": "NONE",
            "category": "bottoms"
        }
    },
    {
        "sku_id": "SKU_003",
        "document": "Floral printed rayon camp collar Hawaiian shirt for vacation resort casual",
        "metadata": {
            "title": "Teal Floral Camp Collar Shirt",
            "fit_type": "relaxed",
            "fabric": "Rayon",
            "gsm": "130",
            "color": "Teal",
            "price": "1599",
            "warehouse": "MUM_HUB",
            "eligible_coupon": "STYLE20",
            "category": "tops"
        }
    },
    {
        "sku_id": "SKU_004",
        "document": "Tailored navy blazer structured formal evening cocktail party wedding reception",
        "metadata": {
            "title": "Navy Structured Linen Blazer",
            "fit_type": "tailored",
            "fabric": "Linen Blend",
            "gsm": "200",
            "color": "Navy",
            "price": "4999",
            "warehouse": "DEL_HUB",
            "eligible_coupon": "NONE",
            "category": "outerwear"
        }
    },
    {
        "sku_id": "SKU_005",
        "document": "White cotton polo t-shirt smart casual brunch date weekend outing",
        "metadata": {
            "title": "White Pique Cotton Polo",
            "fit_type": "regular",
            "fabric": "Cotton Pique",
            "gsm": "180",
            "color": "White",
            "price": "1299",
            "warehouse": "BLR_HUB",
            "eligible_coupon": "STYLE20",
            "category": "tops"
        }
    },
    {
        "sku_id": "SKU_006",
        "document": "Olive cargo jogger pants travel adventure outdoor hiking trekking casual",
        "metadata": {
            "title": "Olive Stretch Cargo Joggers",
            "fit_type": "relaxed",
            "fabric": "Cotton-Spandex",
            "gsm": "260",
            "color": "Olive",
            "price": "2199",
            "warehouse": "MUM_HUB",
            "eligible_coupon": "NONE",
            "category": "bottoms"
        }
    },
    {
        "sku_id": "SKU_007",
        "document": "Pastel lavender oversized linen shirt summer festival music concert relaxed",
        "metadata": {
            "title": "Lavender Oversized Linen Shirt",
            "fit_type": "oversized",
            "fabric": "100% Linen",
            "gsm": "135",
            "color": "Lavender",
            "price": "2299",
            "warehouse": "DEL_HUB",
            "eligible_coupon": "STYLE20",
            "category": "tops"
        }
    },
    {
        "sku_id": "SKU_008",
        "document": "Black formal dress trousers office meeting interview classic professional",
        "metadata": {
            "title": "Black Formal Pleated Trousers",
            "fit_type": "tailored",
            "fabric": "Polyester-Viscose",
            "gsm": "240",
            "color": "Black",
            "price": "2799",
            "warehouse": "DEL_HUB",
            "eligible_coupon": "NONE",
            "category": "bottoms"
        }
    }
]

# ---------------------------------------------------------------
# Initialize ChromaDB collection with seed data
# ---------------------------------------------------------------
_client = chromadb.Client()  # Ephemeral in-memory client
_collection = _client.get_or_create_collection(
    name="fashion_catalog",
    embedding_function=EmbeddingFunction()
)

def _seed_if_empty():
    """Seed the collection on first call."""
    if _collection.count() == 0:
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

