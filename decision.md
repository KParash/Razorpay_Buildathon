# Architectural & Design Decisions

> Staff-level documentation of the engineering choices that shaped this production-grade AI e-commerce platform. Every entry follows a **What → Why → Trade-offs** structure.

---

## 1. Observability & Evaluation

### 1.1 LangSmith Tracing Integration

**What.** Every invocation of `fashion_agent_graph` (both the live `POST /api/chat` endpoint and the offline evaluation runner) emits structured traces to **LangSmith** via the `LANGCHAIN_TRACING_V2=true` environment flag. Traces are scoped to the `aura-fashion-agent` project. Each run carries per-request `tags` (e.g., `["evaluation", "tc_01_beach_wedding", "Fashion & Apparel"]`) and `metadata` dictionaries that propagate through every node in the LangGraph DAG.

**Why.** The agent pipeline executes 7 discrete nodes across two LLM temperature profiles (`master_llm` at `T=0.3`, `worker_llm` at `T=0.1`) and 3 parallel sub-agents. Without end-to-end telemetry, debugging a misrouted query or a hallucinated fabric verdict is intractable. LangSmith surfaces per-node latency, token counts, and raw prompt/completion pairs — making it possible to isolate regressions to a specific node (e.g., `retriever` returning off-category SKUs).

**Trade-offs.**
- **Network dependency:** Every LLM call adds an async POST to `api.smith.langchain.com`. In high-throughput production, this can be toggled off by unsetting `LANGCHAIN_TRACING_V2`.
- **API key exposure surface:** The `LANGCHAIN_API_KEY` is stored in `.env` files at both the workspace root and the project root. Both files are `.gitignore`d, but the dual-location is a maintenance concern.

---

### 1.2 Autonomous LLM-as-a-Judge Evaluation Pipeline

