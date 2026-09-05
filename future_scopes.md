# Future Scopes — KAZU Production Roadmap

> Forward-looking initiatives for rolling KAZU out to production and beyond. Each initiative documents **Why** it matters, **What exists today** to build on, and the **Definition of done**. Ordered roughly by dependency — later initiatives assume earlier foundations.

---

## 1. Model Selection & LLM Strategy

**Why.** The entire swarm runs on a single free-tier model (`qwen/qwen3.8-27b` via Groq) chosen for cost, not quality. Different graph nodes have fundamentally different needs — intent parsing wants schema reliability, workers want judgment, synthesis wants voice.

**What exists today.** Dual-temperature split (T=0.5 master / T=0.1 worker), hard `max_tokens` bounding, per-turn real token telemetry in every API response, an LLM-as-a-Judge harness with per-scenario dimension scores, and full LangSmith trace archives.

**Scope.**
- Per-role model evaluation matrix: run the eval dataset across candidate providers (Groq production tiers, OpenAI, Gemini, Anthropic) per node profile; let measured scores (not vibes) pick the router/worker/synthesis models.
- **Provider fallback & retries** — retry with exponential backoff on 429/5xx; secondary provider configuration so a Groq outage degrades gracefully instead of erroring.
- **Fine-tuning loop** — export production traces from LangSmith, curate into SFT datasets, fine-tune/size down the worker models; close the loop by re-running evals on the tuned model.
- Prompt versioning & rollout discipline via LangSmith prompt registry.

**Done when.** Model choice per node is benchmark-backed and documented; provider failover survives a killed primary; fine-tuned worker beats base by measurable eval-dimension deltas.

---

## 2. A Dynamic, Precise Catalog Database

**Why.** Today the catalog is a seeded fixture: Unsplash placeholders, synthetic attributes, Men-only. The agent's verdicts are only as good as the data it reads.

**What exists today.** Structured `products` table with segment/subcategory taxonomy, `size_options`, coupon metadata, and a seeded 100-product demo catalog; search-ranked retrieval layer.

**Scope.**
- **Rich enrichment** — real product photography (owned/licensed CDN storage, not Unsplash), true size charts, care instructions, stock levels, variant-level SKUs (color × size), supplier cost data.
- **Catalog pipelines** — validated import (schema-checked CSV/JSON bulk load), attribute normalization (fabric GSM, color family taxonomies), quality gates rejecting incomplete records.
- **Order-item snapshots** — an `order_items` table capturing title/price/size at purchase time so history is immutable.
- **Multi-segment go-live** — Women / Kids / Beauty activated once inventory is real.

**Done when.** A merchant team can update the catalog without touching code; every frontend surface renders real imagery with graceful fallbacks; historical orders render identically even after catalog edits.

---

## 3. A More Resilient Chatbot

**Why.** The agent currently fails visibly (rate limits collapse turns, a hung provider stalls the graph, prompt injection is unchecked). Production traffic needs composure under stress.

**What exists today.** Flagged honest fallbacks (`is_fallback`) instead of fabricated verdicts, turn-scoped state (no stale-verdict leakage), prompt history trimming, node-level error logging, per-IP rate limiting, and SSE error events that reach the UI.

**Scope.**
- **Defense in depth against prompt injection** — structural delimiters, output-schema validation, intent-flag sanity checks (e.g., checkout requests must correlate with conversation state), never trusting user text to flip security-relevant flags alone.
- **Moderation & PII** — input/output moderation model; scrub phone numbers, addresses, and payment details from prompts, traces, and stored conversations.
- **Runtime resilience** — per-LLM-call timeouts, `asyncio.gather(..., return_exceptions=True)` semantics with quorum rules (proceed with 2-of-3 verdicts), circuit breaker on repeated provider failure.
- **Memory management** — `RemoveMessage`-based pruning / running summarization for long sessions (prompt trimming today is stateless; the checkpoint still grows).
- **Feedback flywheel** — capture thumbs up/down, feed into evals and model-selection decisions.

**Done when.** A 30-minute adversarial test session (injection, spam, off-topic, provider outage simulation) yields zero unsafe outputs and zero crashed turns.

---

## 4. Authentication & Authorization

**Why.** The guest-user model (`usr_guest` / `usr_local_dev`) is a demo convenience, not an identity system — it cannot survive real users on real devices.

**What exists today.** Per-user rows in every table (`users`, `cart_items`, `orders`, `conversations`) and ownership checks on session list/history/delete — the data model is already user-partitioned; only identity proof is missing.

**Scope.**
- Real sign-in — email+password (bcrypt/Argon2) and/or OAuth (Google) and phone-OTP; short-lived access tokens + refresh rotation.
- Server-side authorization on **every** stateful endpoint — cart, orders, checkout, chat sessions, search history — derived from the authenticated identity, never a request-supplied `user_id`.
- Guest→account migration flow (anonymous cart/chat merge on first login).
- Remove `usr_guest`/`usr_local_dev` normalization hacks; delete the cross-user legacy aliases.

**Done when.** A pentest checklist passes: no horizontal access, token replay bounded, logout invalidates, and a logged-out user cannot read/write any resource.

---

## 5. Admin CMS

