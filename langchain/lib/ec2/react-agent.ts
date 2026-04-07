import { createReactAgent } from '@langchain/langgraph/prebuilt';
/**
 * ══════════════════════════════════════════════════════════════════
 *  ReAct Agent — Multi-step Reasoning with Memory & Checkpoints
 * ══════════════════════════════════════════════════════════════════
 *
 *  Uses LangGraph's createReactAgent with:
 *  • MemorySaver checkpointer — persists conversation across calls
 *  • Multi-step reasoning loop (Thought → Action → Observation → …)
 *  • Thread-based sessions — each user gets isolated state
 *
 *  Best for: complex multi-step analysis, follow-up questions,
 *  "analyze X then compare with Y" type queries.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { ChatGroq } from "@langchain/groq";
import { MemorySaver } from "@langchain/langgraph";
import { ec2Tools } from "./tools";
import { ensureSynced } from "./sg-sync";
import type { BaseMessage, AIMessage } from "@langchain/core/messages";

/**
 * MemorySaver stores checkpoints in memory.
 * In production, replace with:
 *   - PostgresSaver  (@langchain/langgraph-checkpoint-postgres)
 *   - RedisSaver     (custom)
 *   - DynamoDB       (custom)
 *
 * The key insight: checkpoints let you resume a conversation
 * exactly where you left off, with full tool call history.
 */
const checkpointer = new MemorySaver();

const SYSTEM_PROMPT = `You are an expert AWS Security Engineer assistant specializing in EC2 Security Groups.

You help users:
1. Understand their security group configurations
2. Find and fix misconfigurations
3. Audit security posture
4. Explain networking concepts (ports, protocols, CIDR ranges)
5. Recommend best practices

Important behaviors:
- Think step by step. For complex questions, break them into sub-tasks.
- Use multiple tools when needed. E.g., list groups first, then analyze specific ones.
- Remember previous conversation context (you have memory).
- When you find critical issues, explain WHY they are dangerous, not just WHAT.
- Provide specific remediation steps, not just generic advice.
- Use severity levels: CRITICAL > HIGH > MEDIUM > LOW > INFO.

Example multi-step reasoning:
  User: "Is my infrastructure secure?"
  1. First, list all security groups to see what exists
  2. Then run a full security audit
  3. Summarize findings by severity
  4. Provide prioritized recommendations

You have access to tools that can list, search, get details, find open ports,
analyze individual groups, and run full security audits.`;

/**
 * Create the ReAct agent (singleton per process)
 * The agent itself is stateless — state lives in the checkpointer.
 */
let cachedAgent: ReturnType<typeof createReactAgent> | null = null;
let cachedModelId: string | null = null;

function getOrCreateAgent(model: ChatGroq): ReturnType<typeof createReactAgent> {
  const modelId = (model as any).model || "default";
  if (cachedAgent && cachedModelId === modelId) return cachedAgent;

  cachedAgent = createReactAgent({
    llm: model,
    tools: ec2Tools,
    checkpointer: checkpointer,
    stateModifier: SYSTEM_PROMPT,
  });
  cachedModelId = modelId;
  return cachedAgent;
}

export async function runReactAgent(
  userMessage: string,
  model: ChatGroq,
  threadId: string = "default"
): Promise<{ response: string; steps: number }> {
  await ensureSynced();

  const agent = getOrCreateAgent(model);

  /**
   * The config.configurable.thread_id is how LangGraph knows
   * which conversation to load/save.
   *
   * Same thread_id = continues previous conversation.
   * New thread_id  = fresh conversation.
   */
  const result = await agent.invoke(
    {
      messages: [{ role: "user", content: userMessage }],
    },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

  const messages: BaseMessage[] = result.messages;
  let steps = 0;

  // Count tool calls (each tool call = one reasoning step)
  for (const msg of messages) {
    if (msg._getType() === "tool") steps++;
  }

  // Extract last AI message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === "ai" && typeof (msg as AIMessage).content === "string" && (msg as AIMessage).content) {
      return { response: (msg as AIMessage).content as string, steps };
    }
  }

  return {
    response: "I wasn't able to generate a response. Please try again.",
    steps: 0,
  };
}

/**
 * Get conversation history for a thread
 */
export async function getThreadHistory(threadId: string): Promise<string[]> {
  try {
    const checkpoint = await checkpointer.get({
      configurable: { thread_id: threadId },
    });
    if (!checkpoint?.channel_values?.messages) return [];
    const messages = checkpoint.channel_values.messages as BaseMessage[];
    return messages
      .filter((m) => m._getType() === "ai" || m._getType() === "human")
      .map((m) => `${m._getType()}: ${m.content}`);
  } catch {
    return [];
  }
}
