import path from 'path';
import { MemorySaver } from '@langchain/langgraph';
import { loadGraphConfig, buildLangGraph } from '../lib/graphBuilder';
import nodeImpls, {
  PIIValidatorBefore,
  PreferenceAnalyzer,
  ItineraryPlanner,
  HotelFinder,
  FoodRecommender,
  ResultMerger,
  Planner,
  Critic,
  PostgresCheckpointer,
  ToolRetryManager,
  TodoListManager,
  HumanInterruptManager,
  HumanReviewNode,
} from '../nodes/impls';
import { conditionalRouters } from '../edges/routers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cfgPath = (name: string) => path.resolve(__dirname, '../configs', name);

const sampleInput = {
  budget: 1500,
  trip_length: 3,
  dietary_restrictions: ['pork'],
  interests: ['sightseeing', 'food'],
  destinations: ['Paris'],
};

const makeState = (overrides: Record<string, any> = {}) => ({
  userInput: sampleInput,
  prefs: {},
  itinerary: {},
  hotels: [],
  food: [],
  finalPlan: {},
  feedback: [],
  accepted: false,
  iteration: 0,
  checkpoint: {},
  todos: [],
  retries: 0,
  humanReviewRequired: false,
  scrubbedInput: {},
  confidence: 1.0,
  escalatedToHuman: false,
  humanFeedback: '',
  ...overrides,
});

// ─── loadGraphConfig ──────────────────────────────────────────────────────────

