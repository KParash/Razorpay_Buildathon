# System Architecture & Application Flow

> End-to-end lifecycle mapping for the Agentic E-Commerce Platform. Documents the user journey, AI execution graph, evaluation pipeline, and current system boundaries.

---

## 1. The User Journey

### 1.1 Frontend → Backend Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (React + Vite + Tailwind v4)                          │
│                                                                 │
│  Routes:                                                        │
│    /          → Home.tsx (Product Grid + Category Filters)       │
│    /chat      → ChatPage.tsx (Full-Page Stylist Chat + Sidebar) │
│                                                                 │
│  Shared State:                                                  │
│    App.tsx manages: products[], cart[], searchQuery, isCartOpen  │
│    ThemeContext toggles .dark class on <html>                    │
│                                                                 │
│  Components:                                                    │
│    Navbar.tsx        → Search bar, Cart icon, Chat CTA           │
│    ProductCard.tsx   → SKU card with image, fit badge, coupon    │
│    CartDrawer.tsx    → Slide-over cart with Razorpay checkout    │
│    ChatDrawer.tsx    → Lightweight side-panel chat (Home page)   │
│    ChatPage.tsx      → Full-page chat with history sidebar       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (fetch)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI BACKEND (main.py, uvicorn :8000)                      │
│                                                                 │
│  Endpoints:                                                     │
│    GET  /api/products           → catalog_store.get_all_...()   │
│    GET  /api/products/search    → catalog_store.search_...()    │
│    POST /api/chat               → graph.fashion_agent_graph     │
│    GET  /api/chat/sessions      → history_store sessions list   │
│    GET  /api/chat/history/:id   → history_store messages        │
│    DELETE /api/chat/sessions/:id→ history_store delete           │
│    POST /v1/chat/completions    → OpenAI-compat (LibreChat)     │
│    POST /api/checkout/create    → checkout_service order         │
│    POST /api/checkout/verify    → stub verification             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Step-by-Step User Interaction Flow

1. **Page Load (`/`):** `App.tsx` fires `fetch('/api/products')`. The backend calls `get_all_catalog_products()`, which returns the 50-item JSON catalog from ChromaDB's in-memory collection. Products render as a grid of `ProductCard` components.

2. **Product Discovery:** The user browses the grid. `Home.tsx` provides **dynamic category filters** (derived from catalog metadata) and a **search bar** that filters products client-side by title, category, fabric, and color.

3. **Ask AI Stylist (from card):** Each `ProductCard` has a floating "Ask AI Stylist" button. Clicking it navigates to `/chat` with the product title pre-filled as the initial query via `useLocation().state`.

4. **Chat Page (`/chat`):** The full-page `ChatPage.tsx` renders:
   - **Left sidebar:** Fetches session history from `GET /api/chat/sessions?user_id=usr_guest`. Displays session titles, timestamps, and message counts. Clicking a session loads its messages via `GET /api/chat/history/{session_id}`.
   - **Main chat pane:** User types a message → `POST /api/chat` with `{ message, session_id, customer_profile }`.

5. **Backend Processing:** `main.py` receives the request, persists the user message to `history_store`, invokes `fashion_agent_graph.ainvoke()`, persists the assistant response (including `recommendation`, `candidate_skus`, `evaluations`, `pricing_result`, and `checkout_ready`), then returns the full payload.

6. **Response Rendering:** `ChatPage.tsx` renders the assistant's prose response. If a `recommendation` object is present, it renders an **inline product card** with image, price, fabric, and fit details.

7. **Add to Cart:** The user clicks "Add to Cart" on either a `ProductCard` or an in-chat recommendation. The item is appended to the `cart[]` state in `App.tsx`.

8. **Checkout (`CartDrawer`):** Opening the cart drawer shows all items with a total. Clicking "Checkout with Razorpay" invokes `POST /api/checkout/create`, receives an order object, and calls `openRazorpayCheckout()` to launch the Razorpay payment modal.

---

## 2. The AI Execution Graph

