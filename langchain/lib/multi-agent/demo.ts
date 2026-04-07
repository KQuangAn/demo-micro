/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                            ║
 * ║   MULTI-AGENT vs SINGLE-AGENT: A Deep Dive                                ║
 * ║                                                                            ║
 * ║   This file is a LEARNING TOOL, not production code.                       ║
 * ║   Every concept is explained inline with diagrams.                         ║
 * ║                                                                            ║
 * ║   Run:  pnpm multi-agent                                                  ║
 * ║                                                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │                                                                         │
 *  │   SINGLE AGENT (what you have now in react-agent.ts):                  │
 *  │                                                                         │
 *  │   User ──► [ONE Agent with ALL 7 tools] ──► Answer                     │
 *  │                                                                         │
 *  │   Problem: The agent sees 7 tools and has to pick the right ones.      │
 *  │   As tools grow to 20, 50, 100+ → the LLM gets confused.              │
 *  │                                                                         │
 *  │─────────────────────────────────────────────────────────────────────────│
 *  │                                                                         │
 *  │   MULTI-AGENT (what this file builds):                                 │
 *  │                                                                         │
 *  │                         ┌──────────────┐                                │
 *  │                         │  SUPERVISOR  │  (routes to the right agent)   │
 *  │                         │  (no tools)  │                                │
 *  │                         └──────┬───────┘                                │
 *  │                    ┌───────────┼───────────┐                            │
 *  │                    ▼           ▼           ▼                            │
 *  │              ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
 *  │              │ RECON    │ │ SECURITY │ │ REPORTER │                    │
 *  │              │ Agent    │ │ Agent    │ │ Agent    │                    │
 *  │              │ 3 tools  │ │ 3 tools  │ │ 0 tools  │                    │
 *  │              └──────────┘ └──────────┘ └──────────┘                    │
 *  │                                                                         │
 *  │   Each agent is a SPECIALIST with fewer tools → more accurate.         │
 *  │                                                                         │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  CONCEPTS COVERED:
 *
 *  1. Annotation       — How LangGraph defines shared state (the "memory shape")
 *  2. StateGraph       — The graph structure connecting nodes
 *  3. Nodes            — Each agent is a node (a function that reads/writes state)
 *  4. Edges            — How nodes connect (static edges vs conditional routing)
 *  5. Checkpointer     — How state persists across calls (thread-level memory)
 *  6. Thread           — Isolated conversation session (keyed by thread_id)
 *  7. Supervisor       — The orchestrator that decides which agent to call next
 *  8. Subgraph         — Nesting a full agent graph inside a parent graph
 *  9. Handoff          — How one agent passes control to another
 *  10. Human-in-loop   — Interrupting the graph to ask for human input
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import {
    StateGraph,
    MessagesAnnotation,
    Annotation,
    MemorySaver,
    Command,
    START,
    END,
} from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import {
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
} from "@langchain/core/messages";
import * as z from "zod";

// ─── Reuse existing store/tools ───────────────────────────────────
import {
    getAllSecurityGroups,
    getSecurityGroupById,
    getSecurityGroupByName,
    searchSecurityGroups,
    getGroupsWithOpenPort,
    analyzeSecurityGroup,
    getAnalysisSummary,
    upsertMany,
    clearStore,
} from "../ec2/sg-store";
import type { SecurityGroup, SecurityFinding } from "../ec2/types";
import { createAgent } from "langchain";

// ═══════════════════════════════════════════════════════════════════════════
//  PART 0: Seed data (so the demo works without AWS)
// ═══════════════════════════════════════════════════════════════════════════

