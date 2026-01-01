# LangChain API Complete Guide

This guide covers all the essential LangChain APIs you need to know for building AI applications.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Language Models](#language-models)
3. [Agents](#agents)
4. [Tools](#tools)
5. [Chains](#chains)
6. [Memory](#memory)
7. [Prompts](#prompts)
8. [Output Parsers](#output-parsers)
9. [Callbacks & Streaming](#callbacks--streaming)
10. [Vector Stores & Retrievers](#vector-stores--retrievers)

---

## Core Concepts

### 1. Language Models (LLMs)

LangChain supports multiple LLM providers. You're currently using Google Gemini.

#### ChatGoogleGenerativeAI (Google Gemini)

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-pro",        // Model name
  temperature: 0.7,               // Creativity (0-1)
  apiKey: process.env.GOOGLE_API_KEY,
  maxTokens: 1000,                // Max output tokens
  topP: 0.9,                      // Nucleus sampling
  topK: 40,                       // Top-k sampling
});
```

**Other Model Providers:**

```typescript
// OpenAI
import { ChatOpenAI } from "@langchain/openai";
const openaiModel = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Anthropic
import { ChatAnthropic } from "@langchain/anthropic";
const anthropicModel = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.7,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});
```

**Key Methods:**
- `invoke(messages)` - Single call
- `stream(messages)` - Streaming response
- `batch(messages[])` - Batch processing

---

## 2. Agents

Agents are AI systems that can use tools to accomplish tasks.

### createAgent (Simple Agent)

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: chatModel,
  tools: [tool1, tool2],
  system: "You are a helpful assistant", // Optional system prompt
});

// Invoke the agent
const response = await agent.invoke({
  messages: [
    { role: "user", content: "What's the weather in Tokyo?" }
  ],
});

// Response structure:
// {
//   messages: [...],  // Full conversation history
//   steps: [...],     // Agent reasoning steps
// }
```

**Response Structure:**
```typescript
interface AgentResponse {
  messages: BaseMessage[];  // All messages including tool calls
  steps: AgentStep[];      // Reasoning steps
}
```

### Advanced Agent Types

```typescript
// ReAct Agent (Reasoning + Acting)
import { createReactAgent } from "langchain/agents";
const reactAgent = createReactAgent({
  llm: model,
  tools: tools,
});

// Plan-and-Execute Agent
import { createPlanAndExecuteAgent } from "langchain/agents";
const planner = createPlanAndExecuteAgent({
  model: model,
  tools: tools,
});
```

---

## 3. Tools

Tools are functions that agents can call to interact with the world.

### Creating Tools with `tool()`

```typescript
import { tool } from "langchain";
import * as z from "zod";

// Simple tool
const getWeather = tool(
  (input: { city: string }) => {
    // Your function logic
    return `It's sunny in ${input.city}!`;
  },
  {
    name: "get_weather",
    description: "Get weather for a city",
    schema: z.object({
      city: z.string().describe("The city name"),
    }),
  }
);
```

### Tool Schema with Zod

```typescript
import * as z from "zod";

const calculator = tool(
  (input: { operation: string; a: number; b: number }) => {
    switch (input.operation) {
      case "add": return input.a + input.b;
      case "subtract": return input.a - input.b;
      case "multiply": return input.a * input.b;
      case "divide": return input.a / input.b;
    }
  },
  {
    name: "calculator",
    description: "Perform basic math operations",
    schema: z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  }
);
```

### Dynamic Tools (Structured Tools)

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";

const searchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "Search the web",
  schema: z.object({
    query: z.string(),
  }),
  func: async ({ query }) => {
    // Your search logic
    return searchResults;
  },
});
```

### Tool Categories

```typescript
// HTTP/API Tools
import { Tool } from "@langchain/core/tools";
const apiTool = new Tool({
  name: "api_call",
  description: "Call external API",
  func: async (input: string) => {
    const response = await fetch(`https://api.example.com/${input}`);
    return response.json();
  },
});

// Database Tools
const dbTool = tool(
  async (input: { query: string }) => {
    // Database query logic
    return results;
  },
  {
    name: "database_query",
    description: "Query database",
    schema: z.object({ query: z.string() }),
  }
);
```

---

## 4. Chains

Chains combine multiple components together.

### Simple Chain

```typescript
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  (input) => input.toUpperCase(),
  (upper) => `Processed: ${upper}`,
]);

