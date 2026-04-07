# Multi-Agent Workflow — Deep Dive

> Run: `pnpm multi-agent`

## What This Demo Does

It compares **single-agent** vs **multi-agent** approaches using the same EC2
Security Group domain you already know.

```
SINGLE AGENT                          MULTI-AGENT
═══════════                           ═══════════
User ──► [Agent + 6 tools] ──► Answer  User ──► [Supervisor] ──┬──► Recon Agent (3 tools)
                                                                ├──► Security Agent (3 tools)
                                                                └──► Reporter Agent (0 tools)
```

---

## Concepts Cheat Sheet

### 1. Annotation (State Shape)

```typescript
const MyState = Annotation.Root({
  ...MessagesAnnotation.spec,        // auto-appended messages
  nextAgent: Annotation<string>(),    // overwrite reducer
  findings:  Annotation<string[]>(),  // append reducer
});
```

- **Reducer** = how new values merge into existing state
- `messages` uses `messagesStateReducer` → **appends** (never overwrites)
- You can define custom reducers: `(prev, next) => [...prev, ...next]`

### 2. StateGraph

```typescript
const graph = new StateGraph(MyState)
  .addNode("supervisor", supervisorFn)
  .addNode("recon",      reconFn)
  .addEdge(START, "supervisor")           // static edge
  .addConditionalEdges("supervisor", routerFn, ["recon", END])  // dynamic edge
  .addEdge("recon", "supervisor");        // loop back
```

- **Node** = a function `(state) → partial state update`
- **Edge** = connection between nodes (static or conditional)
- **Conditional Edge** = reads state to decide which node is next

### 3. Checkpointer

```typescript
const checkpointer = new MemorySaver();
const compiled = graph.compile({ checkpointer });
```

- Saves state **after every node execution**
- Without it: each invoke is stateless (no memory)
- With it: resume conversations across calls

### 4. Thread

```typescript
await compiled.invoke(
  { messages: [new HumanMessage("hello")] },
  { configurable: { thread_id: "session-123" } }
);
```

- `thread_id` = isolated conversation session
- Same thread_id → remembers previous messages
- Different thread_id → fresh start (like opening a new browser tab)

### 5. Supervisor Pattern

```
User → Supervisor → Specialist A → Supervisor → Specialist B → Supervisor → END
```

- Supervisor has NO tools — it only routes
- Uses structured output to pick the next agent
- Keeps looping until it decides "FINISH"

---

## Flow Comparison

### Single Agent Flow
```
1. User message arrives
2. LLM sees 6 tools, picks one
3. Tool executes, result returns to LLM
4. LLM picks another tool or answers
5. Done — no state saved (unless you add MemorySaver)
```

### Multi-Agent Flow
```
1. User message arrives
2. Supervisor reads message, picks "recon"
3. Checkpoint saved ← (state persisted)
4. Recon agent runs (3 tools), gathers data
5. Checkpoint saved ←
6. Supervisor reads updated state, picks "security"
7. Checkpoint saved ←
8. Security agent runs (3 tools), finds vulnerabilities
9. Checkpoint saved ←
10. Supervisor picks "reporter"
11. Checkpoint saved ←
12. Reporter writes summary (no tools, pure LLM)
13. Checkpoint saved ←
14. Supervisor picks "FINISH"
15. Done — full history in checkpointer
```

### When Each Node Runs:

```
  Time →
  ┌────────────┬──────────┬────────────┬──────────┬────────────┬──────────┬────────┐
  │ Supervisor │  Recon   │ Supervisor │ Security │ Supervisor │ Reporter │ Super. │
  │ → "recon"  │ (tools)  │ → "secur." │ (tools)  │ → "report" │ (write)  │→ END   │
  └────────────┴──────────┴────────────┴──────────┴────────────┴──────────┴────────┘
       ↑ checkpoint          ↑ checkpoint           ↑ checkpoint          ↑ final
```

---

## Checkpoint Timeline (What Gets Saved)

```
Thread "demo-thread-1":

  Checkpoint 1: { messages: [Human], nextAgent: "recon",    agentsUsed: ["supervisor"]           }
  Checkpoint 2: { messages: [H,AI,T,AI], nextAgent: "recon", agentsUsed: ["supervisor","recon"]   }
  Checkpoint 3: { messages: [...], nextAgent: "security",    agentsUsed: ["...","supervisor"]      }
  Checkpoint 4: { messages: [...], nextAgent: "security",    agentsUsed: ["...","security"]        }
  Checkpoint 5: { messages: [...], nextAgent: "reporter",    agentsUsed: ["...","supervisor"]      }
  Checkpoint 6: { messages: [...], nextAgent: "reporter",    agentsUsed: ["...","reporter"]        }
  Checkpoint 7: { messages: [...], nextAgent: "FINISH",      agentsUsed: ["...","supervisor"]      }

Next call with same thread_id → loads Checkpoint 7 → resumes with full context!
```

---

## Architecture Patterns

### Pattern A: Supervisor (this demo)
```
Supervisor routes to specialists, loops until done.
Best for: workflows where the ORDER matters.
```

### Pattern B: Parallel Fan-Out
```typescript
// Using Send() for parallel execution
.addConditionalEdges("router", (state) => [
  new Send("agentA", { messages: state.messages }),
  new Send("agentB", { messages: state.messages }),
]);
```
```
Best for: independent tasks that can run simultaneously.
```

### Pattern C: Hierarchical
```
SuperSupervisor → SubSupervisor A → Agent 1, Agent 2
                → SubSupervisor B → Agent 3, Agent 4
```
```
Best for: very large systems with 20+ agents.
```

---

## Key Takeaways

| Aspect | Single Agent | Multi-Agent |
|--------|-------------|-------------|
| Tools per agent | All in one | 2-3 each (focused) |
| LLM accuracy | Degrades >10 tools | Stable at any scale |
| LLM calls | 1 chain | 3-7 calls per request |
| Cost | Lower | Higher |
| Debugging | 1 trace | Agent-by-agent traces |
| When to use | Simple tasks, <5 tools | Complex workflows, >5 tools |
