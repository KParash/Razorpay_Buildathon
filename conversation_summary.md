# Comprehensive Project & Conversation Summary: AI Agentic E-Commerce Platform

> **Project:** Razorpay Buildathon — Agentic E-Commerce & AI Boutique Stylist Platform  
> **Backend:** FastAPI + LangGraph + ChromaDB + Groq (`qwen/qwen3.8-27b`) + LangSmith  
> **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + React Router  
> **Payments:** Razorpay Checkout Integration  

---

## 1. Project Overview & Architecture Evolution

This project evolved from an initial concept into an end-to-end, production-grade **Agentic E-Commerce Platform** combining multi-agent AI consultations, semantic vector search, dynamic discount pricing, multi-session persistence, and integrated Razorpay checkout.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Frontend (React / Vite)                 │
                  │   • Home Showcase (Puma-inspired Minimalist UI)         │
                  │   • AI Stylist Studio (/chat route + Gemini Sidebar)    │
                  │   • Cart Drawer & Razorpay Checkout Modal               │
                  └────────────────────────────┬────────────────────────────┘
                                               │ REST API
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                 FastAPI Backend Server                  │
                  │  • /api/products          • /api/chat (LangGraph)       │
                  │  • /api/chat/sessions     • /api/chat/history/{id}      │
                  │  • /api/checkout/order    • /v1/chat/completions        │
                  └─────────────┬───────────────────────────┬───────────────┘
                                │                           │
                 LangGraph DAG  ▼                           ▼ Vector Search / Store
     ┌──────────────────────────────────────┐     ┌────────────────────────────────┐
     │ 7-Node Multi-Agent Graph:            │     │ • ChromaDB (all-MiniLM-L6-v2)  │
     │ 1. Master Intent Router (T=0.3)      │     │ • 50+ Item Multi-Category      │
     │ 2. Clarifier Dialogue Node           │     │ • Flat-file chat_history.json  │
     │ 3. Semantic Vector Retriever         │     │ • Razorpay Order Service       │
     │ 4. Worker Swarm (Size/Fabric/Style)  │     └────────────────────────────────┘
     │ 5. Pricing & Coupon Engine           │
     │ 6. Category-Aware Synthesis (T=0.3)  │
     │ 7. Razorpay Order Freeze Node        │
     └──────────────────────────────────────┘
