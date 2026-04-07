/**
 * ══════════════════════════════════════════════════════════════════
 *  SIMPLE MULTI-AGENT WORKFLOW — Learn by Reading
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm simple-multi-agent
 *
 *  GRAPH STRUCTURE:
 *
 *  START
 *    │
 *    ▼
 *  [router]  ← reads user message, decides who handles it
 *    │
 *    ├──► [weather_agent]  → handles weather questions
 *    │
 *    ├──► [math_agent]     → handles math questions
 *    │
 *    └──► [general_agent]  → handles everything else
 *              │
 *              ▼
 *             END
 *
 *  That's it. One router, three workers, done.
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, Annotation, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────
//  STEP 1: Define the shared state
//
//  Every node reads from AND writes to this state object.
//  We only need two fields:
//    - messages  → the conversation (built-in, auto-appended)
//    - next      → which agent the router picks
// ──────────────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,          // gives us `messages` with append reducer
  next: Annotation<string>({
    reducer: (_prev, val) => val,      // always overwrite — latest value wins
    default: () => "",
  }),
});

// ──────────────────────────────────────────────────────────────────
//  STEP 2: Create the LLM
// ──────────────────────────────────────────────────────────────────

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY!,
});

// ──────────────────────────────────────────────────────────────────
//  STEP 3: Define the ROUTER node
//
//  The router:
//  1. Reads the last user message
//  2. Uses structured output to pick an agent
//  3. Writes { next: "weather" | "math" | "general" } to state
//  4. Does NOT write any message — it just sets routing
// ──────────────────────────────────────────────────────────────────

const routerSchema = z.object({
  next: z.enum(["weather", "math", "general"]).describe(
    "weather → weather questions, math → calculations, general → everything else"
  ),
});

async function routerNode(state: typeof AgentState.State) {
  const lastMessage = state.messages.at(-1);
  const userText = lastMessage ? String(lastMessage.content) : "";

  console.log(`\n🔀 ROUTER reading: "${userText}"`);

  const result = await llm
    .withStructuredOutput(routerSchema)
    .invoke([
      new SystemMessage(
        "You are a router. Classify the user question: " +
        "'weather' for weather questions, " +
        "'math' for calculations or numbers, " +
        "'general' for everything else."
      ),
      new HumanMessage(userText),
    ]);

  console.log(`   → routes to: "${result.next}"`);

  // Only write `next` — no messages
  return { next: result.next };
}

// ──────────────────────────────────────────────────────────────────
//  STEP 4: Define the WORKER nodes
//
//  Each worker:
//  1. Reads the messages from state
//  2. Answers the question
//  3. Appends ONE new AIMessage to state
// ──────────────────────────────────────────────────────────────────

async function weatherNode(state: typeof AgentState.State) {
  console.log("\n🌤  WEATHER AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a weather expert. Answer weather questions clearly and concisely."
    ),
    ...state.messages,
  ]);

  // Return only the new message — reducer will APPEND it
  return { messages: [response] };
}

async function mathNode(state: typeof AgentState.State) {
  console.log("\n🔢 MATH AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a math expert. Solve calculations step by step. Show your work."
    ),
    ...state.messages,
  ]);

  return { messages: [response] };
}

async function generalNode(state: typeof AgentState.State) {
  console.log("\n💬 GENERAL AGENT answering...");

  const response = await llm.invoke([
    new SystemMessage(
      "You are a helpful assistant. Answer the question clearly."
    ),
    ...state.messages,
  ]);

  return { messages: [response] };
}

// ──────────────────────────────────────────────────────────────────
//  STEP 5: Build the graph
//
//  .addNode()            — register a node by name
//  .addEdge()            — fixed connection A → B
//  .addConditionalEdges() — dynamic connection based on state
//  .compile()            — seal the graph so it can be invoked
// ──────────────────────────────────────────────────────────────────

const graph = new StateGraph(AgentState)
  // Register nodes
  .addNode("router",  routerNode)
  .addNode("weather", weatherNode)
  .addNode("math",    mathNode)
  .addNode("general", generalNode)

  // Entry point: always start at router
  .addEdge(START, "router")

  // Dynamic routing: read state.next to decide which worker runs
  .addConditionalEdges(
    "router",                                // from this node...
    (state) => state.next,                   // ...read this field...
    {                                        // ...map values to node names
      weather: "weather",
      math:    "math",
      general: "general",
    }
  )

  // All workers go to END when done
  .addEdge("weather", END)
  .addEdge("math",    END)
  .addEdge("general", END)

  .compile(); // no checkpointer = stateless (each call is independent)

// ──────────────────────────────────────────────────────────────────
//  STEP 6: Run it
// ──────────────────────────────────────────────────────────────────

async function ask(question: string) {
  console.log("\n" + "─".repeat(50));
  console.log(`❓ Question: "${question}"`);

  const result = await graph.invoke({
    messages: [new HumanMessage(question)],
  });

  // The last message is the worker's response
  const answer = result.messages.at(-1) as AIMessage;
  console.log(`✅ Answer:   ${String(answer.content)}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  SIMPLE MULTI-AGENT — Router + 3 Workers ║");
  console.log("╚══════════════════════════════════════════╝");

  await ask("What is the weather like in Tokyo in summer?");
  await ask("What is 1337 * 42?");
  await ask("What is the capital of Vietnam?");
  await ask("Will it rain in London tomorrow?");
  await ask("If I have 200 apples and give away 35%, how many remain?");
}

main().catch(console.error);
