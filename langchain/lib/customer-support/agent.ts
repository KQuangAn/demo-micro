/**
 * Customer Support Agent — uses createToolCallingAgent + AgentExecutor
 */

import { ChatGroq } from "@langchain/groq";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { z } from "zod";
import { retrieveArticles, formatContext } from "./retriever";

// ─── Tools ─────────────────────────────────────────────────────────

const searchKnowledgeBase = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description:
    "Search the customer support knowledge base for relevant FAQ articles, " +
    "policies, and troubleshooting guides. Use this to answer questions about " +
    "billing, shipping, returns, accounts, products, and technical issues.",
  schema: z.object({
    query: z.string().describe("The search query — rephrase the customer question for optimal retrieval"),
  }),
  func: async ({ query }) => formatContext(await retrieveArticles(query, { topN: 3 })),
});

const escalateToHuman = new DynamicStructuredTool({
  name: "escalate_to_human",
  description:
    "Escalate the conversation to a human support agent. Use this ONLY when " +
    "you cannot answer from the knowledge base, or the customer explicitly asks for a human.",
  schema: z.object({
    reason: z.string().describe("Brief reason for escalation"),
    priority: z.enum(["low", "medium", "high", "urgent"]).describe("Escalation priority based on severity"),
  }),
  func: async ({ reason, priority }) => {
    const eta = priority === "urgent" ? "1 hour" : priority === "high" ? "4 hours" : "24 hours";
    return JSON.stringify({ escalated: true, reason, priority, message: `Escalated to support team (priority: ${priority}). ETA: ${eta}.` });
  },
});

const checkOrderStatus = new DynamicStructuredTool({
  name: "check_order_status",
  description: "Look up the status of a customer order by order number (e.g. ORD-12345).",
  schema: z.object({
    orderNumber: z.string().describe("The order number (e.g. ORD-12345)"),
  }),
  func: async ({ orderNumber }) => {
    const mockOrders: Record<string, any> = {
      "ORD-12345": { status: "shipped", carrier: "UPS", tracking: "1Z999AA10123456784", estimatedDelivery: "April 18, 2026", items: ["Blue Cotton T-Shirt (L)", "Running Shoes (Size 10)"] },
      "ORD-67890": { status: "processing", estimatedDelivery: "April 22, 2026", items: ["Wireless Headphones", "Phone Case"] },
      "ORD-11111": { status: "delivered", carrier: "USPS", deliveredAt: "April 14, 2026", items: ["Laptop Stand"] },
    };
    const order = mockOrders[orderNumber.toUpperCase()];
    return order ? JSON.stringify(order, null, 2) : `No order found for "${orderNumber}". Format: ORD-XXXXX.`;
  },
});

const tools = [searchKnowledgeBase, escalateToHuman, checkOrderStatus];

// ─── Prompt ────────────────────────────────────────────────────────

const prompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a friendly, professional customer support agent for AcmeStore.

RULES:
1. Always search the knowledge base before answering policy/product questions
2. NEVER fabricate information — only use what the tools return
3. For order inquiries, use check_order_status
4. If you truly can't help, use escalate_to_human
5. Be concise, use bullet points where helpful
6. End with "Is there anything else I can help with?"

COMPANY: AcmeStore (acmestore.com)`],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

// ─── Agent ─────────────────────────────────────────────────────────

function buildExecutor() {
  const llm = new ChatGroq({ model: "llama-3.3-70b-versatile", temperature: 0.3, apiKey: process.env.GROQ_API_KEY });
  const agent = createToolCallingAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, maxIterations: 5 });
}

export class SupportAgent {
  private executor = buildExecutor();
  private chatHistory: any[] = [];

  async chat(userMessage: string): Promise<{ answer: string; toolsUsed: string[] }> {
    const toolsUsed: string[] = [];

    const result = await this.executor.invoke(
      { input: userMessage, chat_history: this.chatHistory },
      { callbacks: [{ handleToolStart: (_, input, _id, name) => { toolsUsed.push(name ?? ""); } }] },
    );

    this.chatHistory.push({ role: "human", content: userMessage });
    this.chatHistory.push({ role: "assistant", content: result.output });

    return { answer: result.output, toolsUsed };
  }

  reset() {
    this.chatHistory = [];
  }
}

export function createSupportAgent(): SupportAgent {
  return new SupportAgent();
}
