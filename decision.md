# Architecture Decisions Log

This document tracks major technical decisions made during the development of the AI Stylist Agent.

## 1. Database Persistence for State Tracking
- **Decision:** Use SQLite (`langgraph-checkpoint-sqlite`) via LangGraph's `SqliteSaver`.
- **Rationale:** The MVP needs multi-turn memory without the overhead of standing up PostgreSQL or Redis. SQLite is file-based and perfectly adequate for local state testing. We will migrate to a production database (like Postgres) later.

## 2. Token Tracking
- **Decision:** Rely on Groq API's native response metadata (`res.response_metadata['token_usage']`) to accumulate token usage.
- **Rationale:** Avoids unnecessary local tokenizer calculations (e.g., via `tiktoken`) just for reporting usage, as Groq already returns precise numbers for Qwen.

## 3. State Pruning (Context Window Management)
- **Decision:** Implement a `prune_messages_node` before the router. We will use `tiktoken` (or simple heuristic) to roughly calculate history size and use LangGraph's `RemoveMessage` to delete older messages if they exceed safe token bounds.
- **Rationale:** SQLite storage grows indefinitely, but the LLM has a finite context window. Truncating old messages prevents API crash loops when the token limit is exceeded.

## 4. Embedding Model
- **Decision:** Use `all-MiniLM-L6-v2` via `sentence-transformers` for semantic search.
- **Rationale:** Runs locally on CPU, has zero API cost, and is fast enough for the MVP storefront search.