### 2.1 LangGraph DAG Topology

```
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         │
                         ▼
                ┌────────────────┐
                │     router     │  master_router_node()
                │                │  → IntentParser (structured output)
                │                │  → Extracts: search_query, occasion,
                │                │    climate, budget, is_ready, checkout
                └───────┬────────┘
                        │
            ┌───────────┼──────────────┐
            │ (conditional edge)        │
            ▼           ▼              ▼
    ┌────────────┐ ┌──────────┐ ┌───────────┐
    │  clarifier │ │ retriever│ │  checkout  │
    │            │ │          │ │            │
    │ Evocative  │ │ ChromaDB │ │ Razorpay   │
    │ styling Qs │ │ semantic │ │ order      │
    └─────┬──────┘ │ search   │ │ freeze     │
          │        └────┬─────┘ └──────┬─────┘
          ▼             │              │
         END            ▼              ▼
                ┌──────────────┐      END
                │ worker_swarm │
                │              │
                │ asyncio.gather():
                │  ├─ size_worker_task
                │  ├─ fabric_worker_task
                │  └─ stylist_worker_task
                └───────┬──────┘
                        │
                        ▼
                ┌──────────────┐
                │   pricing    │
                │              │
                │ Deterministic│
                │ coupon calc  │
                │ (STYLE20/    │
                │  AURA10)     │
                └───────┬──────┘
                        │
                        ▼
                ┌──────────────┐
                │  synthesis   │
                │              │
                │ Category-    │
                │ aware prose  │
                │ generation   │
                └───────┬──────┘
                        │
                        ▼
                       END
```

### 2.2 Routing Logic (`route_after_input`)

The conditional edge from `router` inspects two fields on `AgentState`:

```python
def route_after_input(state: AgentState) -> str:
    intent = state["intent"]
    if intent.get("is_checkout_requested") and state.get("evaluations"):
        return "checkout"      # Prior recommendation exists → freeze order
    if intent.get("is_ready_to_recommend"):
        return "retriever"     # Sufficient clarity → search catalog
    return "clarifier"         # Ambiguous → ask styling questions
```

| Condition | Target Node | Example Query |
|---|---|---|
| `is_checkout_requested=True` AND `evaluations` exist | `checkout` | "I want to buy this" (after a prior recommendation) |
| `is_ready_to_recommend=True` | `retriever` | "Show me linen shirts for a beach wedding under 4000" |
| `is_ready_to_recommend=False` | `clarifier` | "Hi, I just want something nice to buy today" |

**Guard clause on checkout:** The checkout route requires `state.evaluations` to be non-empty. This prevents premature order creation when a user says "buy" before any product has been recommended.

### 2.3 Parallel Subagent Execution

`worker_swarm_node` runs 3 sub-agents concurrently via `asyncio.gather()`:

| Sub-Agent | Structured Output Model | Evaluates |
|---|---|---|
| `size_worker_task` | `SizeVerdict` (`recommended_size`, `fit_confidence`, `reasoning`) | Anchor SKU fit type vs. customer `size_history` and `fit_preference` |
| `fabric_worker_task` | `FabricVerdict` (`climate_pass`, `wrinkle_risk`, `comfort_notes`) | Material/formulation suitability for the extracted `destination_climate` |
| `stylist_worker_task` | `StylistVerdict` (`paired_categories`, `styling_tips`, `pairing_rationale`) | Outfit coordination and usage masterclass for the extracted `occasion` |

All three use `worker_llm` (T=0.1) with `with_structured_output()` for reliable JSON extraction. Each has a `try/except` fallback that returns sensible defaults if the LLM call fails.

### 2.4 Pricing & Coupon Engine

`pricing_node` is **fully deterministic** (no LLM):

```python
discount = 0.20 if coupon == "STYLE20" else (0.10 if coupon == "AURA10" else 0.0)
final_price = round(base_price * (1 - discount), 2)
```