```

---

## 2. Chronological Milestones & Updates Made

### Phase 1: Initial Setup, Fixes & Diagnostics
- **TypeScript Configuration:** Fixed build-time errors in `frontend/tsconfig.app.json` by removing deprecated flags.
- **Hugging Face Hub Warning Suppression:** Configured clean logging in `catalog_store.py` for the local `sentence-transformers` (`all-MiniLM-L6-v2`) embeddings model running on CPU with zero external API dependencies.
- **Cart & Navigation Wiring:** Corrected state propagation for `onOpenCart` and cart counters across the top navigation bar.
- **Icon System Decision:** Retained `lucide-react` across the codebase for lightweight, consistent iconography.

### Phase 2: Complete UI/UX Overhaul (Puma India Inspiration)
- **Aesthetic Transformation:** Replaced the dark "cyber/neon" theme with a clean, high-contrast sports-retail aesthetic inspired by **Puma India**.
- **Theming & Color System:** Built `ThemeContext.tsx` and configured Tailwind v4 `@custom-variant dark` in `index.css` for instant Light/Dark mode toggling.
- **Component Polish:** Overhauled `Navbar.tsx`, `ProductCard.tsx`, `CartDrawer.tsx`, and `ChatDrawer.tsx` with crisp borders, typography hierarchy, and subtle micro-interactions.

### Phase 3: Catalog Expansion & Vector Search Upgrades
- **Expanded Multi-Category Catalog:** Upgraded from a simple 8-item list to a comprehensive 50-item catalog (`new_catalog.json`) covering:
  - *Fashion & Apparel* (linen shirts, formal blazers, cargos, chinos)
  - *Beauty & Skincare* (hydrating moisturizers, serums, cleansers)
  - *Electronics & Gadgets* (wireless ANC headphones, fitness trackers)
  - *Health & Home* (aromatherapy diffusers, wellness essentials)
- **Rich Metadata Schema:** Added parameters including `fit_type`, `fabric`, `gsm`, `color`, `category`, `eligible_coupon`, `image_url`, and detailed descriptions.
- **ChromaDB Vector Retrieval:** Powered by `all-MiniLM-L6-v2` embeddings in ephemeral ChromaDB collection `ecommerce_catalog_v5` with cosine similarity and budget filtering.

### Phase 4: LangGraph Multi-Agent Swarm Implementation
- **7-Node Directed Acyclic Graph (DAG):**
  1. `master_router_node`: Pydantic `IntentParser` extracting budget, occasion, climate, and checkout intents.
  2. `clarifier_node`: Engages when input is vague, asking tailored consultative questions.
  3. `retriever_node`: Performs semantic vector lookup in ChromaDB.
  4. `worker_swarm_node`: Concurrently fires 3 specialized sub-agents via `asyncio.gather()`:
     - `size_worker`: Evaluates fit profile and size tolerances.
     - `fabric_worker`: Verifies fabric suitability and climate compatibility.
     - `stylist_worker`: Curates pairing notes, aesthetic harmony, and palette rules.
  5. `pricing_node`: Applies promo logic (`STYLE20` for 20% off, `AURA10` for 10% off).
  6. `synthesis_node`: Generates category-aware luxury boutique stylist consultation prose.
  7. `razorpay_checkout_node`: Locks final price and generates frozen Razorpay order payload.
- **Dual-Temperature Strategy:**
  - `master_llm` at `T=0.3` for evocative, creative prose generation.
  - `worker_llm` at `T=0.1` for deterministic structured JSON evaluations.

### Phase 5: Multi-Session Chat Studio & Persistence Layer
- **Dedicated Chat Route (`/chat`):** Built [`ChatPage.tsx`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/pages/ChatPage.tsx) featuring:
  - **Gemini-style Session Sidebar:** Past session history, auto-generated titles from first user prompt, active session highlighting, and session deletion.
  - **Inline Product Recommendation Cards:** Direct image previews, sizing/fabric specs, discount tags, and 1-click add-to-cart.
  - **Collapsible Telemetry Inspector:** Slide-out drawer showcasing sub-agent swarm evaluations, size verdicts, fabric checks, and pricing calculations.
- **Backend Session History Store:** Created [`history_store.py`](file:///e:/Buildathon/Razorpay_Buildathon/history_store.py) and API endpoints:
  - `GET /api/chat/sessions`: Lists all user sessions sorted newest to oldest.
  - `GET /api/chat/history/{session_id}`: Retrieves full message stream with rich metadata.
  - `DELETE /api/chat/sessions/{session_id}`: Deletes a session and associated history.
  - Synchronous persistence in `POST /api/chat` for both user prompts and assistant outputs.

### Phase 6: Razorpay Checkout Integration
- **Frozen Order Creation:** Developed [`checkout_service.py`](file:///e:/Buildathon/Razorpay_Buildathon/checkout_service.py) supporting live Razorpay API order creation with graceful fallback to mock mode (`order_mock_...`) when keys are not configured.
- **Frontend Payment Execution:** Wired `openRazorpayCheckout()` in [`frontend/src/lib/razorpay.ts`](file:///e:/Buildathon/Razorpay_Buildathon/frontend/src/lib/razorpay.ts) to trigger the official Razorpay payment modal with currency, amount, and order ID.

### Phase 7: Observability, Benchmarking & Evaluation Pipeline
- **LangSmith Tracing:** Configured `LANGCHAIN_TRACING_V2=true` in `aura-fashion-agent` with per-node execution tags and metadata telemetry.
- **LLM-as-a-Judge Harness:** Implemented [`eval_pipeline.py`](file:///e:/Buildathon/Razorpay_Buildathon/eval_pipeline.py) and [`eval_dataset.py`](file:///e:/Buildathon/Razorpay_Buildathon/eval_dataset.py) evaluating 6 test scenarios across:
  - *Relevance* (0–10)
  - *Persona* (0–10)
  - *Recommendation Quality* (0–10)
  - *Helpfulness* (0–10)
  - *Deterministic Route Accuracy & Budget Compliance*
- **Evaluation Reporting:** Automatic output generation in `eval_results/` in both JSON and Markdown formats.

### Phase 8: System Documentation & Architectural Records
- **[`decision.md`](file:///e:/Buildathon/Razorpay_Buildathon/decision.md):** Staff-level Architectural Decision Records (ADRs) following the *What → Why → Trade-offs* format across all subsystems.
- **[`flow.md`](file:///e:/Buildathon/Razorpay_Buildathon/flow.md):** End-to-end user journeys, state transition tables, and node interaction contracts.
- **[`langraph_architecture.md`](file:///e:/Buildathon/Razorpay_Buildathon/langraph_architecture.md): Visual DAG topology, state schema, and routing conditions.

---

## 3. Key Files & Directory Structure

```
Razorpay_Buildathon/
├── main.py                  # FastAPI server, REST routes, chat & history endpoints
├── graph.py                 # LangGraph StateGraph assembly and MemorySaver checkpointer
├── nodes.py                 # 7 Graph nodes (router, clarifier, retriever, swarm, pricing, synthesis, checkout)
├── schema.py                # Pydantic schemas (AgentState, IntentParser, Verdicts, Profile)
├── catalog_store.py         # ChromaDB vector store, all-MiniLM-L6-v2 embeddings, search
├── history_store.py         # JSON multi-session chat persistence (chat_history.json)
├── checkout_service.py      # Razorpay order generation & verification service
├── new_catalog.json         # 50+ item multi-category e-commerce catalog
├── chat_history.json        # Persistent chat history database
├── eval_dataset.py          # 6 curated test scenarios for agent benchmarking
├── eval_pipeline.py         # Autonomous LLM-as-a-Judge evaluation runner
├── eval_results/            # Generated benchmark reports (JSON & Markdown)
├── decision.md              # Staff-level Architectural Decision Records (ADRs)
├── flow.md                  # Comprehensive end-to-end architecture & flow specification
├── langraph_architecture.md # Graph node connectivity & state documentation
├── conversation_summary.md  # Complete project & conversation summary
└── frontend/
    ├── src/
    │   ├── App.tsx          # Router setup (Home + ChatPage) and global CartDrawer
    │   ├── main.tsx         # Root mounting with ThemeProvider & BrowserRouter
    │   ├── index.css        # Tailwind v4 styles, custom-variant dark, theme tokens
    │   ├── pages/
    │   │   ├── Home.tsx     # Hero banner, product grid, filters, search, add-to-cart
    │   │   └── ChatPage.tsx # AI Stylist Studio, Gemini sidebar, inline cards, inspector
    │   ├── components/
    │   │   ├── Navbar.tsx       # Top bar with navigation, cart button, theme toggle
    │   │   ├── ProductCard.tsx  # Product card with image, price, coupon chip, add button
    │   │   ├── CartDrawer.tsx   # Slide-out cart with Razorpay checkout button
    │   │   ├── ChatDrawer.tsx   # Lightweight chat drawer widget
    │   │   └── ThemeContext.tsx # Light/Dark mode state management & localStorage persistence
    │   ├── lib/
    │   │   └── razorpay.ts  # Razorpay SDK loader and checkout modal trigger
    │   └── types/
    │       └── product.ts   # Product interface definitions
    └── package.json         # Frontend dependencies and scripts
```

---

## 4. How to Run the Complete Stack

### 1. Backend (FastAPI + LangGraph)
```bash
# In the Razorpay_Buildathon directory
venv\Scripts\activate          # Or source venv/bin/activate on Unix
uvicorn main:app --reload --port 8000
```
- API Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`

### 2. Frontend (React + Vite)
```bash
# In the Razorpay_Buildathon/frontend directory
npm run dev
```
- Application URL: `http://localhost:5173/`
- AI Stylist Studio URL: `http://localhost:5173/chat`

### 3. Run Offline Evaluation Pipeline
```bash
# In the Razorpay_Buildathon directory
python eval_pipeline.py
```
- Generates automated benchmark reports in `eval_results/`.
