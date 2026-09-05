# Known Limitations — KAZU MVP

> Audited inventory of what is **intentionally absent or simplified** in this buildathon MVP. Every entry is verified against the current codebase — items fixed in the P0/P1 hardening batches are deliberately excluded. Each section carries a **production risk** assessment; nothing listed here is safe to ship publicly without remediation.

---

## 1. Security — Accepted MVP Risks

| Limitation | Detail | Production risk |
|---|---|---|
| **No payment-failure UX** | No `payment.failed` handler, no `modal.ondismiss` handler. A declined UPI/card silently closes the modal; errors surface via blocking `alert()`. | High — users can't distinguish decline from success; abandoned checkouts invisible. |
| **No authentication** | Every stateful endpoint accepts raw `user_id` (default `usr_guest`). Sessions are ownership-checked on list/history/delete (added in hardening), but cart/orders/checkout remain fully impersonable. | **Critical** — any caller can read/modify any user's cart and orders. |
| **Prompt injection unmitigated** | Raw user text is interpolated into f-string prompts (router, clarifier, synthesis). A crafted message can steer intent flags (e.g. forcing checkout routing); combined with the mock-signature bypass this is a chat-only attack surface in mock mode. | High |
| **Partial input validation** | Quantity (1–99) and size-vs-catalog are now enforced; but no max message/query lengths, no pincode format checks, freeform fit/climate fields. | Medium |
| **No boot-time env validation** | `GROQ_API_KEY` failure surfaces only at the first LLM call; no `.env.example` / pydantic-settings schema; misconfigured deploys fail late and opaquely. | Medium |
| **No SRI / CSP** | `checkout.razorpay.com` script loaded without Subresource Integrity; `index.html` has no Content-Security-Policy or security headers. | Medium |
| **No moderation / guardrails** | No PII detection, no profanity/off-topic filtering, no output moderation — off-topic refusal is prompt-only. | Medium |
| **Mock-signature bypass (dev-only)** | In mock mode, the signature string `mock_signature_verified`/`simulated_success` is accepted. Razorpay hardening was deliberately deferred; mock mode must never run on a public deployment. | High if mis-deployed |

---

## 2. Payments & Orders

- **No webhook receiver** — payment confirmation relies on the browser calling `/api/checkout/verify`; no `X-Razorpay-Signature` handling, no `payment.captured`/`failed`/refund events. Client-driven verify is the entire trust chain.
- **Inert order state machine** — `failed`/`refunded` exist in the enum but no code path ever sets them; no abandoned-`created`-order reconciliation or expiry.
- **Line items as JSON blobs** — orders store one anchor + a SKU list rehydrated from the *current* catalog (`main.py`); editing catalog rows retroactively changes what a historical order "was". No price/size snapshot at purchase time.
- **No fulfillment simulation** — verify flips status to `paid` and clears the cart; no shipment, invoice, or notification. `delivery_verdict` is a hardcoded stub (`meets_deadline: True`, fake warehouse string).
- **No refunds/returns flow** — despite "EASY RETURNS / Within 15 days" marketing on the homepage.
- **No checkout idempotency at the API level** — the UI guards double-clicks, but two POSTs to `/api/checkout/create` still produce duplicate Razorpay + DB orders.
- **Client-stated totals** — order amount is taken from the request body (server-side recomputation was deferred with the Razorpay scope).

---

## 3. Commerce

- **No inventory/stock field** on `Product`; add-to-cart never checks availability.
- **No quantity steppers** in cart UI; per-size quantities exist in DB but are not user-editable.
- **No address management, shipping methods, or delivery estimates** — shipping hardcoded "FREE".
- **Hardcoded coupons on both sides** (`STYLE20`/`AURA10` in `nodes.py` and `CartDrawer.tsx`); no coupon table, no redemption tracking; the invalid-coupon error message leaks a valid code.
- **Login & wishlist are `alert()` stubs**; PDP wishlist toggle is local-only state, lost on refresh, never persisted.

---

## 4. Search & Catalog Retrieval

