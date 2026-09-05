# Architectural & Design Decisions

> Staff-level documentation of the engineering choices that shaped this production-grade AI e-commerce platform. Every entry follows a **What → Why → Trade-offs** structure.

---

## 1. Observability & Evaluation

### 1.1 LangSmith Tracing Integration

**What.** Every invocation of `fashion_agent_graph` (both the live `POST /api/chat` endpoint and the offline evaluation runner) emits structured traces to **LangSmith** via the `LANGCHAIN_TRACING_V2=true` environment flag. Traces are scoped to the `aura-fashion-agent` project. Each run carries per-request `tags` (e.g., `["evaluation", "tc_01_beach_wedding", "Fashion & Apparel"]`) and `metadata` dictionaries that propagate through every node in the LangGraph DAG.

**Why.** The agent pipeline executes 7 discrete nodes across two LLM temperature profiles (`master_llm` at `T=0.3`, `worker_llm` at `T=0.1`) and 3 parallel sub-agents. Without end-to-end telemetry, debugging a misrouted query or a hallucinated fabric verdict is intractable. LangSmith surfaces per-node custody, token counts, and raw prompt/completion pairs — making it possible to isolate regressions to a specific node (e.g., `retriever` returning off-category SKUs).

**Trade-offs.**

- **Network dependency:** Every LLM call adds an async POST to `api.smith.langchain.com`. In high-throughput production, this can be toggled off by unsetting `LANGCHAIN_TRACING_V2`.
- **API key exposure surface:** The `LANGCHAIN_API_KEY` is stored in `.env` files. Both files are `.gitignore`d, but the dual-location is a maintenance concern.

---

### 1.2 Autonomous LLM-as-a-Judge Evaluation Pipeline

**What.** `eval_pipeline.py` implements a fully autonomous benchmark harness. It iterates over 6 curated scenarios defined in `eval_dataset.py`, invokes `fashion_agent_graph.ainvoke()` for each, then submits the full agent output (intent, anchor SKU, swarm evaluations, pricing, and synthesized text) to a **structured-output LLM judge** (`AgentEvaluationGrade` Pydantic model). The judge scores 4 orthogonal dimensions:

| Dimension                  | Measures                                                                     | Scale |
| -------------------------- | ---------------------------------------------------------------------------- | ----- |
| **Relevance**              | Did the agent respect occasion, budget, product constraints?                 | 0–10  |
| **Persona**                | Does the response feel like a boutique stylist vs. a generic chatbot?        | 0–10  |
| **Recommendation Quality** | Is the product contextually appropriate? Are textile/formula notes accurate? | 0–10  |
| **Helpfulness**            | Is the response structured, engaging, and actionable?                        | 0–10  |

Additionally, two **deterministic checks** are applied per scenario:

- **Route accuracy:** Did `route_after_input()` send the query to the expected node (`clarifier` vs. `retriever` vs. `checkout`)?
- **Budget compliance:** Is `anchor_sku.metadata.price ≤ expected_intent.max_budget`?

**Why.** Multi-agent LLM pipelines are **non-deterministic by construction**. The same input can yield different SKU retrievals, different fabric verdicts, and different synthesis prose across runs. Traditional unit tests cannot evaluate "did the stylist sound premium?" or "was the moisturizer recommendation clinically appropriate?". An LLM-as-a-Judge approach provides **scalable qualitative grading** that correlates with human preference, while deterministic checks enforce hard constraints (budget ceilings, routing correctness) that must never drift.

**Trade-offs.**

- **Judge bias:** The judge LLM (`qwen/qwen3.8-27b` at `T=0.0`) may exhibit systematic biases (e.g., inflating persona scores for verbose responses). Mitigation: the pipeline logs full critiques to JSON for human audit.
- **Cost per run:** Each evaluation invokes the agent graph (4–5 LLM calls) plus 1 judge call per scenario. At 6 scenarios, a full run costs ~36 LLM inferences against the Groq free tier.
- **Fallback grading:** If the judge fails structured extraction, `eval_pipeline.py` falls back to a static `8.0/10` grade, which can silently mask quality regressions.

---

## 2. UI/UX Paradigm Shift

### 2.1 From "Cyber Glow" to Puma-Inspired Minimalism

**What.** The frontend underwent a complete visual overhaul from a neon-accented dark-mode "hacker aesthetic" to a high-contrast, minimalist **sports-retail design** inspired by Puma India. Key implementation details:

