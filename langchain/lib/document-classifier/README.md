# Document Classifier — LangGraph Agent

A production-ready AI agent that classifies document images using a LangGraph state machine with Gemini vision, confidence-based routing, retry logic, and LangSmith observability.

## Architecture

```
START
  │
  ▼
[validate]         ← check image input is valid
  │
  ├── error ──────────────────────────► [flagForReview] ──► END
  │
  ▼
[classify]         ← Gemini 2.0 Flash vision model
  │
  ▼
[checkConfidence]  ← route by confidence score
  │
  ├── ≥ 0.7 (high) ──────────────────► [extractFields] ──► END
  │
  ├── 0.4–0.7 + retries left ────────► [classify] (loop)
  │
  └── < 0.4 or max retries ──────────► [flagForReview] ──► END
```

## Supported Document Categories

| Category | Examples |
|---|---|
| `cv` | Resumes, CVs |
| `invoice` | Invoices, bills |
| `meeting-note` | Meeting minutes, notes |
| `contract` | Legal contracts, agreements |
| `receipt` | Store receipts |
| `letter` | Formal/informal letters |
| `report` | Reports, analyses |
| `form` | Application forms, surveys |
| `presentation` | Slide decks |
| `unknown` | Unclassifiable documents |

## Quick Start

```bash
# 1. Set env vars in langchain/.env
GOOGLE_API_KEY=your_gemini_api_key
LANGCHAIN_TRACING_V2=true
LANGSMITH_API_KEY=lsv2_...

# 2. Run demo
pnpm classify-doc

# 3. Classify a local file
pnpm classify-doc path/to/document.png
```

## Files

| File | Purpose |
|---|---|
| `types.ts` | Document categories, Zod schemas, input/output types |
| `state.ts` | LangGraph state definition (Annotation) |
| `nodes.ts` | Graph nodes: validate, classify, checkConfidence, extractFields, flagForReview |
| `graph.ts` | Graph wiring, `classifyDocument()` high-level API |
| `run.ts` | CLI runner with demo images |

## LangSmith Tracing

Every run is automatically traced in LangSmith:

- Each node appears as a named span
- LLM calls show input/output/tokens/latency
- Conditional edges show routing decisions
- Retry loops are visible in the trace tree

View traces: https://smith.langchain.com → project `document-classifier`

## API Usage

```typescript
import { classifyDocument } from "./graph";

const result = await classifyDocument({
  image: base64String,    // or URL
  mimeType: "image/png",
  filename: "invoice.png",
});

console.log(result.classification.category);    // "invoice"
console.log(result.classification.confidence);  // 0.95
console.log(result.needsHumanReview);           // false
console.log(result.processingTimeMs);           // 1234
```

## Production Considerations

- **Retry logic**: Medium-confidence results retry up to 2 times
- **Human-in-the-loop**: Low-confidence results flagged for human review
- **Input validation**: MIME type and data presence checked before LLM call
- **Structured output**: Zod schema validates LLM responses
- **Observability**: Full LangSmith trace for every classification
- **Checkpointer**: Optional MemorySaver for thread-based state persistence