function seedDemoData() {
    clearStore();
    const demoGroups: SecurityGroup[] = [
        {
            id: "sg-web001",
            name: "web-server-prod",
            description: "Production web servers",
            vpcId: "vpc-abc123",
            inboundRules: [
                { protocol: "tcp", fromPort: 443, toPort: 443, source: "0.0.0.0/0", description: "HTTPS" },
                { protocol: "tcp", fromPort: 80, toPort: 80, source: "0.0.0.0/0", description: "HTTP" },
                { protocol: "tcp", fromPort: 22, toPort: 22, source: "0.0.0.0/0", description: "SSH — DANGEROUS" },
            ],
            outboundRules: [
                { protocol: "-1", fromPort: 0, toPort: 65535, source: "0.0.0.0/0", description: "All outbound" },
            ],
            tags: { Environment: "production", Team: "platform" },
            syncedAt: new Date().toISOString(),
        },
        {
            id: "sg-db001",
            name: "database-prod",
            description: "Production PostgreSQL",
            vpcId: "vpc-abc123",
            inboundRules: [
                { protocol: "tcp", fromPort: 5432, toPort: 5432, source: "sg-web001", description: "PG from web" },
                { protocol: "tcp", fromPort: 5432, toPort: 5432, source: "10.0.0.0/8", description: "PG from VPN" },
            ],
            outboundRules: [],
            tags: { Environment: "production", Team: "data" },
            syncedAt: new Date().toISOString(),
        },
        {
            id: "sg-dev001",
            name: "dev-anything-goes",
            description: "Dev environment — wide open",
            vpcId: "vpc-dev999",
            inboundRules: [
                { protocol: "-1", fromPort: 0, toPort: 65535, source: "0.0.0.0/0", description: "ALL TRAFFIC — VERY DANGEROUS" },
            ],
            outboundRules: [
                { protocol: "-1", fromPort: 0, toPort: 65535, source: "0.0.0.0/0", description: "ALL TRAFFIC" },
            ],
            tags: { Environment: "development", Team: "dev" },
            syncedAt: new Date().toISOString(),
        },
    ];
    upsertMany(demoGroups);
    console.log(`📦 Seeded ${demoGroups.length} security groups\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
//
//  PART 1: DEFINE SPECIALIST TOOLS
//
//  Instead of 7 tools → 1 agent, we split into:
//    • Recon tools    (3) — list, search, get details
//    • Security tools (3) — find open ports, analyze one, analyze all
//    • Reporter       (0) — summarizes findings (LLM-only, no tools)
//
// ═══════════════════════════════════════════════════════════════════════════

function formatSG(sg: SecurityGroup): string {
    const inbound = sg.inboundRules
        .map((r: SecurityGroup["inboundRules"][0]) => `    ${r.protocol}:${r.fromPort}-${r.toPort} ← ${r.source} (${r.description})`)
        .join("\n");
    return `[${sg.id}] ${sg.name}\n  VPC: ${sg.vpcId}\n  Tags: ${Object.entries(sg.tags).map(([k, v]) => `${k}=${v}`).join(", ")}\n  Inbound:\n${inbound || "    (none)"}`;
}

// ── RECON TOOLS ──────────────────────────────────────────────────
const listGroupsTool = tool(
    async () => {
        const groups = getAllSecurityGroups();
        if (!groups.length) return "No security groups found.";
        return `Found ${groups.length} groups:\n\n${groups.map(formatSG).join("\n\n")}`;
    },
    { name: "list_security_groups", description: "List ALL security groups with their rules." }
);

const searchGroupsTool = tool(
    async (input: { query: string }) => {
        const results = searchSecurityGroups(input.query);
        if (!results.length) return `No groups matching "${input.query}".`;
        return `Found ${results.length} matching:\n\n${results.map(formatSG).join("\n\n")}`;
    },
    {
        name: "search_security_groups",
        description: "Search security groups by name, ID, or tag value.",
        schema: z.object({ query: z.string().describe("Search term") }),
    }
);

const getGroupTool = tool(
    async (input: { identifier: string }) => {
        const sg = getSecurityGroupById(input.identifier) || getSecurityGroupByName(input.identifier);
        if (!sg) return `"${input.identifier}" not found.`;
        return formatSG(sg);
    },
    {
        name: "get_security_group",
        description: "Get details of a specific security group by ID (sg-xxx) or name.",
        schema: z.object({ identifier: z.string().describe("SG ID or name") }),
    }
);

const reconTools = [listGroupsTool, searchGroupsTool, getGroupTool];

// ── SECURITY TOOLS ───────────────────────────────────────────────
const findOpenPortTool = tool(
    async (input: { port: number }) => {
        const groups = getGroupsWithOpenPort(input.port);
        if (!groups.length) return `No groups have port ${input.port} open to 0.0.0.0/0.`;
        return `${groups.length} group(s) with port ${input.port} open:\n\n${groups.map(formatSG).join("\n\n")}`;
    },
    {
        name: "find_open_port",
        description: "Find groups with a specific port open to the internet (0.0.0.0/0).",
        schema: z.object({ port: z.number().describe("Port number (22, 3306, 5432, etc.)") }),
    }
);

const analyzeOneTool = tool(
    async (input: { identifier: string }) => {
        const sg = getSecurityGroupById(input.identifier) || getSecurityGroupByName(input.identifier);
        if (!sg) return `"${input.identifier}" not found.`;
        const findings = analyzeSecurityGroup(sg);
        if (!findings.length) return `${sg.name}: No issues found ✅`;
        return findings.map((f: SecurityFinding) => `[${f.severity}] ${f.message}\n  → ${f.recommendation}`).join("\n\n");
    },
    {
        name: "analyze_security_group",
        description: "Audit a single security group for misconfigurations.",
        schema: z.object({ identifier: z.string().describe("SG ID or name") }),
    }
);

const analyzeAllTool = tool(
    async () => {
        const summary = getAnalysisSummary();
        if (summary.total === 0) return "No security issues found ✅";
        const header = `Total: ${summary.total} | CRITICAL: ${summary.critical} | HIGH: ${summary.high} | MEDIUM: ${summary.medium}`;
        const details = summary.findings
            .sort((a: SecurityFinding, b: SecurityFinding) => { const o: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }; return o[a.severity] - o[b.severity]; })
            .map((f: SecurityFinding) => `[${f.severity}] ${f.groupName}: ${f.message}\n  → ${f.recommendation}`);
        return `${header}\n\n${details.join("\n\n")}`;
    },
    { name: "analyze_all", description: "Full security audit across ALL security groups." }
);

const securityTools = [findOpenPortTool, analyzeOneTool, analyzeAllTool];

// ═══════════════════════════════════════════════════════════════════════════
//
//  PART 2: BUILD THE MULTI-AGENT GRAPH
//
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                                                                      │
//  │  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌────────────┐  │
//  │  │           │    │  RECON    │    │ SECURITY  │    │  REPORTER  │  │
//  │  │ SUPERVISOR├───►│  AGENT   │    │  AGENT    │    │  AGENT     │  │
//  │  │           │    │ 3 tools  │    │ 3 tools   │    │ no tools   │  │
//  │  │ (router)  │◄───┤          │    │           │    │            │  │
//  │  │           ├───►│          │    │           │    │            │  │
//  │  │           │◄───┤          │    │           │    │            │  │
//  │  │           ├────┼──────────┼───►│           │    │            │  │
//  │  │           │◄───┼──────────┼────┤           │    │            │  │
//  │  │           ├────┼──────────┼────┼───────────┼───►│            │  │
//  │  │           │◄───┼──────────┼────┼───────────┼────┤            │  │
//  │  │           ├───►│  END     │    │           │    │            │  │
//  │  └───────────┘    └──────────┘    └───────────┘    └────────────┘  │
//  │                                                                      │
//  │  The SUPERVISOR is the brain. It reads the conversation, decides     │
//  │  which specialist to call next, and knows when to stop.             │
//  │                                                                      │
//  └──────────────────────────────────────────────────────────────────────┘
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 1: ANNOTATION — The Shape of Shared State            │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  In a single agent, state is just `{ messages: BaseMessage[] }` │
 * │  In multi-agent, we add MORE fields to coordinate:            │
 * │                                                                │
 * │  • messages     — the full conversation (auto-appended)       │
 * │  • nextAgent    — who should run next (set by supervisor)     │
 * │  • findings     — accumulated security findings              │
 * │  • agentsUsed   — audit trail of which agents ran            │
 * │                                                                │
 * │  The "reducer" function defines HOW updates merge.            │
 * │  Messages use `messagesStateReducer` → appends new messages   │
 * │  Arrays use a custom reducer → concat                         │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

// Extend the built-in MessagesAnnotation with our custom fields
const MultiAgentState = Annotation.Root({
    // messages is the CORE of LangGraph — every node reads/writes messages.
    // The reducer auto-appends new messages (never overwrites).
    ...MessagesAnnotation.spec,

    // Which agent should run next? Set by the supervisor.
    nextAgent: Annotation<string>({
        reducer: (_prev, next) => next, // always overwrite with latest
        default: () => "supervisor",
    }),

    // Accumulated security findings from the security agent
    findings: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next], // append, never overwrite
        default: () => [],
    }),

    // Audit trail — which agents have been invoked
    agentsUsed: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),
});

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 2: SPECIALIST AGENTS (Nodes in the Graph)            │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  Each specialist is a createReactAgent — identical to your    │
 * │  existing single agent, but with FEWER tools and a FOCUSED    │
 * │  system prompt.                                                │
 * │                                                                │
 * │  The key difference from single-agent:                        │
 * │  • Single: 1 agent sees all 7 tools → picks wrong one 20%    │
 * │  • Multi:  3 agents see 2-3 tools each → picks right one 95% │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

function createModel(temp: number = 0.3): ChatGroq {
    return new ChatGroq({
        model: "llama-3.1-8b-instant",
        temperature: temp,
        apiKey: process.env.GROQ_API_KEY!,
    });
}

// ── Recon Agent: discovers what exists ──────────────────────────
const reconAgent = createAgent({
    model: createModel(),
    tools: reconTools,
    systemPrompt: `You are a RECONNAISSANCE specialist for AWS EC2 Security Groups.

Your ONLY job: discover and list security groups. You gather data — nothing else.
- List all groups, search by keyword, or get details for a specific group.
- Always return the raw data clearly. Do NOT analyze or recommend.
- After gathering data, your work is done. The security agent will analyze it.

You MUST use your tools to answer. Never make up data.`,
});

// ── Security Agent: analyzes for vulnerabilities ───────────────
const securityAgent = createAgent({
    model: createModel(),
    tools: securityTools,
    systemPrompt: `You are a SECURITY AUDITOR for AWS EC2 Security Groups.

Your ONLY job: find security vulnerabilities and misconfigurations.
- Use your tools to audit specific groups or run a full audit.
- Report findings with severity: CRITICAL > HIGH > MEDIUM > LOW > INFO.
- Explain WHY each finding is dangerous.
- Do NOT recommend fixes — the reporter agent will do that.

You MUST use your tools. Never make up findings.`,
});

// ── Reporter Agent: synthesizes a final report (no tools) ──────
// NOTE: This agent has NO tools — it's pure LLM reasoning.
// It reads the accumulated messages and produces a human-friendly report.
const reporterAgent = createAgent({
    model: createModel(0.5), // slightly more creative for report writing
    tools: [], // NO tools — the reporter just writes
    systemPrompt: `You are a SECURITY REPORT WRITER.

Your ONLY job: take the data gathered by the recon agent and findings from
the security agent, and produce a clear, actionable executive summary.

Format your report as:
1. Overview (how many groups, how many findings)
2. Critical & High findings (with specific remediation steps)
3. Summary table
4. Recommended priority order for fixes

Write for a CTO audience — clear, concise, actionable.`,
});

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 3: THE SUPERVISOR (the "brain" of multi-agent)       │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  The supervisor is NOT a ReAct agent. It's a plain LLM call   │
 * │  that reads the conversation and decides:                     │
 * │                                                                │
 * │  1. Which agent to call next?                                 │
 * │  2. Or should we finish? (route to END)                       │
 * │                                                                │
 * │  It uses structured output (Zod schema) to return:            │
 * │  { next: "recon" | "security" | "reporter" | "FINISH" }      │
 * │                                                                │
 * │  This is the ORCHESTRATION pattern — one brain directing      │
 * │  multiple workers.                                            │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

const routingSchema = z.object({
    next: z.enum(["recon", "security", "reporter", "FINISH"]).describe(
        "Which agent to call next, or FINISH if the task is complete."
    ),
    reasoning: z.string().describe("Brief explanation of why this agent was chosen."),
});

async function supervisorNode(
    state: typeof MultiAgentState.State
): Promise<typeof MultiAgentState.Update> {
    const supervisorModel = createModel(0.1); // very low temp for deterministic routing

    // Structured output: force the LLM to return { next, reasoning }
    const modelWithSchema = supervisorModel.withStructuredOutput(routingSchema);

    const systemMessage = new SystemMessage(`You are a SUPERVISOR orchestrating a team of specialist agents.

Your team:
  • "recon"    — Lists, searches, and gets details of EC2 security groups
  • "security" — Audits security groups for vulnerabilities and misconfigurations
  • "reporter" — Writes an executive summary report from gathered data

Your job: read the conversation and decide which agent to call NEXT.

Rules:
1. For questions about LISTING/SEARCHING groups → call "recon" first
2. For SECURITY/AUDIT questions → call "recon" first (to gather data), THEN "security"
3. After security analysis is done → call "reporter" for a summary
4. For simple greetings or non-security questions → go to "FINISH"
5. If ALL work is done → "FINISH"
6. NEVER call the same agent twice in a row unless new information is needed
7. For comprehensive audit: recon → security → reporter → FINISH

Agents already used: ${state.agentsUsed.join(" → ") || "(none yet)"}
Number of findings so far: ${state.findings.length}`);

    const response = await modelWithSchema.invoke([
        systemMessage,
        ...state.messages,
    ]);

    console.log(`\n🧠 SUPERVISOR decides: "${response.next}" (${response.reasoning})`);

    return {
        nextAgent: response.next,
        agentsUsed: ["supervisor"],
    };
}

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 4: NODE WRAPPERS                                     │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  Each specialist agent is wrapped in a function that:         │
 * │                                                                │
 * │  1. Receives the shared state                                 │
 * │  2. Invokes the agent                                         │
 * │  3. Returns state UPDATES (not the full state)                │
 * │                                                                │
 * │  The key insight: nodes return PARTIAL updates.               │
 * │  LangGraph applies the reducers to merge them into state.     │
 * │                                                                │
 * │  State before:  { messages: [A, B], findings: [] }            │
 * │  Node returns:  { messages: [C], findings: ["SSH open"] }     │
 * │  State after:   { messages: [A, B, C], findings: ["SSH open"]}│
 * │                                                                │
 * │  ↑ messages APPENDED (reducer), findings APPENDED (reducer)   │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

async function reconNode(
    state: typeof MultiAgentState.State
): Promise<typeof MultiAgentState.Update> {
    console.log("\n🔍 RECON AGENT running...");
    const result = await reconAgent.invoke({
        messages: state.messages,
    });

    // Return state updates — the reducers handle merging
    return {
        messages: result.messages.slice(state.messages.length), // only NEW messages
        agentsUsed: ["recon"],
    };
}

async function securityNode(
    state: typeof MultiAgentState.State
): Promise<typeof MultiAgentState.Update> {
    console.log("\n🛡️  SECURITY AGENT running...");
    const result = await securityAgent.invoke({
        messages: state.messages,
    });

    // Extract findings from the security agent's response
    const newMessages = result.messages.slice(state.messages.length);
    const findingTexts = newMessages
        .filter((m: BaseMessage) => m._getType() === "tool")
        .map((m: BaseMessage) => String(m.content))
        .filter((c: string) => c.includes("CRITICAL") || c.includes("HIGH") || c.includes("MEDIUM"));

    return {
        messages: newMessages,
        findings: findingTexts,
        agentsUsed: ["security"],
    };
}

async function reporterNode(
    state: typeof MultiAgentState.State
): Promise<typeof MultiAgentState.Update> {
    console.log("\n📝 REPORTER AGENT running...");
    const result = await reporterAgent.invoke({
        messages: state.messages,
    });

    return {
        messages: result.messages.slice(state.messages.length),
        agentsUsed: ["reporter"],
    };
}

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 5: CONDITIONAL EDGES (Dynamic Routing)               │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  Static edges:      A → B (always goes to B after A)          │
 * │  Conditional edges: A → ?(state) → B or C or D               │
 * │                                                                │
 * │  The supervisor sets `state.nextAgent`, and the conditional   │
 * │  edge reads it to decide which node to run next.              │
 * │                                                                │
 * │  This is HOW multi-agent routing works — the supervisor's     │
 * │  decision is stored in state, and the edge function reads it. │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

function routeFromSupervisor(state: typeof MultiAgentState.State): string {
    const next = state.nextAgent;
    if (next === "FINISH") return END;
    return next; // "recon", "security", or "reporter"
}

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 6: BUILDING THE GRAPH                                │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  StateGraph is the CORE of LangGraph. It defines:             │
 * │                                                                │
 * │  1. State shape (Annotation)                                  │
 * │  2. Nodes (functions that transform state)                    │
 * │  3. Edges (connections between nodes)                         │
 * │                                                                │
 * │  After defining, you COMPILE it into a runnable.              │
 * │  Only compiled graphs can be invoked.                         │
 * │                                                                │
 * │                                                                │
 * │  Visual representation of our graph:                          │
 * │                                                                │
 * │  START ──► supervisor ──┬──► recon    ──► supervisor           │
 * │                         ├──► security ──► supervisor           │
 * │                         ├──► reporter ──► supervisor           │
 * │                         └──► END                               │
 * │                                                                │
 * │  Notice: every specialist routes BACK to supervisor.           │
 * │  The supervisor keeps looping until it says "FINISH".         │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

function buildMultiAgentGraph() {
    const graph = new StateGraph(MultiAgentState)

        // ── Add nodes ────────────────────────────────────────────────
        .addNode("supervisor", supervisorNode)
        .addNode("recon", reconNode)
        .addNode("security", securityNode)
        .addNode("reporter", reporterNode)

        // ── Entry point ──────────────────────────────────────────────
        // START → supervisor (always start with the supervisor)
        .addEdge(START, "supervisor")

        // ── Conditional routing from supervisor ──────────────────────
        // Supervisor → (reads nextAgent) → recon / security / reporter / END
        .addConditionalEdges("supervisor", routeFromSupervisor, [
            "recon",
            "security",
            "reporter",
            END,
        ])

        // ── Specialists always route back to supervisor ──────────────
        // After each specialist finishes, supervisor decides what's next
        .addEdge("recon", "supervisor")
        .addEdge("security", "supervisor")
        .addEdge("reporter", "supervisor");

    return graph;
}

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  CONCEPT 7: CHECKPOINTER + THREADS                            │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  WITHOUT checkpointer:                                        │
 * │    Call 1: "list groups"          → response (state discarded)│
 * │    Call 2: "which ones are bad?"  → "I have no context" ❌    │
 * │                                                                │
 * │  WITH checkpointer + same thread_id:                          │
 * │    Call 1: "list groups"          → response (state SAVED)    │
 * │    Call 2: "which ones are bad?"  → uses saved state ✅       │
 * │                                                                │
 * │  Thread = isolated conversation. Different thread_ids         │
 * │  = completely independent conversations (like browser tabs).  │
 * │                                                                │
 * │  MemorySaver = in-memory (lost on restart).                   │
 * │  In production → PostgresSaver or RedisSaver.                 │
 * │                                                                │
 * │  CHECKPOINT FLOW:                                             │
 * │  ┌─────┐    ┌────────────┐    ┌─────────────┐                │
 * │  │START│───►│ Run Node A │───►│ Save state  │  ← checkpoint  │
 * │  └─────┘    └────────────┘    │ to thread X │                │
 * │                                └──────┬──────┘                │
 * │                                       │                       │
 * │  Next invoke with thread X:           │                       │
 * │  ┌────────────┐    ┌─────────────┐    ▼                      │
 * │  │ Load state │───►│ Run Node B │───►│ Save state │          │
 * │  │ from X     │    └────────────┘    │ to X again │          │
 * │  └────────────┘                      └────────────┘          │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

const checkpointer = new MemorySaver();

function compileGraph() {
    const graph = buildMultiAgentGraph();

    // compile() converts the graph definition into an executable
    // The checkpointer is attached here — it applies to ALL invocations
    return graph.compile({ checkpointer });
}

// ═══════════════════════════════════════════════════════════════════════════
//
//  PART 3: COMPARE SINGLE vs MULTI AGENT
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ┌────────────────────────────────────────────────────────────────┐
 * │  COMPARISON: Single Agent vs Multi-Agent                      │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  ┌─────────────┬──────────────────┬──────────────────────┐    │
 * │  │             │ Single Agent     │ Multi-Agent           │    │
 * │  ├─────────────┼──────────────────┼──────────────────────┤    │
 * │  │ Tools       │ 7 tools, 1 agent │ 3+3+0 across 3 agents│   │
 * │  │ Accuracy    │ ~80% right tool  │ ~95% right tool       │   │
 * │  │ Speed       │ 1 LLM call chain │ 3-5 LLM calls        │   │
 * │  │ Cost        │ Lower            │ Higher (more calls)   │   │
 * │  │ Scalability │ Degrades at 10+  │ Scales to 100+ tools │   │
 * │  │ Debugging   │ One big trace    │ Agent-by-agent traces│    │
 * │  │ Memory      │ Shared thread    │ Shared thread         │   │
 * │  └─────────────┴──────────────────┴──────────────────────┘    │
 * │                                                                │
 * │  Rule of thumb:                                               │
 * │  • < 5 tools → single agent is fine                           │
 * │  • 5-15 tools → consider multi-agent                          │
 * │  • 15+ tools → multi-agent is necessary                       │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 */

// ─── Single agent (for comparison) ───────────────────────────────
async function runSingleAgent(question: string): Promise<string> {
    console.log("\n" + "═".repeat(70));
    console.log("  🤖 SINGLE AGENT (all 7 tools in one agent)");
    console.log("═".repeat(70));
    console.log(`  Question: "${question}"\n`);

    const allTools = [...reconTools, ...securityTools];
    const singleAgent = createAgent({
        model: createModel(),
        tools: allTools,
        systemPrompt: "You are a security assistant. Use your tools to help the user.",
    });

    const start = Date.now();
    const result = await singleAgent.invoke({
        messages: [new HumanMessage(question)],
    });

    const messages: BaseMessage[] = result.messages;
    let toolCalls = 0;
    for (const m of messages) if (m._getType() === "tool") toolCalls++;

    const lastAI = messages.filter((m) => m._getType() === "ai").pop();
    const response = lastAI ? String((lastAI as AIMessage).content) : "(no response)";

    console.log(`  ⏱️  Duration: ${Date.now() - start}ms`);
    console.log(`  🔧 Tool calls: ${toolCalls}`);
    console.log(`  📝 Response length: ${response.length} chars`);
    console.log(`  💬 Response preview: ${response.slice(0, 200)}...`);

    return response;
}

// ─── Multi agent ─────────────────────────────────────────────────
async function runMultiAgent(
    question: string,
    threadId: string
): Promise<string> {
    console.log("\n" + "═".repeat(70));
    console.log("  🤖🤖🤖 MULTI-AGENT (supervisor + 3 specialists)");
    console.log("═".repeat(70));
    console.log(`  Question: "${question}"`);
    console.log(`  Thread:   "${threadId}"\n`);

    const compiled = compileGraph();

    const start = Date.now();

    /**
     * ┌───────────────────────────────────────────────────────────┐
     * │  CONCEPT 8: INVOKING WITH thread_id                      │
     * │                                                           │
     * │  configurable.thread_id is the KEY to persistence.       │
     * │                                                           │
     * │  Same thread_id = resumes from last checkpoint            │
     * │  New thread_id  = fresh conversation                      │
     * │                                                           │
     * │  The graph will:                                          │
     * │  1. Load checkpoint for this thread_id (if exists)        │
     * │  2. Append the new HumanMessage                           │
     * │  3. Run through the graph (supervisor → agents → ...)     │
     * │  4. Save new checkpoint after each node                   │
     * │  5. Return final state                                    │
     * │                                                           │
     * └───────────────────────────────────────────────────────────┘
     */
    const result = await compiled.invoke(
        {
            messages: [new HumanMessage(question)],
        },
        {
            configurable: { thread_id: threadId },
            // recursionLimit prevents infinite loops (supervisor ↔ agent ↔ supervisor...)
            recursionLimit: 25,
        }
    );

    const messages: BaseMessage[] = result.messages;
    let toolCalls = 0;
    for (const m of messages) if (m.getType() === "tool") toolCalls++;

    const lastAI = messages.filter((m) => m.getType() === "ai").pop();
    const response = lastAI ? String((lastAI as AIMessage).content) : "(no response)";

    console.log(`\n  ⏱️  Duration: ${Date.now() - start}ms`);
    console.log(`  🔧 Tool calls: ${toolCalls}`);
    console.log(`  🤖 Agents used: ${result.agentsUsed.join(" → ")}`);
    console.log(`  🔍 Findings: ${result.findings.length}`);
    console.log(`  📝 Response length: ${response.length} chars`);
    console.log(`  💬 Response preview: ${response.slice(0, 300)}...`);

    return response;
}

// ═══════════════════════════════════════════════════════════════════════════
//
//  PART 4: DEMO — Run both and compare
//
// ═══════════════════════════════════════════════════════════════════════════

async function demo() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  SINGLE AGENT vs MULTI-AGENT COMPARISON                    ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    seedDemoData();

    const question = "Run a complete security audit of all my infrastructure and give me a prioritized action plan.";

    // ── Run single agent ────────────────────────────────────────────
    try {
        await runSingleAgent(question);
    } catch (e) {
        console.error("  ❌ Single agent failed:", (e as Error).message);
    }

    // ── Run multi-agent ─────────────────────────────────────────────
    try {
        await runMultiAgent(question, "demo-thread-1");
    } catch (e) {
        console.error("  ❌ Multi-agent failed:", (e as Error).message);
    }

    // ═══════════════════════════════════════════════════════════════
    // CONCEPT 9: THREAD CONTINUITY — Follow-up in same thread
    // ═══════════════════════════════════════════════════════════════
    console.log("\n" + "═".repeat(70));
    console.log("  🔄 FOLLOW-UP (same thread — tests memory/checkpointing)");
    console.log("═".repeat(70));

    try {
        // Same thread_id = resumes conversation with full context
        await runMultiAgent(
            "Which of the findings you just reported should I fix first, and how?",
            "demo-thread-1" // ← SAME thread — it remembers the audit results!
        );
    } catch (e) {
        console.error("  ❌ Follow-up failed:", (e as Error).message);
    }

    // ═══════════════════════════════════════════════════════════════
    // CONCEPT 10: NEW THREAD — Isolated conversation
    // ═══════════════════════════════════════════════════════════════
    console.log("\n" + "═".repeat(70));
    console.log("  🆕 NEW THREAD (different thread_id — fresh conversation)");
    console.log("═".repeat(70));

    try {
        // Different thread_id = no memory of previous audit
        await runMultiAgent(
            "Just list my security groups, nothing else.",
            "demo-thread-2" // ← DIFFERENT thread — no memory of previous conversation
        );
    } catch (e) {
        console.error("  ❌ New thread failed:", (e as Error).message);
    }

    console.log("\n" + "═".repeat(70));
    console.log("  ✅ Demo complete!");
    console.log("═".repeat(70));
}

// ─── Run the demo ─────────────────────────────────────────────────
demo().catch((err) => {
    console.error("Demo failed:", err);
    process.exit(1);
});