- **Client-side substring filtering only** on the search page — no debounce, no `?q=` URL param (refresh/bookmark loses the query), no sort, no price/fabric/color filters, no pagination.
- **Server search reloads the entire products table into Python on every request** — no cache, no SQL-side budget filter.
- **Token-substring ranking only** — no vector/semantic similarity; acknowledged in `flow.md §4.1`.
- **No pagination anywhere** — products, orders, sessions, and search endpoints all return unbounded lists.

---

## 5. Product Data

- **All imagery is hardcoded Unsplash stock** (`SKU_IMAGES`, `FALLBACK_PRODUCTS`, hero, segment cards) — decorative placeholders, not catalog truth; the PDP gallery shows the same 3 photos for every product.
- **No image fallback** — no `onError` handlers; an expired Unsplash URL renders a broken image app-wide.
- **Hardcoded customer profile** in `ChatPage.tsx` (pincode `560001`, size history, budget tier); the "Stylist Specs" panel's climate selector is **never sent** — cosmetic only.
- **Brand drift** — the Razorpay modal still says "AURA AI Fashion Store"; site brand is KAZU/STYLO.

---

## 6. Catalog Breadth

Only the **Men's** collection is in stock. WOMEN / KIDS / BEAUTY are disabled placeholder cards. Consequence: eval scenarios for beauty (`tc_03`) and electronics (`tc_04`) cannot pass legitimately against this catalog, and the agent's out-of-catalog honesty path carries the load.

---

## 7. Engineering Hygiene & Infra

- **No frontend test framework** (backend has 22 pytest regression tests; UI logic — cart toggling, SSE parsing — untested).
- **No deployment config** — no Dockerfile/compose/Procfile, no CI workflows, no production API-URL strategy in the frontend (Vite dev-proxy only; no `import.meta.env` usage).
- **No migration system** — `create_all` at import + hand-rolled `ALTER TABLE` backfills; `init_db()` at import time requires a live DB to even import `db.py`, blocking true unit tests.
- **`print()`-only observability** — no structured logging, request logging, metrics, or `/health` endpoint.
- **Data-model rough edges** — money as `Float` (should be `Numeric`/paise integers), no secondary indexes (`orders.user_id`, `products.segment`, `cart_items.user_id`), no CHECK constraints, naive `DateTime` columns, FK `ondelete` mismatch vs. ORM cascades.
- **Dead code** — `ChatDrawer.tsx` (~344 lines, never imported), `App.css`, unused image assets, the default Vite README in `frontend/`.
- **Doc drift** — `decision.md §3.4` still describes flat-file `chat_history.json` persistence (database-backed in reality); master temperature documented as 0.3 vs. actual 0.5.
- **Frontend DX** — no centralized API client (raw `fetch` scattered across 6 files), no toast system (12 `alert()` calls), state prop-drilled from `App.tsx` (no store/React Query), no `ErrorBoundary`, no 404 catch-all route, permissive tsconfig, 2-rule oxlint.

---

## 8. UX & Accessibility

- **Zero ARIA** — no labels on icon buttons, no focus trapping, no Escape-to-close/click-outside on any of the three overlays (cart, search, settings); disabled-button tooltips are invisible to keyboard and screen-reader users.
- **Mobile gaps** — no hamburger menu; LOGIN / WISHLIST / ORDERS are unreachable on small screens; chat sidebar lacks a scrim tap-to-close.
- **WCAG contrast** — pervasive `text-[9px]/[10px]` zinc-400 body text on light backgrounds fails AA ratios.
- **No body scroll-lock** while drawers are open.
- **No toasts** — errors and successes use blocking `alert()` throughout.

---

## Remediation Order (Recommended Before Any Public Launch)

1. **Critical:** authentication + endpoint authorization; disable mock-signature acceptance outside localhost; Razorpay webhook as authoritative paid signal; server-side total recomputation.
2. **High:** payment-failure UX; prompt-injection defenses; moderation; env validation at boot; SRI/CSP headers.
3. **Medium:** order state machine + fulfillment simulation; coupon table; inventory; pagination; structured logging + health endpoint.
4. **Ongoing:** a11y pass, mobile nav, frontend tests, CI/CD, migrations (Alembic), doc drift cleanup.

*See `future_scopes.md` for the corresponding growth roadmap.*