describe('loadGraphConfig', () => {
  const configs = ['sequential.yaml', 'parallel.yaml', 'subagents_as_tools.yaml', 'critic_loop.yaml'];

  configs.forEach(cfg => {
    it(`loads ${cfg}`, () => {
      const result = loadGraphConfig(cfgPath(cfg));
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it(`all nodes in ${cfg} have id and type`, () => {
      const result = loadGraphConfig(cfgPath(cfg));
      for (const node of result.nodes) {
        expect(typeof node.id).toBe('string');
        expect(typeof node.type).toBe('string');
      }
    });
  });
});

// ─── buildLangGraph (compiled StateGraph) ─────────────────────────────────────

describe('buildLangGraph – graph structure', () => {
  it('sequential: compiles without error', () => {
    const cfg = loadGraphConfig(cfgPath('sequential.yaml'));
    expect(() => buildLangGraph(cfg, nodeImpls, conditionalRouters, new MemorySaver())).not.toThrow();
  });

  it('parallel: compiles without error', () => {
    const cfg = loadGraphConfig(cfgPath('parallel.yaml'));
    expect(() => buildLangGraph(cfg, nodeImpls, conditionalRouters, new MemorySaver())).not.toThrow();
  });

  it('subagents_as_tools: compiles with conditional routers', () => {
    const cfg = loadGraphConfig(cfgPath('subagents_as_tools.yaml'));
    expect(() => buildLangGraph(cfg, nodeImpls, conditionalRouters, new MemorySaver())).not.toThrow();
  });

  it('critic_loop: compiles with conditional routers', () => {
    const cfg = loadGraphConfig(cfgPath('critic_loop.yaml'));
    expect(() => buildLangGraph(cfg, nodeImpls, conditionalRouters, new MemorySaver())).not.toThrow();
  });

  it('throws if a node has no implementation', () => {
    const cfg = loadGraphConfig(cfgPath('sequential.yaml'));
    expect(() => buildLangGraph(cfg, {}, conditionalRouters, new MemorySaver())).toThrow(/No implementation found/);
  });
});

// ─── Node unit tests ──────────────────────────────────────────────────────────

describe('PIIValidatorBefore', () => {
  it('redacts ssn', async () => {
    const state = makeState({ userInput: { name: 'Alice', ssn: '123-45-6789' } });
    const r = await PIIValidatorBefore(state as any);
    expect(r.scrubbedInput!['ssn']).toBe('[REDACTED]');
    expect(r.scrubbedInput!['name']).toBe('Alice');
  });

  it('handles empty userInput gracefully', async () => {
    const r = await PIIValidatorBefore(makeState({ userInput: {} }) as any);
    expect(r.scrubbedInput).toEqual({});
  });
});

describe('PreferenceAnalyzer', () => {
  it('parses preferences correctly', async () => {
    const state = makeState({ scrubbedInput: sampleInput });
    const r = await PreferenceAnalyzer(state as any);
    expect(r.prefs!['budget']).toBe(1500);
    expect(r.prefs!['trip_length']).toBe(3);
    expect(r.prefs!['dietary_restrictions']).toContain('pork');
    expect(r.prefs!['interests']).toContain('sightseeing');
  });

  it('uses defaults for missing fields', async () => {
    const r = await PreferenceAnalyzer(makeState({ scrubbedInput: {}, userInput: {} }) as any);
    expect(r.prefs!['budget']).toBe(1500);
    expect(r.prefs!['destinations']).toEqual(['Paris']);
  });

  it('returns high confidence for complete input', async () => {
    const state = makeState({ scrubbedInput: sampleInput });
    const r = await PreferenceAnalyzer(state as any);
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('returns low confidence for empty input', async () => {
    const r = await PreferenceAnalyzer(makeState({ scrubbedInput: {}, userInput: {} }) as any);
    expect(r.confidence).toBeLessThan(0.7);
  });
});

describe('ItineraryPlanner', () => {
  it('creates the correct number of days', async () => {
    const state = makeState({ prefs: { ...sampleInput } });
    const r = await ItineraryPlanner(state as any);
    expect(r.itinerary!['days'].length).toBe(3);
  });

  it('each day has activities and location', async () => {
    const state = makeState({ prefs: { ...sampleInput, trip_length: 2, destinations: ['Tokyo'] } });
    const r = await ItineraryPlanner(state as any);
    for (const day of r.itinerary!['days']) {
      expect(day.activities.length).toBeGreaterThan(0);
      expect(day.location).toBe('Tokyo');
    }
  });
});

describe('HotelFinder', () => {
  it('all hotels are within budget', async () => {
    const state = makeState({ prefs: { budget: 900, trip_length: 3, destinations: ['Rome'] } });
    const r = await HotelFinder(state as any);
    for (const h of r.hotels!) {
      expect(h.price).toBeLessThanOrEqual(900);
    }
  });

  it('each hotel has required fields', async () => {
    const state = makeState({ prefs: { budget: 2000, trip_length: 3, destinations: ['Tokyo'] } });
    const r = await HotelFinder(state as any);
    for (const h of r.hotels!) {
      expect(typeof h.name).toBe('string');
      expect(typeof h.price).toBe('number');
      expect(typeof h.rating).toBe('number');
    }
  });
});

describe('FoodRecommender', () => {
  it('returns food options', async () => {
    const state = makeState({ prefs: { dietary_restrictions: [] } });
    const r = await FoodRecommender(state as any);
    expect(r.food!.length).toBeGreaterThan(0);
  });

  it('filters out dietary restrictions', async () => {
    const state = makeState({ prefs: { dietary_restrictions: ['Japanese'] } });
    const r = await FoodRecommender(state as any);
    const hasJapanese = r.food!.some((f: any) => f.cuisine === 'Japanese');
    expect(hasJapanese).toBe(false);
  });

  it('returns at least 3 cuisines with no restrictions', async () => {
    const state = makeState({ prefs: { dietary_restrictions: [] } });
    const r = await FoodRecommender(state as any);
    const cuisines = new Set(r.food!.map((f: any) => f.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(3);
  });
});

describe('ResultMerger', () => {
  it('merges itinerary, hotels, food into finalPlan', async () => {
    const state = makeState({
      itinerary: { days: [{ day: 1, activities: ['walk'], location: 'Paris' }] },
      hotels: [{ name: 'H', price: 100, location: 'Paris', rating: 4 }],
      food: [{ name: 'C', cuisine: 'French', priceRange: '$' }],
      prefs: sampleInput,
    });
    const r = await ResultMerger(state as any);
    expect(r.finalPlan!['itinerary']).toBeDefined();
    expect(r.finalPlan!['hotels'].length).toBe(1);
    expect(r.finalPlan!['food'].length).toBe(1);
  });
});

describe('Planner', () => {
  it('orchestrates all sub-steps', async () => {
    const state = makeState({ prefs: { ...sampleInput } });
    const r = await Planner(state as any);
    expect(r.itinerary!['days'].length).toBe(3);
    expect(r.hotels!.length).toBeGreaterThan(0);
    expect(r.food!.length).toBeGreaterThan(0);
    expect(r.finalPlan).toBeDefined();
  });
});

describe('Critic', () => {
  it('accepts a complete plan', async () => {
    const state = makeState({
      itinerary: { days: [{ day: 1, activities: ['walk'], location: 'Paris' }] },
      hotels: [{ name: 'H', price: 100, location: 'Paris', rating: 4 }],
      food: [{ name: 'X', cuisine: 'French', priceRange: '$' }, { name: 'Y', cuisine: 'Italian', priceRange: '$$' }],
      iteration: 0,
    });
    const r = await Critic(state as any);
    expect(r.accepted).toBe(true);
    expect(r.feedback!.length).toBe(0);
    expect(r.escalatedToHuman).toBe(false);
  });

  it('rejects empty plan with feedback', async () => {
    const r = await Critic(makeState({ iteration: 0 }) as any);
    expect(r.accepted).toBe(false);
    expect(r.feedback!.length).toBeGreaterThan(0);
  });

  it('escalates to human after MAX_ITERATIONS instead of force-accepting', async () => {
    const r = await Critic(makeState({ iteration: 3 }) as any);
    expect(r.accepted).toBe(false);
    expect(r.escalatedToHuman).toBe(true);
    expect(r.humanReviewRequired).toBe(true);
  });
});

describe('PostgresCheckpointer', () => {
  it('creates checkpoint with timestamp', async () => {
    const state = makeState({ prefs: sampleInput, finalPlan: { done: true } });
    const r = await PostgresCheckpointer(state as any);
    expect(typeof r.checkpoint!['timestamp']).toBe('string');
    expect(r.checkpoint!['prefs']).toBeDefined();
  });
});

describe('ToolRetryManager', () => {
  it('increments retries when feedback exists', async () => {
    const state = makeState({ feedback: ['some issue'], retries: 0 });
    const r = await ToolRetryManager(state as any);
    expect(r.retries).toBe(1);
  });

  it('does not retry after 3 attempts', async () => {
    const state = makeState({ feedback: ['issue'], retries: 3 });
    const r = await ToolRetryManager(state as any);
    expect(r.retries).toBeUndefined();
  });
});

describe('TodoListManager', () => {
  it('adds todos for missing steps', async () => {
    const r = await TodoListManager(makeState() as any);
    expect(r.todos!).toContain('Find hotels');
    expect(r.todos!).toContain('Find food options');
  });

  it('does not duplicate todos', async () => {
    const state = makeState({ todos: ['Find hotels'] });
    const r = await TodoListManager(state as any);
    const count = r.todos!.filter(t => t === 'Find hotels').length;
    expect(count).toBe(1);
  });
});

describe('HumanInterruptManager', () => {
  it('flags review for low budget', async () => {
    const state = makeState({ prefs: { budget: 200 }, confidence: 0.9 });
    const r = await HumanInterruptManager(state as any);
    expect(r.humanReviewRequired).toBe(true);
  });

  it('flags review when confidence is below threshold', async () => {
    const state = makeState({ prefs: { budget: 2000 }, confidence: 0.5, feedback: [] });
    const r = await HumanInterruptManager(state as any);
    expect(r.humanReviewRequired).toBe(true);
  });

  it('flags review when critic escalated', async () => {
    const state = makeState({ prefs: { budget: 2000 }, confidence: 0.9, escalatedToHuman: true });
    const r = await HumanInterruptManager(state as any);
    expect(r.humanReviewRequired).toBe(true);
  });

  it('no review for adequate budget, high confidence, no feedback', async () => {
    const state = makeState({ prefs: { budget: 2000 }, confidence: 0.9, feedback: [] });
    const r = await HumanInterruptManager(state as any);
    expect(r.humanReviewRequired).toBe(false);
  });
});

describe('HumanReviewNode', () => {
  it('clears humanReviewRequired and escalatedToHuman', async () => {
    const state = makeState({ humanReviewRequired: true, escalatedToHuman: true });
    const r = await HumanReviewNode(state as any);
    expect(r.humanReviewRequired).toBe(false);
    expect(r.escalatedToHuman).toBe(false);
  });

  it('sets accepted to true after review', async () => {
    const r = await HumanReviewNode(makeState() as any);
    expect(r.accepted).toBe(true);
  });

  it('returns a humanFeedback message', async () => {
    const r = await HumanReviewNode(makeState() as any);
    expect(typeof r.humanFeedback).toBe('string');
    expect(r.humanFeedback!.length).toBeGreaterThan(0);
  });

  it('returns escalation-specific feedback when escalatedToHuman is true', async () => {
    const state = makeState({ escalatedToHuman: true });
    const r = await HumanReviewNode(state as any);
    expect(r.humanFeedback).toContain('escalation');
  });
});

// ─── Integration: real compiled LangGraph invocations ────────────────────────

async function runWorkflow(cfgFile: string) {
  const cfg = loadGraphConfig(cfgPath(cfgFile));
  const checkpointer = new MemorySaver();
  const graph = buildLangGraph(cfg, nodeImpls, conditionalRouters, checkpointer);
  const threadId = `test-${cfgFile}-${Date.now()}`;
  return graph.invoke(
    { userInput: sampleInput },
    { configurable: { thread_id: threadId } },
  );
}

describe('Integration: sequential workflow', () => {
  it('produces itinerary, hotels, food, and checkpoint', async () => {
    const result = await runWorkflow('sequential.yaml');
    expect(result.itinerary?.days?.length).toBe(3);
    expect(result.hotels?.length).toBeGreaterThan(0);
    expect(result.food?.length).toBeGreaterThan(0);
    expect(result.checkpoint?.timestamp).toBeDefined();
  }, 10000);
});

describe('Integration: parallel workflow', () => {
  it('merges results into finalPlan', async () => {
    const result = await runWorkflow('parallel.yaml');
    expect(result.finalPlan?.itinerary).toBeDefined();
    expect(result.finalPlan?.hotels?.length).toBeGreaterThan(0);
    expect(result.finalPlan?.food?.length).toBeGreaterThan(0);
  }, 10000);
});

describe('Integration: subagents_as_tools workflow', () => {
  it('planner produces a complete final plan', async () => {
    const result = await runWorkflow('subagents_as_tools.yaml');
    expect(result.finalPlan?.itinerary).toBeDefined();
    expect(result.hotels?.length).toBeGreaterThan(0);
  }, 10000);
});

describe('Integration: critic_loop workflow', () => {
  it('critic runs and either accepts or escalates to human', async () => {
    const result = await runWorkflow('critic_loop.yaml');
    expect(result.iteration).toBeGreaterThan(0);
    // Either the plan was accepted cleanly, or it was escalated and human reviewed it
    const resolved = result.accepted === true || result.humanFeedback?.length > 0;
    expect(resolved).toBe(true);
  }, 10000);
});