- **Tailwind v4 `@custom-variant`:** Theme toggling is implemented via `@custom-variant dark (&:where(.dark, .dark *));` in `index.css`, which scopes dark mode to the `.dark` class on `<html>` rather than relying on `prefers-color-scheme`.
- **CSS design tokens:** HSL-based custom properties (`--primary`, `--background`, `--card`, etc.) defined in `:root` provide a single source of truth consumed by every component.
- **Glassmorphism utilities:** `.glass-panel` and `.glass-card` classes apply `backdrop-filter: blur()` with semi-transparent backgrounds and subtle hover animations (`translateY(-2px)`, purple border glow).
- **Component-level theming:** Every component (`Navbar`, `ProductCard`, `CartDrawer`, `ChatPage`) uses explicit Tailwind `dark:` variants for bg, text, and border colors.

**Why.** The original cyber-glow aesthetic, while visually striking for demos, failed on two production criteria:

1. **Readability & accessibility:** Neon accents on dark backgrounds produced insufficient contrast ratios for body text (WCAG AA requires ≥ 4.5:1).
2. **Retail conversion credibility:** Research consistently shows that premium e-commerce platforms use restrained palettes with high white-space density. The Puma-inspired zinc/white palette conveys trust and product focus.

**Trade-offs.**

- **Class-based dark mode vs. system preference:** The `@custom-variant` approach ignores `prefers-color-scheme`. Users who set system-level dark mode must manually toggle via the theme provider.

---

### 2.2 Chat Window Architecture & Sidebar History

**What.** The chat experience is a **full-page dedicated route** (`/chat`) rendered by `ChatPage.tsx`, not a sidebar overlay. It features:

- **Gemini-style history sidebar:** Collapsible left panel listing past sessions (fetched from `GET /api/chat/sessions`), with new-session creation, session deletion, and auto-titling from the first user message.
- **Slide-out settings drawer:** "Stylist & Swarm Specs" panel for fit preference controls and telemetry, repositioned from the main layout to an on-demand drawer inside the sidebar.
- **Product image previews in-chat:** The `recommendation` object embedded in assistant messages renders inline product cards with `image_url` from the catalog metadata.

**Why.** A side-panel `ChatDrawer` was too constrained for multi-turn styling consultations. The full-page layout provides the vertical real estate needed for long-form synthesis responses and inline product cards.

---

## 3. Agentic Framework

### 3.1 LangGraph for DAG Orchestration

**What.** The agent pipeline is a **LangGraph `StateGraph`** compiled with an `InMemorySaver` checkpointer for multi-turn state persistence. The graph has 7 nodes:

| Node           | Function                                                                                      | LLM Used             |
| -------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| `router`       | `master_router_node` — Structured intent extraction via `IntentParser` Pydantic model         | `master_llm` (T=0.3) |
| `clarifier`    | `clarifier_node` — Evocative styling questions for ambiguous queries                          | `master_llm` (T=0.3) |
| `retriever`    | `retriever_node` — Postgres-backed catalog search using `search_query` from intent                  | None (deterministic) |
| `worker_swarm` | `worker_swarm_node` — 3 parallel sub-agents: `size_worker`, `fabric_worker`, `stylist_worker` | `worker_llm` (T=0.1) |
| `pricing`      | `pricing_node` — Deterministic coupon/discount computation                                    | None (deterministic) |
| `synthesis`    | `synthesis_node` — Category-aware prose generation with styling masterclass                   | `master_llm` (T=0.3) |
| `checkout`     | `razorpay_checkout_node` — Frozen Razorpay order creation                                     | None (deterministic) |

**Why LangGraph over vanilla LangChain `SequentialChain` or `AgentExecutor`:**

1. **Conditional routing:** `route_after_input()` inspects `intent.is_ready_to_recommend` and `intent.is_checkout_requested` to branch the DAG. This three-way conditional edge (`clarifier` / `retriever` / `checkout`) is a first-class primitive in LangGraph but requires manual orchestration in `AgentExecutor`.
2. **Parallel execution:** `worker_swarm_node` uses `asyncio.gather()` to run size, fabric, and stylist sub-agents concurrently. LangGraph's async-native execution model supports this natively.
3. **Stateful multi-turn:** `InMemorySaver` checkpoints the full `AgentState` keyed by `thread_id` (session ID). Subsequent messages in the same session carry forward `candidate_skus`, `evaluations`, and `outfit` — enabling the checkout node to reference a previously recommended anchor SKU without re-retrieval.

