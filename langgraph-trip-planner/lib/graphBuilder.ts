import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';

// ─── YAML types ──────────────────────────────────────────────────────────────

export type NodeConfig = {
  id: string;
  type: 'AgentNode' | 'MiddlewareNode';
  prompt?: string;
  /** Confidence score below which this node routes to human review (0–1). */
  humanReviewThreshold?: number;
};

/** Fixed edge: [source, target] */
export type EdgeConfigRaw = [string, string];

/**
 * A single entry in the `conditionalEdges` YAML block.
 *
 * Example YAML:
 *   conditionalEdges:
 *     - startNode: Critic
 *       route:
 *         if improvement needed: Planner
 *         if plan accepted: PostgresCheckpointer
 */
export type ConditionalEdgeConfig = {
  /** Source node id */
  startNode: string;
  /**
   * Map of router-return-value → target node id.
   * Use the string "END" to route to the LangGraph END sentinel.
   */
  route: Record<string, string>;
};

export type GraphConfig = {
  description?: string;
  nodes: NodeConfig[];
  /** Fixed (unconditional) edges only */
  edges: EdgeConfigRaw[];
  /** Conditional edges, each with their own router + route map */
  conditionalEdges?: ConditionalEdgeConfig[];
};

// ─── Shared LangGraph state annotation ───────────────────────────────────────

export const TripState = Annotation.Root({
  /** Raw user input */
  userInput: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /** Parsed user preferences */
  prefs: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /** Built itinerary */
  itinerary: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /** Hotel options */
  hotels: Annotation<any[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Food options */
  food: Annotation<any[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Merged final plan */
  finalPlan: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /** Critic feedback strings */
  feedback: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Whether critic accepted the plan */
  accepted: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  /** Critic loop iteration counter */
  iteration: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  /** Postgres checkpoint snapshot */
  checkpoint: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /** Todo list for pending steps */
  todos: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  /** Retry count for tool calls */
  retries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  /** Whether human review is required */
  humanReviewRequired: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  /** PII-scrubbed user input */
  scrubbedInput: Annotation<Record<string, any>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
  /**
   * Confidence score (0–1) for the current plan.
   * Computed by PreferenceAnalyzer based on input completeness.
   * Used by HumanInterruptManager to decide whether to escalate.
   */
  confidence: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 1.0,
  }),
  /**
   * Set to true by Critic when the plan cannot be improved after MAX_ITERATIONS
   * and needs human review rather than silent acceptance.
   */
  escalatedToHuman: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  /** Free-text feedback injected by the human reviewer (stubbed). */
  humanFeedback: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type TripStateType = typeof TripState.State;

// ─── Node implementation type ─────────────────────────────────────────────────

export type NodeImpl = (state: TripStateType) => Promise<Partial<TripStateType>>;

// ─── YAML loader ─────────────────────────────────────────────────────────────

export function loadGraphConfig(yamlPath: string): GraphConfig {
  const file = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(file) as any;
  parsed.edges = parsed.edges ?? [];
  parsed.conditionalEdges = parsed.conditionalEdges ?? [];
  return parsed as GraphConfig;
}

// ─── Conditional edge router type ────────────────────────────────────────────

export type ConditionalRouter = (state: TripStateType) => string;

/**
 * Builds a real LangGraph StateGraph from a YAML config + node implementations.
 *
 * @param graphConfig   Parsed YAML config (nodes + edges)
 * @param nodeImpls     Map of node id → LangGraph node function (state) => Partial<state>
 * @param conditionalRouters  Map of source node id → routing function for conditional edges
 * @param checkpointer  Optional LangGraph checkpointer (e.g. MemorySaver or PostgresSaver)
 */
export function buildLangGraph(
  graphConfig: GraphConfig,
  nodeImpls: Record<string, NodeImpl>,
  conditionalRouters: Record<string, ConditionalRouter> = {},
  checkpointer?: any,
) {
  const graph = new StateGraph(TripState);

  // ── Add nodes ──────────────────────────────────────────────────────────────
  for (const nodeCfg of graphConfig.nodes) {
    const impl = nodeImpls[nodeCfg.id];
    if (!impl) {
      throw new Error(
        `No implementation found for node "${nodeCfg.id}". ` +
        `Make sure it is exported from nodes/impls.ts.`
      );
    }
    graph.addNode(nodeCfg.id, impl);
  }

  // ── Fixed edges ────────────────────────────────────────────────────────────
  for (const [source, target] of graphConfig.edges) {
    const src = source === 'START' ? START : source;
    const tgt = target === 'END' ? END : target;
    graph.addEdge(src as any, tgt as any);
  }

  // ── Conditional edges ──────────────────────────────────────────────────────
  for (const condEdge of graphConfig.conditionalEdges ?? []) {
    const { startNode, route } = condEdge;
    const router = conditionalRouters[startNode];
    if (!router) {
      throw new Error(
        `Conditional edges from "${startNode}" require a router in conditionalRouters. ` +
        `Add an entry for "${startNode}" in edges/routers.ts.`
      );
    }
    // Build LangGraph pathMap: routerReturnValue → nodeId (or END sentinel)
    const pathMap: Record<string, any> = {};
    for (const [routerKey, targetNode] of Object.entries(route)) {
      pathMap[routerKey] = targetNode === 'END' ? END : targetNode;
    }
    graph.addConditionalEdges(startNode as any, router as any, pathMap);
  }

  // ── Compile ────────────────────────────────────────────────────────────────
  return graph.compile({ checkpointer });
}