**Why.** Operations (catalog changes, order issues, agent quality review) currently require database access. The business needs a control room.

**What exists today.** SQLAlchemy models across all domains (products, orders, users, conversations), eval reports, and LangSmith tracing — all data an admin UI needs is already structured.

**Scope.**
- **Catalog CRUD** — products, sub-categories, segments, imagery, stock, coupons-as-data (replaces hardcoded STYLE20/AURA10 with a rule table + redemption tracking).
- **Order management** — status transitions, manual refund/cancel actions, dispute notes.
- **Conversation oversight** — read-only thread browser linked to LangSmith traces; red-flag queue from moderation events.
- **Dashboards** — revenue, conversion, cart abandonment, agent eval drift over time.
- RBAC: admin vs. support vs. analyst roles (depends on §4 auth).

**Done when.** Day-to-day operations (add product, create coupon, refund order, review flagged chat) are zero-touch for engineers.

---

## 6. Merchant Portal

**Why.** KAZU's inventory ceiling is one store's catalog. A merchant portal converts KAZU from a shop into a marketplace — the natural growth story for a Razorpay build.

**What exists today.** The segment/subcategory taxonomy and per-product retrieval already treat the catalog as partitioned; Razorpay integration (Standard Checkout) has a direct upgrade path to **Razorpay Route** for splits/payouts.

**Scope.**
- **Merchant onboarding & self-service** — signup, KYC handoff to Razorpay, bulk catalog upload (piggybacks on §2 pipelines), inventory sync API.
- **Multi-seller cart semantics** — split orders per merchant at checkout; per-merchant fulfillment tracking.
- **Payouts & reporting** — Razorpay Route for commission splits; settlement reports, return-rates, SLA dashboards per merchant.
- **Agent multi-vendor awareness** — worker swarm prices and availability resolve per merchant; the synthesis discloses seller for trust.

**Done when.** A second merchant can onboard, list, sell, and receive a Razorpay Route settlement — end-to-end without engineering intervention.

---

## 7. Semantic & Multimodal Search *(suggested addition)*

**Why.** Token-substring ranking is the retrieval ceiling — "something breezy for humid evenings" should find linen without the user naming fabric or GSM.

**Scope.**
- Embed the catalog (product title + attributes + description) into a vector index (pgvector on the existing Supabase Postgres keeps the stack identical); hybrid rank = vector similarity ⊗ budget ⊗ segment.
- **Shop-the-photo** — user uploads an outfit image; a vision model extracts attributes (silhouette, palette, fabric) that seed retrieval.
- **Voice input** for the chat studio (speech-to-text → same intent pipeline).

**Done when.** Eval scenario relevance scores measurably improve over token-match; a photo query returns visually similar in-catalog items.

---

## 8. Personalization Engine *(suggested addition)*

**Why.** The "customer profile" is currently hardcoded (pincode 560001, fixed size history, mid budget). KAZU's concierge premise depends on genuinely knowing the shopper.

**Scope.**
- Learn **fit/color/brand/budget affinities** from orders, cart adds, likes/dislikes, and conversation (log signals per user; decay-weighted).
- Feed learned attributes into the worker swarm (size worker uses *real* size history; stylist worker respects *actual* disliked colors) and into profile-aware clarifier questions.
- Recommendations rail on the home page ("Because you wear relaxed linen"), restock/size alerts.
- Strict privacy posture: learnings stored per authenticated user, deletable on request (ties to §4).

**Done when.** A returning user's first recommendation of a session reflects their history without restating preferences; preference-stuffing a profile measurably shifts eval outputs.

---

## 9. Order Communications *(suggested addition)*

**Why.** The purchase disappears into silence after verification — no confirmation, no updates, no trust-building.

**Scope.**
- Transactional channels — email (confirmation, invoice), SMS/WhatsApp (dispatch + delivery) — triggered off the order state machine (§1 of Limitation.md remediation: `created → paid → fulfilled → delivered`, plus `refunded`).
- Templates priced per state with deep links back to `/orders` and support.

**Done when.** Every order-state transition emits a delivered, logged notification; delivery webhooks close the loop.

---

## 10. Loyalty & Promotions Engine *(suggested addition)*

**Why.** Promotions today are two strings hardcoded on both sides of the stack. Growth needs campaign machinery, not constants.

**Scope.**
- **Dynamic coupon rules** — backend `coupons` table: eligibility (segment, min-spend, first-order), usage caps, expiry, per-user redemption tracking; agent aware of live campaigns.
- **Loyalty points** — earn per order, redeem at checkout; tier multipliers driving retention.
- Campaign analytics feeding the Admin CMS dashboards (§5).

**Done when.** Launching a coupon campaign is a CMS form, not a deploy; the agent surfaces the best eligible offer without the user asking for a code.

---

## Sequencing Snapshot

```
Foundation:   4 Auth → 3 Resilience + 2 Catalog → 5 Admin CMS
Growth:       1 Model strategy → 7 Semantic/multimodal + 8 Personalization
Marketplace:  6 Merchant portal (needs 2 + 4) → 9 Communications + 10 Loyalty
```

*Pairs with `Limitation.md` — close the limitations first; these scopes assume that floor.*