const result = await chain.invoke("hello");
// "Processed: HELLO"
```

### LLM Chain

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);

const chain = RunnableSequence.from([
  prompt,
  model,
]);

const result = await chain.invoke({ input: "Hello!" });
```

### Sequential Chain

```typescript
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  {
    input: (x: { input: string }) => x.input,
    context: async (x: { input: string }) => {
      // Fetch context
      return context;
    },
  },
  RunnablePassthrough.assign({
    answer: async (x) => {
      // Generate answer
      return answer;
    },
  }),
]);
```

---

## 5. Memory

Memory stores conversation history.

### ConversationBufferMemory

```typescript
import { ChatMessageHistory } from "@langchain/core/chat_history";
import { BufferMemory } from "langchain/memory";

const memory = new BufferMemory({
  returnMessages: true,
  memoryKey: "chat_history",
});

// Add messages
await memory.chatHistory.addUserMessage("Hello");
await memory.chatHistory.addAIChatMessage("Hi there!");

// Get messages
const messages = await memory.chatHistory.getMessages();
```

### ConversationSummaryMemory

```typescript
import { ConversationSummaryMemory } from "langchain/memory";

const memory = new ConversationSummaryMemory({
  llm: model,
  returnMessages: true,
});
```

### With Agent

```typescript
const agent = createAgent({
  model: model,
  tools: tools,
  memory: memory,  // Add memory
});
```

---

## 6. Prompts

Prompts define how to format input for the LLM.

### ChatPromptTemplate

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a {role}"],
  ["human", "{input}"],
]);

const formatted = await prompt.format({
  role: "chef",
  input: "How do I make pasta?",
});
```

### Few-Shot Prompts

```typescript
import { FewShotChatMessagePromptTemplate } from "@langchain/core/prompts";

const examples = [
  { input: "happy", output: "sad" },
  { input: "tall", output: "short" },
];

const examplePrompt = ChatPromptTemplate.fromMessages([
  ["human", "{input}"],
  ["ai", "{output}"],
]);

const fewShotPrompt = FewShotChatMessagePromptTemplate.fromExamples(
  examples,
  examplePrompt,
  "Give the antonym of: {input}"
);
```

### Prompt Templates

```typescript
import { PromptTemplate } from "@langchain/core/prompts";

const template = PromptTemplate.fromTemplate(
  "Translate {text} from {source} to {target}"
);

const prompt = await template.format({
  text: "Hello",
  source: "English",
  target: "Spanish",
});
```

---

## 7. Output Parsers

Parse structured output from LLMs.

### Structured Output Parser

```typescript
import { StructuredOutputParser } from "langchain/output_parsers";
import * as z from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

const parser = StructuredOutputParser.fromZodSchema(schema);

const chain = RunnableSequence.from([
  prompt,
  model,
  parser,
]);

const result = await chain.invoke({ input: "John, 30, john@example.com" });
// { name: "John", age: 30, email: "john@example.com" }
```

### JSON Parser

```typescript
import { OutputFixingParser } from "langchain/output_parsers";
import { JsonOutputParser } from "@langchain/core/output_parsers";

const parser = new JsonOutputParser();
const fixingParser = OutputFixingParser.fromLLM(model, parser);
```

### Custom Parser

```typescript
import { BaseOutputParser } from "@langchain/core/output_parsers";

class CustomParser extends BaseOutputParser<string> {
  async parse(text: string): Promise<string> {
    // Your parsing logic
    return parsedText;
  }
}
```

---

## 8. Callbacks & Streaming

### Streaming Responses

```typescript
const stream = await model.stream([
  { role: "user", content: "Tell me a story" }
]);

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Callbacks

```typescript
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

class CustomHandler extends BaseCallbackHandler {
  name = "custom_handler";

  async handleLLMStart(llm: any, prompts: string[]) {
    console.log("LLM started");
  }

  async handleLLMEnd(output: any) {
    console.log("LLM ended", output);
  }

  async handleLLMError(err: Error) {
    console.error("LLM error", err);
  }
}

const model = new ChatGoogleGenerativeAI({
  callbacks: [new CustomHandler()],
});
```

### With Agents

```typescript
const response = await agent.streamEvents(
  {
    messages: [{ role: "user", content: "Hello" }],
  },
  { version: "v2" }
);

for await (const event of response) {
  console.log(event);
}
```

---

## 9. Vector Stores & Retrievers

### Embeddings

```typescript
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai/embeddings";

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "models/embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});

const vectors = await embeddings.embedDocuments([
  "Hello world",
  "LangChain is great",
]);
```

