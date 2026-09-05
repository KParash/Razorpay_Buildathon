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
│    /          → Home.tsx (Clean Editorial Landing Page)         │
│    /chat      → ChatPage.tsx (Full-Page Stylist Chat + Sidebar) │
│    /search    → SearchPage.tsx (Dedicated Catalog Search Grid)  │
│    /orders    → OrdersPage.tsx (Chronological Timeline Log)     │
│                                                                 │
│  Shared State:                                                  │
│    App.tsx manages: products[], cart[], searchQuery, isCartOpen  │
│    ThemeContext toggles .dark class on <html>                    │
│                                                                 │
│  Components:                                                    │
│    Navbar.tsx        → Search drawer, Cart badge, Orders CTA      │
│    ProductCard.tsx   → SKU card with image, fit badge, coupon    │
│    CartDrawer.tsx    → Slide-over cart with Razorpay checkout    │
│    OrdersPage.tsx    → Timeline of verified paid transactions    │
│    SearchPage.tsx    → Query matched grids with Segment filters  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (fetch)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI BACKEND (main.py, uvicorn :8000)                      │
│                                                                 │
│  Endpoints:                                                     │
│    GET  /api/products             → Fetch product catalog       │
│    GET  /api/products/search      → Token ranked search results │
│    POST /api/chat                 → LangGraph assistant swarm   │
│    GET  /api/chat/sessions        → Chat session directory      │
│    GET  /api/chat/history/:id     → Fetch multi-turn messages   │
│    DELETE /api/chat/sessions/:id  → Remove chat session         │
│    POST /api/checkout/create      → Register frozen order       │
│    POST /api/checkout/verify      → Cryptographic HMAC verify   │
│    GET  /api/cart                 → Retrieve persistent cart    │
│    POST /api/cart/add             → Save SKU & size to cart     │
│    POST /api/cart/remove          → Remove item from cart       │
│    POST /api/cart/clear           → Empty active cart rows      │
│    GET  /api/user/search-history  → Fetch recent search queries │
│    POST /api/user/search-history  → Append unique search terms  │
│    GET  /api/orders               → Fetch paid purchase history │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Step-by-Step User Interaction Flow