**Trade-offs.**

- **No re-ranking:** The retriever selects `anchor_sku = candidates[0]` — the top-scoring result from the Postgres-backed ranking layer. There is no LLM-powered re-ranking step to verify that the top candidate actually matches the extracted intent before passing it to the worker swarm.

---

### 3.2 Dual-Temperature LLM Strategy

**What.** Two `ChatOpenAI` instances share the same Groq-hosted model (`qwen/qwen3.8-27b`) but operate at different temperatures:

- **`master_llm` (T=0.5):** Used for intent parsing, clarifier dialogue, and synthesis. Higher temperature produces more creative, evocative styling prose.
- **`worker_llm` (T=0.1):** Used for the parallel swarm sub-agents (size, fabric, stylist verdicts). Lower temperature produces more consistent, deterministic structured output.

**Why.** The worker sub-agents emit structured Pydantic models (`SizeVerdict`, `FabricVerdict`, `StylistVerdict`) where JSON extraction reliability is paramount. Lower temperature reduces structural hallucinations. The synthesis node, conversely, benefits from controlled creativity to produce engaging boutique-stylist prose.

**Trade-offs.**

- **Single model, dual-role:** Both LLM instances hit the same Groq endpoint and model. Rate limiting on the Groq free tier (30 RPM) can cause cascading failures when the parallel swarm fires 3 concurrent calls immediately after the router call.

---

### 3.3 Catalog & Retrieval Layer

**What.** `catalog_store.py` loads active products from PostgreSQL (Supabase) and ranks them in Python using query-token matches across title, description, brand, and catalog metadata. The `products` table is the source of truth, with optional segment and budget filters.

**Why.** This keeps search simple, removes the local vector DB dependency, and aligns the retrieval layer with the same Supabase database used for persistence.

---

### 3.4 Session History & Persistence