**What.** [`eval_pipeline.py`](file:///e:/Buildathon/Razorpay_Buildathon/eval_pipeline.py) implements a fully autonomous benchmark harness. It iterates over 6 curated scenarios defined in [`eval_dataset.py`](file:///e:/Buildathon/Razorpay_Buildathon/eval_dataset.py), invokes `fashion_agent_graph.ainvoke()` for each, then submits the full agent output (intent, anchor SKU, swarm evaluations, pricing, and synthesized text) to a **structured-output LLM judge** (`AgentEvaluationGrade` Pydantic model). The judge scores 4 orthogonal dimensions:

| Dimension | Measures | Scale |
|---|---|---|
| **Relevance** | Did the agent respect occasion, budget, product constraints? | 0–10 |
| **Persona** | Does the response feel like a boutique stylist vs. a generic chatbot? | 0–10 |
| **Recommendation Quality** | Is the product contextually appropriate? Are textile/formula notes accurate? | 0–10 |
| **Helpfulness** | Is the response structured, engaging, and actionable? | 0–10 |

Additionally, two **deterministic checks** are applied per scenario:
- **Route accuracy:** Did `route_after_input()` send the query to the expected node (`clarifier` vs. `retriever` vs. `checkout`)?
- **Budget compliance:** Is `anchor_sku.metadata.price ≤ expected_intent.max_budget`?

**Why.** Multi-agent LLM pipelines are **non-deterministic by construction**. The same input can yield different SKU retrievals, different fabric verdicts, and different synthesis prose across runs. Traditional unit tests cannot evaluate "did the stylist sound premium?" or "was the moisturizer recommendation clinically appropriate?". An LLM-as-a-Judge approach provides **scalable qualitative grading** that correlates with human preference, while deterministic checks enforce hard constraints (budget ceilings, routing correctness) that must never drift.

**Trade-offs.**
- **Judge bias:** The judge LLM (`qwen/qwen3.8-27b` at `T=0.0`) may exhibit systematic biases (e.g., inflating persona scores for verbose responses). Mitigation: the pipeline logs full critiques to JSON for human audit.
- **Cost per run:** Each evaluation invokes the agent graph (4–5 LLM calls) plus 1 judge call per scenario. At 6 scenarios, a full run costs ~36 LLM inferences against the Groq free tier.
- **Fallback grading:** If the judge fails structured extraction, `eval_pipeline.py` falls back to a static `8.0/10` grade (lines 91–100), which can silently mask quality regressions.

---

## 2. UI/UX Paradigm Shift

### 2.1 From "Cyber Glow" to Puma-Inspired Minimalism

**What.** The frontend underwent a complete visual overhaul from a neon-accented dark-mode "hacker aesthetic" to a high-contrast, minimalist **sports-retail design** inspired by Puma India. Key implementation details:
- **Tailwind v4 `@custom-variant`:** Theme toggling is implemented via `@custom-variant dark (&:where(.dark, .dark *));` in [`index.css`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/index.css), which scopes dark mode to the `.dark` class on `<html>` rather than relying on `prefers-color-scheme`.
- **CSS design tokens:** HSL-based custom properties (`--primary`, `--background`, `--card`, etc.) defined in `:root` provide a single source of truth consumed by every component.
- **Glassmorphism utilities:** `.glass-panel` and `.glass-card` classes apply `backdrop-filter: blur()` with semi-transparent backgrounds and subtle hover animations (`translateY(-2px)`, purple border glow).
- **Component-level theming:** Every component (`Navbar`, `ProductCard`, `CartDrawer`, `ChatPage`) uses explicit Tailwind `dark:` variants for bg, text, and border colors.

**Why.** The original cyber-glow aesthetic, while visually striking for demos, failed on two production criteria:
1. **Readability & accessibility:** Neon accents on dark backgrounds produced insufficient contrast ratios for body text (WCAG AA requires ≥ 4.5:1).
2. **Retail conversion credibility:** Research consistently shows that premium e-commerce platforms use restrained palettes with high white-space density. The Puma-inspired zinc/white palette conveys trust and product focus.

**Trade-offs.**
- **Glassmorphism remnants:** The `.glass-panel` and `.glass-card` utilities in `index.css` are holdovers from the original dark-mode design. They are still referenced by some components and work well in dark mode, but appear out of place on the light theme — a cleanup pass is needed.
- **Class-based dark mode vs. system preference:** The `@custom-variant` approach ignores `prefers-color-scheme`. Users who set system-level dark mode must manually toggle via the theme provider.

---

### 2.2 Chat Window Architecture

**What.** The chat experience is a **full-page dedicated route** (`/chat`) rendered by [`ChatPage.tsx`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/pages/ChatPage.tsx), not a sidebar overlay. It features:
- **Gemini-style history sidebar:** Collapsible left panel listing past sessions (fetched from `GET /api/chat/sessions`), with new-session creation, session deletion, and auto-titling from the first user message.
- **Slide-out settings drawer:** "Stylist & Swarm Specs" panel for fit preference controls and telemetry, repositioned from the main layout to an on-demand drawer.
- **Product image previews in-chat:** The `recommendation` object embedded in assistant messages renders inline product cards with `image_url` from the catalog metadata.

**Why.** A side-panel `ChatDrawer` (which still exists in `/components/ChatDrawer.tsx` for lightweight interactions on the Home page) was too constrained for multi-turn styling consultations. The full-page layout provides the vertical real estate needed for long-form synthesis responses and inline product cards.

**Trade-offs.**
- **Two chat surfaces:** `ChatDrawer.tsx` (15KB) and `ChatPage.tsx` (49KB) share similar logic but are not refactored into a shared hook or context. This is a DRY violation that increases maintenance cost.
- **No real-time streaming:** Both chat surfaces use `await fetch()` to `POST /api/chat`, waiting for the full agent response. There is no SSE/WebSocket stream-back for the primary chat endpoint (only the OpenAI-compatible `/v1/chat/completions` supports `stream: true`).

---

## 3. Agentic Framework

### 3.1 LangGraph for DAG Orchestration

**What.** The agent pipeline is a **LangGraph `StateGraph`** compiled with a `MemorySaver` checkpointer for multi-turn state persistence. The graph has 7 nodes:

| Node | Function | LLM Used |
|---|---|---|
| `router` | `master_router_node` — Structured intent extraction via `IntentParser` Pydantic model | `master_llm` (T=0.3) |
| `clarifier` | `clarifier_node` — Evocative styling questions for ambiguous queries | `master_llm` (T=0.3) |
| `retriever` | `retriever_node` — ChromaDB semantic search using `search_query` from intent | None (deterministic) |
| `worker_swarm` | `worker_swarm_node` — 3 parallel sub-agents: `size_worker`, `fabric_worker`, `stylist_worker` | `worker_llm` (T=0.1) |
| `pricing` | `pricing_node` — Deterministic coupon/discount computation | None (deterministic) |
| `synthesis` | `synthesis_node` — Category-aware prose generation with styling masterclass | `master_llm` (T=0.3) |
| `checkout` | `razorpay_checkout_node` — Frozen Razorpay order creation | None (deterministic) |

**Why LangGraph over vanilla LangChain `SequentialChain` or `AgentExecutor`:**
1. **Conditional routing:** `route_after_input()` inspects `intent.is_ready_to_recommend` and `intent.is_checkout_requested` to branch the DAG. This three-way conditional edge (`clarifier` / `retriever` / `checkout`) is a first-class primitive in LangGraph but requires manual orchestration in `AgentExecutor`.
2. **Parallel execution:** `worker_swarm_node` uses `asyncio.gather()` to run size, fabric, and stylist sub-agents concurrently. LangGraph's async-native execution model supports this natively.
3. **Stateful multi-turn:** `MemorySaver` checkpoints the full `AgentState` keyed by `thread_id` (session ID). Subsequent messages in the same session carry forward `candidate_skus`, `evaluations`, and `outfit` — enabling the checkout node to reference a previously recommended anchor SKU without re-retrieval.

**Trade-offs.**
- **In-memory checkpointer:** `MemorySaver()` is ephemeral. Server restarts lose all multi-turn state. A production deployment requires `PostgresSaver` or `RedisSaver`.
- **No re-ranking:** The retriever selects `anchor_sku = candidates[0]` — the top-1 result from ChromaDB cosine similarity. There is no LLM-powered re-ranking step to verify that the top candidate actually matches the extracted intent before passing it to the worker swarm.

---

### 3.2 Dual-Temperature LLM Strategy

**What.** Two `ChatOpenAI` instances share the same Groq-hosted model (`qwen/qwen3.8-27b`) but operate at different temperatures:
- **`master_llm` (T=0.3):** Used for intent parsing, clarifier dialogue, and synthesis. Higher temperature produces more creative, evocative styling prose.
- **`worker_llm` (T=0.1):** Used for the parallel swarm sub-agents (size, fabric, stylist verdicts). Lower temperature produces more consistent, deterministic structured output.

**Why.** The worker sub-agents emit structured Pydantic models (`SizeVerdict`, `FabricVerdict`, `StylistVerdict`) where JSON extraction reliability is paramount. Lower temperature reduces structural hallucinations. The synthesis node, conversely, benefits from controlled creativity to produce engaging boutique-stylist prose.

**Trade-offs.**
- **Single model, dual-role:** Both LLM instances hit the same Groq endpoint and model. Rate limiting on the Groq free tier (30 RPM) can cause cascading failures when the parallel swarm fires 3 concurrent calls immediately after the router call.

---

### 3.3 Catalog & Retrieval Layer

**What.** [`catalog_store.py`](file:///e:/Buildathon/Razorpay_Buildathon/catalog_store.py) loads a 50-product JSON catalog (`new_catalog.json`) sourced from an [external API](https://kolzsticks.github.io/Free-Ecommerce-Products-Api/main/products.json) into an **ephemeral ChromaDB** collection (`ecommerce_catalog_v5`). Embeddings are computed by **`all-MiniLM-L6-v2`** via `sentence-transformers` (CPU, zero API cost). Search uses cosine similarity with post-retrieval budget filtering.

**Why.** ChromaDB ephemeral mode eliminates infrastructure dependencies for local development and hackathon demos. The `all-MiniLM-L6-v2` encoder is 80MB, runs in <100ms on CPU, and produces 384-dimensional embeddings that perform well on short product descriptions.

**Trade-offs.**
- **Cold start on every process restart:** The collection is re-indexed on first query via `_seed_if_empty()`. With 50 products this takes ~3 seconds; at scale this is untenable.
- **No category-aware retrieval:** The embedding space conflates categories — a query for "hydrating moisturizer" may surface fashion items with similar adjectives. The `search_query` field in `IntentParser` partially mitigates this, but there is no metadata pre-filter by `category` on the ChromaDB query.

---

### 3.4 Session History & Persistence

**What.** [`history_store.py`](file:///e:/Buildathon/Razorpay_Buildathon/history_store.py) implements a **flat-file JSON persistence layer** (`chat_history.json`) storing sessions and messages keyed by `session_id`. Session titles are auto-generated from the first user message (truncated to 33 chars). The `main.py` server persists both user and assistant messages on every `POST /api/chat` invocation.

**Why.** JSON-file persistence was chosen for maximum simplicity — no database server, no ORM, no schema migrations. For a hackathon prototype with single-user local access, this is the fastest path to a working history sidebar.

**Trade-offs.**
- **No concurrency safety:** Multiple simultaneous requests can cause read-write races on `chat_history.json`. File-level locking is not implemented.
- **Unbounded growth:** The file grows monotonically. At ~45KB after moderate testing, it is manageable, but production use requires rotation or migration to SQLite/PostgreSQL.

---

### 3.5 Razorpay Checkout Integration

**What.** [`checkout_service.py`](file:///e:/Buildathon/Razorpay_Buildathon/checkout_service.py) exposes `create_frozen_razorpay_order()` which creates a real Razorpay order via the official SDK when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are configured, or falls back to a **mock order** (prefixed `order_mock_`) for local development. The mock path produces a structurally identical response with `is_mock: True`.

**Why.** The dual-mode design allows the full checkout flow (agent recommendation → cart freeze → order creation) to be exercised end-to-end without requiring real Razorpay credentials. The frontend `CartDrawer` renders a checkout button that invokes `openRazorpayCheckout()` from `lib/razorpay.ts`.

**Trade-offs.**
- **Payment verification is stubbed:** `POST /api/checkout/verify` always returns `{"status": "success"}` without actually validating the Razorpay signature. This is a **critical security gap** for production.
- **No inventory lock:** The "frozen order" does not decrement stock or reserve inventory. In a multi-user environment, two users could checkout the same last-in-stock item.