1. **Page Load (`/`):** `App.tsx` fires `fetch('/api/products')` and `fetch('/api/cart?user_id=usr_guest')` concurrently. The catalog and user's saved persistent cart (with quantities and selected sizes) are retrieved from the database, eliminating cart loss on refreshes.
2. **Category Selection & Segment Locks:** The homepage renders four segment strip cards (MEN, WOMEN, KIDS, BEAUTY). Because only the Men's collection is in stock, clicking on WOMEN, KIDS, or BEAUTY cards is disabled (`cursor-not-allowed`) and displays a hover tooltip: `"Only Men's collection is available right now"`.
3. **Product Discovery & Search Page (`/search`):** Clicking the search icon opens the search drawer. Typing a keyword and pressing `Enter` closes the drawer and redirects the user to `/search` (e.g. results page), keeping the home page clean and static. The Search Page displays clickable chronological **Recent Searches** chips (representing the user's latest 5 queries fetched from the DB) for quick navigation.
4. **Interactive Product Cards:** Clicking on any available product image or title smoothly navigates to its dedicated `/product/:sku_id` details page. Un-available category cards apply a grayscale filter and display a tooltip warning on hover.
5. **Ask AI Stylist (from card/details):** Click "Style Advisor" or "Consult AI Stylist" to transition to `/chat` with a pre-filled Occasion/Fabric/Fit prompt.
6. **Chat Page (`/chat`):** Features a clean, distraction-free environment:
   - **Left Sidebar**: Keeps track of chat histories, "+ New Consultation", and "Stylist Specs" (fit preference and climate modifiers) inside one control drawer.
   - **Structured AI Cards**: If a recommendation is surfaced, it contains an inline product card. Clicking "Add to Cart" automatically pulls the AI-recommended size (`msg.evaluations[0].size_verdict.recommended_size`) and saves it directly to the user's persistent cart!
7. **Add to Cart & Coupon Sync:** Adding items from the product details page saves the specific selected size to the PostgreSQL database. Discount coupon inputs (such as `STYLE20` for 20% off) inside `CartDrawer.tsx` are persisted in browser `localStorage` and automatically cleared upon transaction success.
8. **Razorpay Checkout & Webhook Clears:** Clicking "Checkout" creates a frozen order record on the server, launching the Razorpay payment Sandbox. On successful signature verification (`POST /api/checkout/verify`), the backend:
   - Confirms order as `status="paid"` using HMAC-SHA256 verification.
   - **Wipes the user's active cart from the database**, and clears applied coupons from `localStorage`.
9. **Purchase History Timeline (`/orders`):** Users click `ORDERS` inside the navbar to view their purchase history. It queries `GET /api/orders` and renders all paid orders in a gorgeous vertical chronological timeline milestone view, with links back to the catalog items.

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
            ┌___________┼──────────────┐
            │ (conditional edge)        │
            ▼           ▼              ▼
    ┌────────────┐ ┌──────────┐ ┌───────────┐
    │  clarifier │ │ retriever│ │  checkout  │
    │            │ │          │ │            │
    │ Evocative  │ │ Postgres │ │ Razorpay   │
    │ styling Qs │ │ ranking  │ │ order      │
    │            │ │ search   │ │ freeze     │
    └─────┬──────┘ └────┬─────┘ └──────┬─────┘
          │              │              │
          ▼              │              ▼
         END             ▼             END
                ┌──────────────┐
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

---

## 3. Database & Storage Architecture

### 3.1 SQLAlchemy Models & Schema Definitions (`db.py`)

All transaction, chat history, catalog, and session state are persisted within PostgreSQL (Supabase) via SQLAlchemy ORM models:

*   **`users`**: Manages customer profiles, sizing history, liked/disliked parameters, and search query cache:
    *   `search_history`: JSON column storing the latest 5 queries chronologically.
*   **`cart_items`**: Manages persistent e-commerce baskets:
    *   `user_id`, `product_id`, `quantity`, and `size` (capturing chosen product sizing).
*   **`conversations`**: Stores multi-turn chat threads and message details.
*   **`products`**: Full e-commerce catalog storage.
*   **`orders`**: Keeps trace of frozen transactions, coupon details, amounts, and Razorpay signature verification parameters.

### 3.2 Database Bootstrapping and Dynamic Migrations
Our database architecture implements a safe, self-healing startup pipeline inside `db.py` to prevent structural mismatches on deployment:
- `_ensure_product_segment_column()`: Auto-backfills the legacy catalog table with the category segments.
- `_ensure_user_search_history_column()`: Automatically checks column descriptors on the `users` table and executes dynamic SQL (`ALTER TABLE users ADD COLUMN...`) if missing.

---

## 4. System Boundaries & Failure Points

### 4.1 Known Bottlenecks

| Boundary | Current State | Production Risk |
|---|---|---|
| **Product images** | Hardcoded `SKU_IMAGES` dictionary in `product.ts` maps SKU IDs to Unsplash URLs. | product discovery is visually dependent on fallback placeholders for unrecognized SKUs. |
| **Postgres-backed catalog search** | `catalog_store.py` ranks active products directly from PostgreSQL using deterministic query-token matching and optional segment/budget filters. | Simplistic query matching instead of vector semantic similarities. |
| **Groq free-tier rate limits** | `qwen/qwen3.8-27b` via Groq. 30 RPM on free tier. | Rate limit exhaustion on worker swarms degrades recommendation quality. |

### 4.2 Data Flow Boundaries

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
│    └─ Order creation and HMACS Cryptographic Verification    │
│                                                              │
│  Unsplash CDN (images.unsplash.com)                          │
│    └─ Product images (8 hardcoded, rest fallback)            │
│                                                              │
│  HuggingFace Hub (huggingface.co)                            │
│    └─ all-MiniLM-L6-v2 model weights (cached locally)       │
└──────────────────────────────────────────────────────────────┘
```