**What.** `history_store.py` implements a **flat-file JSON persistence layer` (`chat_history.json`) storing sessions and messages keyed by `session_id`. Session titles are auto-generated from the first user message (truncated to 33 chars). The `main.py` server persists both user and assistant messages on every `POST /api/chat` invocation.

**Why.** JSON-file persistence was chosen for maximum simplicity — no database server, no ORM, no schema migrations. For a hackathon prototype with single-user local access, this is the fastest path to a working history sidebar.

---

### 3.5 Razorpay Checkout Integration

**What.** `checkout_service.py` exposes `create_frozen_razorpay_order()` which creates a real Razorpay order via the official SDK when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are configured, or falls back to a **mock order** (prefixed `order_mock_`) for local development. The mock path produces a structurally identical response with `is_mock: True`.

**Why.** The dual-mode design allows the full checkout flow (agent recommendation → cart freeze → order creation) to be exercised end-to-end without requiring real Razorpay credentials. The frontend `CartDrawer` renders a checkout button that invokes `openRazorpayCheckout()` from `lib/razorpay.ts`.

---

### 3.6 Groq Rate Limit (OTPM) Mitigation via Output Token Bounding

**What.** Configured explicit, strict `max_tokens` (and output token reservation) limits across all `ChatOpenAI` instances in the codebase (`master_llm` is limited to `500` tokens, `worker_llm` to `250` tokens, and the evaluation `judge_llm` to `400` tokens) in `nodes.py` and `eval_pipeline.py`.

**Why.** Groq enforces a strict Output Tokens Per Minute (OTPM) limit of **1,000 tokens** on its free and lower tiers. When LangChain's `ChatOpenAI` model wrapper is instantiated without an explicit `max_tokens` limit, the client omits any maximum token specification in the API payload. Consequently, Groq's gateway assumes a worst-case default output reservation (typically 4,096 tokens) for each request to prevent midway failures. 

Since 4,096 exceeds 1,000, **even a single un-bounded request** immediately triggered an OTPM `429 Rate Limit Exceeded` error and crashed the graph. This was highly severe in the parallel `worker_swarm_node`, which runs three sub-agent tasks concurrently (sizing, fabric, and styling). By hard-bounding output limits:

- **Master Stylist (`master_llm`)**: Limit of `500` tokens provides plenty of room for intent parsing, clarifier dialogue, and final concise synthesis responses, while preventing the main model from monopolizing the rate limit.
- **Worker Swarm (`worker_llm`)**: Limit of `250` tokens ensures that the parallel execution of the three swarm sub-agents has a combined peak reservation of `3 * 250 = 750` tokens, which is safely below the 1,000 OTPM ceiling. Sizing, fabric, and styling task JSON schemas are highly concise and fit comfortably in this 250 token boundary.
- **Judge Model (`judge_llm`)**: Limit of `400` tokens ensures structured evaluation runs smoothly.

---

## 4. SPA Routing & Refresh Persistence

### 4.1 Server-Side Explicit SPA Routing Fallbacks

**What.** Implemented explicit GET path mappings in Uvicorn/FastAPI (`main.py`) for all client-side React routes (`/chat`, `/chat/{session_id}`, `/orders`, `/search`, and `/product/{sku_id}`). Instead of letting Uvicorn evaluate these as missing static files and returning `404 Not Found` upon page reloads, these endpoints intercept direct requests and cleanly return the root React `index.html` file as a high-performance `FileResponse`.

**Why.** SPAs like React Router handle route routing entirely inside client-side JavaScript. When a user is on `/chat` or `/orders` and clicks "Refresh", the browser bypasses React and sends a direct GET request to Uvicorn for `/chat` or `/orders`. Providing server-side fallback handlers prevents reload crashes and allows client routing to resume seamlessly on mount.

---

### 4.2 URL-based Chat Session Recovery

**What.** We fully synchronized the active chat thread with the browser address bar by registering `/chat/:session_id` routes. On page reloads, the app extracts the ID from the URL (`useParams()`) and fetches the matching history from `/api/chat/history/{session_id}`.
*   **Redirect synchronization**: On starting a new consultation on `/chat` and sending the first query, the frontend automatically updates the address bar to `/chat/${currentSessionId}` in the background using a non-disruptive `{ replace: true }` router navigate call.
*   **Early return skip-guards**: Added an early return check `if (session_id === currentSessionId && messages.length > 1) { return; }` to the synchronization hook. This ensures that when the first message redirects or when users interact, the app **skips re-fetching and completely bypasses any loading spinners**, enabling a completely continuous, flicker-free conversation.

---

## 5. Full-Stack Cart Persistence

### 5.1 Database-Backed Cart Item Storage

**What.** We designed a new SQLAlchemy model `CartItem` mapping to a persistent `cart_items` table in Supabase PostgreSQL, holding `user_id`, `product_id`, `quantity`, and **`size`**. On application startup, the engine executes self-healing dynamic column upgrades (`ALTER TABLE users ADD COLUMN...`) to gracefully manage live schema modifications.

**Why.** Local React state cart variables are volatile and clear on refreshes, which is highly disruptive for shopping. Persisting additions, removals, and sizing selections directly to the database ensures your active bag survives reloads across any device.

---

### 5.2 Dynamic Context-Aware AI Consultations

**What.** Intercepted every chat assistant request (`POST /api/chat`) inside `main.py` and queried the user's active database cart. This list of items is dynamically injected as a JSON context list (`profile["cart"]`) inside the orchestrator and master stylist prompts on every turn.

**Why.** Grants the AI Stylist deep real-time awareness of what is already inside your shopping bag. The assistant can now reference your exact cart items conversationally, saying things like *"Since you already have the Stretch Slim Fit Chinos in your bag, let's pair them with..."*, providing world-class contextual continuity.

---

## 6. Real-Time Streaming & Conversational UX

### 6.1 Event-Based Token Streams via `astream_events`

**What.** Refactored the `/api/chat` streaming response to use LangGraph's dynamic `astream_events(version="v2")` framework. We intercept `on_chat_model_stream` events matching our master synthesis run-name (`synthesis_llm`) and yield the chunks immediately to the frontend. Node updates are captured via `"on_chain_end"` on matching node labels (such as `"pricing"`, `"retriever"`) to keep the thinking step log fully active.

**Why.** Waiting for the entire multi-agent graph to finish was too slow and incurred high latency. Streaming tokens immediately reduces perceived latency to near-zero.

---

### 6.2 Selective Conversational Additions

**What.** Extended the structured `IntentParser` schema with `target_skus_to_add` so that the LLM intelligently decides which specific products to add based on the user's latest query (e.g. adding only 2 items instead of blindly dumping all 5 recommended items). The client automatically executes `onAddToCart` for each item, keeping additions perfectly aligned with your commands.
