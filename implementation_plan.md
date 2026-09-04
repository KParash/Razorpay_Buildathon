# Architectural Refactoring Plan: Postgres Persistence, Token Tracking, & State Consistency

This plan outlines the design changes to address your goals of persisting conversations to a database, tracking token usage across all LLM nodes, and ensuring nodes have consistent access to the data they need.


## Proposed Changes

---

### 1. Database Persistence for LangGraph (MVP)

To ensure conversations survive server restarts during this MVP phase, we will use the existing Postgres-backed LangGraph checkpointer via Supabase.

#### [MODIFY] `graph.py`
- Use `PostgresSaver` (from the `langgraph-checkpoint-postgres` package).
- Initialize it from the existing `DATABASE_URL` Supabase connection string.
- Pass the `PostgresSaver` to the graph compilation step (`builder.compile(checkpointer=postgres_saver)`).

#### [MODIFY] `requirements.txt`
- Keep `langgraph-checkpoint-postgres`; remove any outdated local checkpoint dependency if present.

---

### 2. Token Tracking Across Nodes

We need to accurately track the token usage of every LLM call made during the graph execution and surface it in the API responses. We will rely on the exact token usage returned in Groq's response metadata, avoiding the need to run our own local tokenizer like `tiktoken` purely for reporting.

#### [MODIFY] `schema.py`
- Add a new field to `AgentState` to accumulate tokens. Since multiple nodes (like the worker swarm) run in parallel, we'll use `operator.add` to safely sum them up:
  ```python
  class TokenUsage(TypedDict):
      prompt_tokens: int
      completion_tokens: int
      total_tokens: int

  class AgentState(TypedDict):
      # ... existing fields ...
      token_usage: Annotated[TokenUsage, add_tokens] # Custom reducer to sum up dictionaries
  ```

#### [MODIFY] `nodes.py`
- In every node that calls an LLM (`master_router_node`, `clarifier_node`, `worker_swarm_node` tasks, and `synthesis_node`), we will extract the token usage from the LLM's response metadata.
- Example update for a node:
  ```python
  res = await llm.ainvoke(prompt)
  usage = res.response_metadata.get("token_usage", {})
  return {
      "messages": [...],
      "token_usage": {
          "prompt_tokens": usage.get("prompt_tokens", 0),
          "completion_tokens": usage.get("completion_tokens", 0),
          "total_tokens": usage.get("total_tokens", 0)
      }
  }
  ```

#### [MODIFY] `main.py`
- In `/v1/chat/completions` and `/api/chat`, extract the accumulated `token_usage` from the final graph state `res`.
- Replace the hardcoded `100`/`50` tokens with the actual aggregated numbers.

---

### 3. Consistent Data Access for Nodes

To ensure each node receives precisely the data it needs to do its job, we will refine how context is passed. Currently, only the router heavily uses the chat history.

#### [MODIFY] `nodes.py`
- **Clarifier Node:** Update the prompt to optionally receive a summary of the `messages` history so it doesn't repeat questions it has already asked in previous turns.
- **Synthesis Node:** Inject the user's `customer_profile` and recent `messages` context into its prompt so it can personalize its tone based on the user's past interaction style, rather than just acting as a static formatter.
- **Worker Swarm:** Ensure the workers have strict dependency boundaries. For instance, the stylist worker should have access to the user's `disliked_colors` from the `customer_profile` (currently it only uses the occasion).

---

### 4. State Pruning (Context Window Management)

To ensure the LLM does not crash due to exceeding its token limit in long-running conversations stored in Postgres-backed checkpoints, we will implement a state pruning mechanism.

#### [MODIFY] `schema.py` / `graph.py`
- Add a new node or function (`prune_messages_node`) before the `master_router_node` that inspects the `messages` array in the state.
- Use `tiktoken` (or a simple word-count heuristic for the MVP) to measure the approximate length of the message history.
- If the token count exceeds a safe threshold (e.g., 4000 tokens), we will truncate the oldest messages, keeping only the recent `N` turns. (Since LangGraph's message state uses `operator.add`, we can overwrite the `messages` array by returning a `RemoveMessage` operation for older IDs).
- Add `tiktoken` to `requirements.txt`.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. Start the server and initiate a chat via the frontend or API.
2. Restart the server and send a follow-up message using the same `session_id`. Verify that the agent remembers the context (confirming Postgres-backed persistence).
3. Inspect the JSON response payload from `/api/chat` or `/v1/chat/completions` and verify that `total_tokens` dynamically increases based on the conversation complexity, accurately reflecting Groq's token metadata.
4. Verify the worker nodes reject items appropriately if `disliked_colors` are violated by updating the stylist prompt.