**STYLE20 override:** If the user's message text contains "STYLE20" (case-insensitive), the pricing node forces `coupon = "STYLE20"` regardless of the product's `eligible_coupon` metadata. This enables the "discount hunter" user flow.

### 2.5 Category-Aware Synthesis

`synthesis_node` receives the full evaluation output and generates the final response. The prompt includes **category-specific guidelines**:
- **Fashion & Apparel:** Silhouettes, textile drape, occasion dress code, pairing.
- **Beauty & Skincare:** Ingredients, daily ritual, hydration barrier, radiant finish.
- **Electronics & Gadgets:** Acoustics, ergonomics, craftsmanship, commute/workout versatility.
- **Health / Home:** Wellness impact, build quality, daily integration.

---

## 3. The Evaluation Lifecycle

### 3.1 Pipeline Execution Flow

```
eval_pipeline.py
    │
    ├─ load_dotenv() → set LANGCHAIN_TRACING_V2=true
    ├─ Client() → verify LangSmith connection
    │
    ├─ FOR each test_case in EVALUATION_DATASET (6 scenarios):
    │   │
    │   ├─ Build initial AgentState with test input + customer_profile
    │   ├─ Generate unique session_id: eval_{tc_id}_{timestamp}
    │   ├─ Set config.tags = ["evaluation", tc_id, target_category]
    │   │
    │   ├─ fashion_agent_graph.ainvoke(state, config) → agent_res
    │   │   (Full LangGraph execution: router → retriever/clarifier →
    │   │    worker_swarm → pricing → synthesis)
    │   │
    │   ├─ DETERMINISTIC CHECKS:
    │   │   ├─ Route accuracy: intent.is_ready_to_recommend vs. expected
    │   │   └─ Budget compliance: anchor_sku.price ≤ expected max_budget
    │   │
    │   ├─ LLM-AS-A-JUDGE: judge_agent_response(tc, agent_res)
    │   │   ├─ Sends full agent output to judge_llm (T=0.0)
    │   │   ├─ Structured extraction → AgentEvaluationGrade
    │   │   └─ Returns: relevance, persona, recommendation, helpfulness,
    │   │              passed (avg ≥ 7.0), critique
    │   │
    │   └─ Append result to results[]
    │
    ├─ AGGREGATE: mean scores, pass rate, composite quality
    │
    ├─ WRITE: eval_results/eval_run_{timestamp}.json
    └─ WRITE: eval_results/latest_report.md
```

### 3.2 Test Scenario Coverage

| # | Scenario | Tests | Expected Route |
|---|---|---|---|
| 1 | Beach Wedding in Goa (≤ ₹4000) | Budget filtering, climate fabric match, persona tone | `retriever` |
| 2 | Rooftop Cocktail Party | Formality detection, structured outerwear recommendation | `retriever` |
| 3 | Skincare & Hydration | Cross-category (Beauty) semantic retrieval precision | `retriever` |
| 4 | Wireless Bluetooth Headphones | Cross-category (Electronics) retrieval and feature highlighting | `retriever` |
| 5 | Ambiguous "Something Nice" | Clarifier routing, no premature checkout, evocative questions | `clarifier` |
| 6 | Discount Hunter (STYLE20) | Coupon application, 20% discount computation, pricing output | `retriever` |

### 3.3 Output Artifacts

- **`eval_results/eval_run_{YYYYMMDD_HHMMSS}.json`** — Full structured benchmark data (per-scenario scores, critiques, SKU selections, response previews). Timestamped for regression tracking.
- **`eval_results/latest_report.md`** — Human-readable Markdown summary with quality dimension tables, per-scenario breakdown, and detailed evaluator critiques.

---

## 4. System Boundaries & Failure Points

### 4.1 Known Bottlenecks

