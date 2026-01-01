# RunnableSequence.from() - Complete Guide

## What Can Be Passed to RunnableSequence.from()?

`RunnableSequence.from()` accepts an array of **Runnable** objects or compatible types. Here's what you can pass:

### 1. **Object with Functions** (Your Current Pattern)

```typescript
{
  context: async () => { ... },
  question: () => lastUserMessage,
}
```

**How it works:**
- Each key becomes a property in the output object
- Functions execute in parallel (if async)
- Output: `{ context: "...", question: "..." }`

**Example:**
```typescript
RunnableSequence.from([
  {
    context: async () => "Some context",
    question: (input) => input.question,
    metadata: () => ({ timestamp: Date.now() }),
  },
  // Next step receives: { context: "...", question: "...", metadata: {...} }
])
```

### 2. **Prompt Templates**

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);

RunnableSequence.from([
  prompt,  // ✅ Valid
  model,
]);
```

**What it does:**
- Formats input using template variables
- Output: Formatted messages for the model

### 3. **LLM Models**

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({ ... });

RunnableSequence.from([
  prompt,
  model,  // ✅ Valid
]);
```

**What it does:**
- Takes formatted messages from previous step
- Generates AI response
- Output: `AIMessage` or `ChatMessage`

### 4. **Functions (Sync or Async)**

```typescript
RunnableSequence.from([
  (input) => input.toUpperCase(),           // ✅ Sync function
  async (upper) => `Processed: ${upper}`,   // ✅ Async function
  (processed) => ({ result: processed }),   // ✅ Transform
]);
```

**What it does:**
- Transforms data step by step
- Each function receives output from previous step

### 5. **RunnableLambda**

```typescript
import { RunnableLambda } from "@langchain/core/runnables";

RunnableSequence.from([
  RunnableLambda.from(async (input) => {
    // Custom processing with error handling
    try {
      return await processData(input);
    } catch (error) {
      return { error: error.message };
    }
  }),
]);
```

**Use when:**
- You need explicit error handling
- You want to use LangChain's built-in features (streaming, batching, etc.)

### 6. **RunnablePassthrough**

```typescript
import { RunnablePassthrough } from "@langchain/core/runnables";

RunnableSequence.from([
  RunnablePassthrough.assign({
    processed: async (input) => {
      // Add new property while keeping existing ones
      return processData(input);
    },
  }),
]);
```

**What it does:**
- Passes through all existing properties
- Adds new properties via `.assign()`

### 7. **Other Chains**

```typescript
const subChain = RunnableSequence.from([...]);

RunnableSequence.from([
  subChain,  // ✅ Nested chain
  model,
]);
```

### 8. **Tools**

```typescript
import { tool } from "langchain";

const weatherTool = tool(
  async (input) => { ... },
  { name: "weather", schema: ... }
);

RunnableSequence.from([
  weatherTool,  // ✅ Can be used (though usually in agents)
]);
```

---

## Your Current Code Breakdown

```typescript
const ragChain = RunnableSequence.from([
  // Step 1: Object with functions - prepares multiple values
  {
    context: async () => {
      // Builds context from vector store + weather API
      return contextString;
    },
    question: () => lastUserMessage,
  },
  // Output: { context: "...", question: "..." }
  
  // Step 2: Prompt template - formats the data
  prompt,  // ChatPromptTemplate
  // Takes: { context: "...", question: "..." }
  // Output: Formatted messages array
  
  // Step 3: Model - generates response
  model,  // ChatGoogleGenerativeAI
  // Takes: Formatted messages
  // Output: AIMessage with content
]);
```

**Flow:**
1. **Object** → Creates `{ context, question }`
2. **Prompt** → Formats into messages: `[{ role: "system", content: "..." }, { role: "human", content: "..." }]`
3. **Model** → Generates AI response

---

## Common Patterns

### Pattern 1: Simple Transform Chain
```typescript
RunnableSequence.from([
  (input) => input.toUpperCase(),
  (upper) => `Result: ${upper}`,
]);
```

### Pattern 2: RAG Chain (Your Pattern)
```typescript
RunnableSequence.from([
  {
    context: async () => retrieveContext(),
    question: (input) => input.question,
  },
  prompt,
  model,
]);
```

### Pattern 3: Parallel Data Fetching
```typescript
RunnableSequence.from([
  {
    weather: async () => getWeather(),
    news: async () => getNews(),
    time: () => new Date().toISOString(),
  },
  prompt,
  model,
]);
```

### Pattern 4: Conditional Processing
```typescript
RunnableSequence.from([
  (input) => input,
  RunnableLambda.from(async (input) => {
    if (input.type === "weather") {
      return await getWeather(input.location);
    }
    return await getGeneralInfo(input);
  }),
  model,
]);
```

---

## Important Notes

1. **Order Matters**: Steps execute sequentially
2. **Output Type**: Each step's output becomes the next step's input
3. **Object Keys**: Object with functions creates parallel execution
4. **Async Support**: All functions can be async
5. **Error Handling**: Errors propagate through the chain

---

## What You CANNOT Pass

❌ **Plain values** (must be functions or Runnables):
```typescript
RunnableSequence.from([
  "hello",  // ❌ Error: Not a Runnable
  42,       // ❌ Error: Not a Runnable
]);
```

❌ **Objects with non-function values**:
```typescript
RunnableSequence.from([
  {
    name: "John",  // ❌ Not a function
    age: 30,       // ❌ Not a function
  },
]);
```

✅ **Objects with functions** (your pattern):
```typescript
RunnableSequence.from([
  {
    name: () => "John",     // ✅ Function
    age: () => 30,          // ✅ Function
    data: async () => {...} // ✅ Async function
  },
]);
```

---

## Summary

Your current code uses:
1. **Object with functions** - to prepare `context` and `question` in parallel
2. **Prompt template** - to format the data
3. **Model** - to generate the response

This is a standard and efficient RAG pattern! ✅