### Vector Store

```typescript
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";

const documents = [
  new Document({ pageContent: "LangChain is a framework..." }),
  new Document({ pageContent: "It supports many LLM providers..." }),
];

const vectorStore = await MemoryVectorStore.fromDocuments(
  documents,
  embeddings
);
```

### Retrievers

```typescript
const retriever = vectorStore.asRetriever({
  k: 5,  // Number of documents to retrieve
});

const docs = await retriever.getRelevantDocuments("What is LangChain?");
```

### RAG (Retrieval Augmented Generation)

```typescript
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";

const ragChain = RunnableSequence.from([
  {
    context: async (input: { question: string }) => {
      const docs = await retriever.getRelevantDocuments(input.question);
      return docs.map(d => d.pageContent).join("\n");
    },
    question: (input: { question: string }) => input.question,
  },
  prompt,
  model,
]);
```

---

## 10. Advanced Patterns

### Parallel Processing

```typescript
import { RunnableMap } from "@langchain/core/runnables";

const map = new RunnableMap({
  weather: async () => getWeather("Tokyo"),
  news: async () => getNews("Tokyo"),
  time: async () => getTime("Tokyo"),
});

const results = await map.invoke({});
```

### Conditional Logic

```typescript
import { RunnableBranch } from "@langchain/core/runnables";

const branch = RunnableBranch.from([
  [
    (x: { topic: string }) => x.topic === "weather",
    weatherChain,
  ],
  [
    (x: { topic: string }) => x.topic === "news",
    newsChain,
  ],
  defaultChain,
]);
```

### Error Handling

```typescript
import { RunnableLambda } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  model,
  RunnableLambda.from(async (input) => {
    try {
      return JSON.parse(input.content);
    } catch (e) {
      return { error: "Invalid JSON" };
    }
  }),
]);
```

---

## Best Practices

### 1. Error Handling

```typescript
try {
  const response = await agent.invoke({ messages });
} catch (error) {
  if (error instanceof Error) {
    console.error("Agent error:", error.message);
  }
}
```

### 2. Token Management

```typescript
const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-pro",
  maxTokens: 1000,  // Limit output
  temperature: 0.7,
});
```

### 3. Rate Limiting

```typescript
import pLimit from "p-limit";

const limit = pLimit(5); // Max 5 concurrent requests

const results = await Promise.all(
  inputs.map(input => limit(() => model.invoke(input)))
);
```

### 4. Caching

```typescript
import { InMemoryCache } from "@langchain/core/caches";

const cache = new InMemoryCache();

const model = new ChatGoogleGenerativeAI({
  cache: cache,
  // ... other options
});
```

---

## Common Patterns in Your Project

### Current Pattern (Agent with Tools)

```typescript
// 1. Define tools
const tool = tool(
  (input) => result,
  { name, description, schema }
);

// 2. Create model
const model = new ChatGoogleGenerativeAI({ ... });

// 3. Create agent
const agent = createAgent({
  model,
  tools: [tool],
});

// 4. Invoke
const response = await agent.invoke({ messages });
```

### Alternative: Direct Model Usage

```typescript
// Without agent, direct model call
const response = await model.invoke([
  { role: "user", content: "Hello" }
]);
```

### Alternative: Chain Pattern

```typescript
const chain = RunnableSequence.from([
  prompt,
  model,
  parser,
]);

const result = await chain.invoke({ input });
```

---

## Resources

- **Official Docs**: https://js.langchain.com/
- **API Reference**: https://api.js.langchain.com/
- **GitHub**: https://github.com/langchain-ai/langchainjs
- **Cookbook**: https://cookbook.langchain.com/

---

## Quick Reference

| API | Purpose | Example |
|-----|---------|---------|
| `createAgent()` | Create AI agent | `createAgent({ model, tools })` |
| `tool()` | Define tool | `tool(fn, { name, schema })` |
| `ChatGoogleGenerativeAI` | Google Gemini model | `new ChatGoogleGenerativeAI({...})` |
| `invoke()` | Execute chain/agent | `await agent.invoke({ messages })` |
| `stream()` | Stream responses | `for await (const chunk of stream)` |
| `ChatPromptTemplate` | Create prompts | `ChatPromptTemplate.fromMessages([...])` |
| `RunnableSequence` | Chain operations | `RunnableSequence.from([...])` |

---

This guide covers the essential LangChain APIs. Start with agents and tools (what you're using), then explore chains, memory, and vector stores as needed for your use cases.