| Boundary | Current State | Production Risk |
|---|---|---|
| **Product images** | Hardcoded `SKU_IMAGES` dictionary in [`product.ts`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/types/product.ts) maps 8 SKU IDs to Unsplash URLs. The 50-product catalog (`new_catalog.json`) includes `image_url` fields, but `getProductImage()` falls back to Unsplash for any SKU not in the map. | **42 of 50 products display the same fallback image.** Product discovery is visually broken for the majority of the catalog. |
| **ChromaDB ephemeral mode** | `chromadb.Client()` — in-memory, zero persistence. Collection re-indexed on each process restart. | Not viable beyond single-process development. Requires migration to `chromadb.PersistentClient()` or a hosted vector DB (Qdrant is already in `requirements.txt`). |
| **`MemorySaver` checkpointer** | In-memory. All multi-turn conversation state is lost on server restart. | Production requires `PostgresSaver` or `RedisSaver` for durable checkpoints. |
| **`chat_history.json` file store** | Single flat JSON file. No file-level locking. No rotation or pruning. | Concurrent requests can corrupt the file. Unbounded growth over time. |
| **Groq free-tier rate limits** | `qwen/qwen3.8-27b` via Groq. 30 RPM on free tier. The worker swarm fires 3 concurrent calls per recommendation. | Under concurrent users, rate limit exhaustion triggers cascading `except` fallbacks, degrading recommendation quality silently. |

### 4.2 Pending Integration Gaps

| Gap | Current Behavior | Impact |
|---|---|---|
| **Razorpay signature verification** | `POST /api/checkout/verify` returns `{"status": "success"}` unconditionally without validating `razorpay_signature` against `RAZORPAY_KEY_SECRET`. | **Critical security vulnerability.** An attacker can forge payment confirmation. |
| **Inventory management** | No stock tracking. "Frozen order" does not decrement inventory. | Double-selling of out-of-stock items in multi-user scenarios. |
| **No catalog category pre-filter** | ChromaDB `query()` searches the full 50-item collection by embedding similarity. No `where` clause filters by `metadata.category`. | Cross-category semantic bleeding: a query for "moisturizer" may surface fashion items with similar adjectives (e.g., "hydrating linen"). |
| **FALLBACK_PRODUCTS in App.tsx** | [`App.tsx`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/App.tsx) contains a hardcoded 8-item `FALLBACK_PRODUCTS` array (lines 9–114) used when `/api/products` fails. These are the original seed catalog SKUs, not the current 50-item catalog. | If the backend is unreachable, the frontend displays stale products that may not exist in ChromaDB. |
| **OpenAI-compat endpoint profile** | `POST /v1/chat/completions` uses a hardcoded `default_profile` (lines 206–213) with `fit_preference: "relaxed"` and `budget_tier: "mid"`. LibreChat users cannot customize their profile. | All LibreChat sessions produce recommendations calibrated for a single persona. |

### 4.3 Data Flow Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│ EXTERNAL DEPENDENCIES                                        │
│                                                              │
│  Groq API (api.groq.com/openai/v1)                          │
│    └─ qwen/qwen3.8-27b (master_llm T=0.3, worker_llm T=0.1)│
│                                                              │
│  LangSmith (api.smith.langchain.com)                         │
│    └─ Trace telemetry (async, non-blocking)                  │
│                                                              │
│  Razorpay SDK (razorpay.com)                                 │
│    └─ Order creation (mock mode when keys absent)            │
│                                                              │
│  Unsplash CDN (images.unsplash.com)                          │
│    └─ Product images (8 hardcoded, rest fallback)            │
│                                                              │
│  HuggingFace Hub (huggingface.co)                            │
│    └─ all-MiniLM-L6-v2 model weights (cached locally)       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ LOCAL PERSISTENCE (no external DB)                           │
│                                                              │
│  chat_history.json     → Session metadata + message logs     │
│  new_catalog.json      → 50-product source-of-truth catalog  │
│  eval_results/*.json   → Timestamped benchmark run data      │
│  eval_results/*.md     → Human-readable evaluation reports   │
│  ChromaDB (in-memory)  → Ephemeral vector index              │
│  MemorySaver (in-mem)  → LangGraph multi-turn checkpoints    │
└──────────────────────────────────────────────────────────────┘
```
