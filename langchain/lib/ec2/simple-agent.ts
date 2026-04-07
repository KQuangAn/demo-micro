/**
 * ══════════════════════════════════════════════════════════════════
 *  Simple Agent — Single-pass LLM + Tools
 * ══════════════════════════════════════════════════════════════════
 *
 *  Uses LangChain's createAgent (internally createReactAgent from
 *  langgraph/prebuilt but with a single-step focus).
 *
 *  • One LLM call (may include a tool call + response)
 *  • No persistent memory / checkpoints
 *  • Best for: straightforward questions, listing, searching
 *
 * ══════════════════════════════════════════════════════════════════
 */

import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ec2Tools } from "./tools";
import { ensureSynced } from "./sg-sync";
import type { BaseMessage, AIMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";

const SYSTEM_PROMPT = `You are an AWS EC2 Security Group assistant.

You help users understand their EC2 security groups, find misconfigurations,
and recommend security improvements.

Rules:
- Always use the provided tools to get data. Never make up security group IDs or rules.
- When analyzing security, be specific about which rules are problematic and why.
- Provide actionable recommendations.
- Format findings clearly with severity levels.
- If the user asks about a specific group, look it up first.
- If asked about overall security posture, use the analyze_all tool.

You have access to tools that can:
1. List all security groups
2. Get a specific group by ID or name
3. Search groups by keyword
4. Find groups with specific ports open to the internet
5. Analyze a single group for security issues
6. Run a full security audit across all groups
7. Re-sync security groups from AWS`;

export async function runSimpleAgent(
  userMessage: string,
  model: ChatGroq
): Promise<string> {
  await ensureSynced();

  const agent = createAgent({
    model: model,
    tools: ec2Tools,
    systemPrompt: SYSTEM_PROMPT,
  });

  const result = await agent.invoke({
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract last AI message
  const messages: BaseMessage[] = result.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === "ai" && typeof (msg as AIMessage).content === "string" && (msg as AIMessage).content) {
      return (msg as AIMessage).content as string;
    }
  }

  return "I wasn't able to generate a response. Please try again.";
}
