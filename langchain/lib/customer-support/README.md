# 🎧 Customer Support Agent

A conversational customer support agent built with **LangChain only** (no LangGraph).

## Architecture

```
Customer ──► LangChain AgentExecutor
                 │
                 ├── 🔍 search_knowledge_base  →  Pinecone + Cohere rerank
                 ├── 📦 check_order_status      →  Mock order lookup
                 └── 🚨 escalate_to_human       →  Human handoff
                 │
                 ▼
            ChatGroq (llama-3.3-70b) ──► Response
```

## Stack

| Component       | Technology                          |
|----------------|--------------------------------------|
| LLM            | Groq — llama-3.3-70b-versatile       |
| Retrieval      | Pinecone (integrated embedding)      |
| Reranker       | Cohere rerank-v3.5                   |
| Agent          | LangChain `createToolCallingAgent`   |
| Memory         | LangChain `BufferMemory`             |

## Files

| File           | Purpose                                  |
|---------------|------------------------------------------|
| `data.ts`     | 12 knowledge base articles (6 categories)|
| `seed.ts`     | Seeds articles into Pinecone             |
| `retriever.ts`| Pinecone search → Cohere rerank pipeline |
| `agent.ts`    | LangChain agent with 3 tools             |
| `run.ts`      | Interactive CLI chat interface            |

## Quick Start

```bash
# 1. Seed the knowledge base into Pinecone
pnpm seed:support

# 2. Start the chat
pnpm support
```

## Example Queries

- "What's your return policy?"
- "How do I reset my password?"
- "Where is my order ORD-12345?"
- "What shipping options do you have?"
- "I received a damaged item, what do I do?"
- "I want to talk to a real person"

## Environment Variables

```
GROQ_API_KEY=...          # Required
PINECONE_API_KEY=...      # Required
COHERE_API_KEY=...        # Optional (degrades gracefully)
LANGSMITH_TRACING=true    # Optional
```
