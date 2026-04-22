/**
 * LangGraph node implementations for the Trip Planning Assistant.
 *
 * Each node matches the LangGraph signature:
 *   (state: TripStateType) => Promise<Partial<TripStateType>>
 *
 * Nodes read from state, compute new values, and return only the fields they update.
 */

import type { TripStateType, NodeImpl } from '../lib/graphBuilder';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── PII helpers ──────────────────────────────────────────────────────────────

const PII_FIELDS = ['ssn', 'passport', 'creditCard', 'password', 'dob'];

function scrubPII(obj: Record<string, any>): Record<string, any> {
  const copy = { ...obj };
  for (const field of PII_FIELDS) {
    if (field in copy) copy[field] = '[REDACTED]';
  }
  return copy;
}

// ─── Confidence scoring helper ────────────────────────────────────────────────

/**
 * Scores how complete and trustworthy the user input is (0.0 – 1.0).
 * Each present, valid field contributes to the score.
 */
function scoreInputConfidence(raw: Record<string, any>): number {
  let score = 0.4; // base – we have at least some input
  if (typeof raw.budget === 'number' && raw.budget > 0)        score += 0.15;
  if (typeof raw.trip_length === 'number' && raw.trip_length > 0) score += 0.15;
  if (Array.isArray(raw.destinations) && raw.destinations.length > 0) score += 0.10;
  if (Array.isArray(raw.interests) && raw.interests.length > 0)      score += 0.10;
  if (typeof raw.budget === 'number' && raw.budget >= 500)           score += 0.10;
  return Math.min(score, 1.0);
}

// ─── Agent nodes ──────────────────────────────────────────────────────────────

export const PIIValidatorBefore: NodeImpl = async (state) => {
  const scrubbed = state.userInput ? scrubPII(state.userInput) : {};
  return { scrubbedInput: scrubbed };
};

/**
 * Parses raw user input into structured preferences and computes a confidence
 * score (0–1) that downstream nodes use to decide whether human review is needed.
 */
export const PreferenceAnalyzer: NodeImpl = async (state) => {
  const raw = state.scrubbedInput && Object.keys(state.scrubbedInput).length
    ? state.scrubbedInput
    : state.userInput ?? {};

  const prefs = {
    budget:               typeof raw.budget === 'number'          ? raw.budget               : 1500,
    trip_length:          typeof raw.trip_length === 'number'     ? raw.trip_length           : 3,
    dietary_restrictions: Array.isArray(raw.dietary_restrictions) ? raw.dietary_restrictions : [],
    interests:            Array.isArray(raw.interests)            ? raw.interests             : ['sightseeing'],
    destinations:         Array.isArray(raw.destinations)         ? raw.destinations          : ['Paris'],
  };

  const confidence = scoreInputConfidence(raw);
  return { prefs, confidence };
};

export const ItineraryPlanner: NodeImpl = async (state) => {
  await sleep(5);
  const prefs        = state.prefs ?? {};
  const tripLength   = (prefs.trip_length as number) ?? 3;
  const interests    = (prefs.interests   as string[]) ?? ['sightseeing'];
  const destinations = (prefs.destinations as string[]) ?? ['Paris'];

  const activityPool: Record<string, string[]> = {
    sightseeing: ['Visit main landmark', 'City walking tour', 'Museum visit'],
    adventure:   ['Hiking trip',         'Kayaking excursion', 'Rock climbing'],
    food:        ['Food market tour',    'Cooking class',      'Restaurant crawl'],
  };

  const days = Array.from({ length: tripLength }, (_, i) => {
    const interest = interests[i % interests.length];
    const pool     = activityPool[interest] ?? activityPool['sightseeing'];
    return { day: i + 1, activities: [pool[i % pool.length]], location: destinations[0] };
  });

  return { itinerary: { days } };
};

export const HotelFinder: NodeImpl = async (state) => {
  const budget     = (state.prefs?.budget as number) ?? 1500;
  const dest       = ((state.prefs?.destinations as string[]) ?? ['Paris'])[0];
  const tripLength = (state.prefs?.trip_length as number) ?? 3;
  const perNight   = Math.floor((budget / tripLength) * 0.4);

  const hotels = [
    { name: 'Grand Hotel',   price: perNight,                     location: dest, rating: 4.5 },
    { name: 'Budget Inn',    price: Math.floor(perNight * 0.5),  location: dest, rating: 3.2 },
    { name: 'Boutique Stay', price: Math.floor(perNight * 0.8),  location: dest, rating: 4.1 },
  ].filter(h => h.price <= budget);

  return { hotels };
};

export const FoodRecommender: NodeImpl = async (state) => {
  const restrictions = (state.prefs?.dietary_restrictions as string[]) ?? [];

  const all = [
    { name: 'Le Petit Bistro', cuisine: 'French',   priceRange: '$$'  },
    { name: 'Sakura Sushi',    cuisine: 'Japanese', priceRange: '$$$' },
    { name: 'Trattoria Roma',  cuisine: 'Italian',  priceRange: '$$'  },
    { name: 'Green Bowl',      cuisine: 'Vegan',    priceRange: '$'   },
    { name: 'Spice Garden',    cuisine: 'Indian',   priceRange: '$$'  },
  ];

  const food = all.filter(opt =>
    !restrictions.some(r => opt.cuisine.toLowerCase().includes(r.toLowerCase()))
  );
  return { food };
};

export const ResultMerger: NodeImpl = async (state) => {
  const finalPlan = {
    itinerary: state.itinerary,
    hotels:    state.hotels,
    food:      state.food,
    prefs:     state.prefs,
  };
  return { finalPlan };
};

/**
 * Subagents-as-tools orchestrator.
 * The Planner invokes ItineraryPlanner, HotelFinder, and FoodRecommender
 * as callable sub-functions (tools), combining their results into a final plan.
 */
export const Planner: NodeImpl = async (state) => {
  const itResult        = await ItineraryPlanner(state);
  const stateAfterIt    = { ...state, ...itResult };
  const hotelResult     = await HotelFinder(stateAfterIt);
  const stateAfterHotel = { ...stateAfterIt, ...hotelResult };
  const foodResult      = await FoodRecommender(stateAfterHotel);

  const finalPlan = {
    itinerary: itResult.itinerary,
    hotels:    hotelResult.hotels,
    food:      foodResult.food,
    prefs:     state.prefs,
  };

  return {
    itinerary: itResult.itinerary,
    hotels:    hotelResult.hotels,
    food:      foodResult.food,
    finalPlan,
    iteration: (state.iteration ?? 0),
  };
};

const MAX_CRITIC_ITERATIONS = 3;

/**
 * Reviews the current plan and decides whether it meets quality criteria.
 *
 * - Collects structured feedback for any missing or thin sections.
 * - Accepts the plan if all criteria pass.
 * - After MAX_CRITIC_ITERATIONS failed attempts, escalates to human review
 *   instead of silently force-accepting.
 */
export const Critic: NodeImpl = async (state) => {
  const feedback: string[] = [];
  if (!state.itinerary?.days?.length)       feedback.push('Itinerary is empty');
  if (!state.hotels?.length)                feedback.push('No hotels found');
  if (!state.food?.length)                  feedback.push('No food options');
  if ((state.food?.length ?? 0) < 2)        feedback.push('Not enough food diversity');

  const iteration      = (state.iteration ?? 0) + 1;
  const planIsComplete = feedback.length === 0;

  if (planIsComplete) {
    return { feedback: [], accepted: true, iteration, escalatedToHuman: false };
  }

  if (iteration >= MAX_CRITIC_ITERATIONS) {
    // Cannot improve further — escalate to human reviewer
    return {
      feedback,
      accepted: false,
      iteration,
      escalatedToHuman: true,
      humanReviewRequired: true,
    };
  }

  return { feedback, accepted: false, iteration, escalatedToHuman: false };
};

// ─── Middleware nodes ─────────────────────────────────────────────────────────

export const PostgresCheckpointer: NodeImpl = async (state) => {
  // Stub: production uses PostgresSaver passed to graph.compile({ checkpointer })
  const checkpoint = {
    timestamp: new Date().toISOString(),
    prefs:     state.prefs,
    finalPlan: state.finalPlan,
  };
  return { checkpoint };
};

export const ToolCallValidatorBefore: NodeImpl = async (state) => {
  if (!state.prefs || Object.keys(state.prefs).length === 0) {
    return { feedback: [...(state.feedback ?? []), 'Prefs missing before tool call'] };
  }
  return {};
};

export const ToolCallValidatorAfter: NodeImpl = async (state) => {
  const issues: string[] = [];
  if (!state.itinerary?.days?.length) issues.push('ItineraryPlanner produced no days');
  if (!state.hotels?.length)          issues.push('HotelFinder produced no hotels');
  if (issues.length > 0) {
    return { feedback: [...(state.feedback ?? []), ...issues] };
  }
  return {};
};

export const ToolRetryManager: NodeImpl = async (state) => {
  if ((state.feedback ?? []).length > 0 && (state.retries ?? 0) < 3) {
    return { retries: (state.retries ?? 0) + 1 };
  }
  return {};
};

export const TodoListManager: NodeImpl = async (state) => {
  const existing = state.todos ?? [];
  const pending: string[] = [];
  if (!state.itinerary?.days?.length) pending.push('Complete itinerary planning');
  if (!state.hotels?.length)          pending.push('Find hotels');
  if (!state.food?.length)            pending.push('Find food options');
  const todos = [...new Set([...existing, ...pending])];
  return { todos };
};

/** Default confidence threshold below which human review is triggered. */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Evaluates whether the current state requires human intervention.
 *
 * Triggers human review if ANY of the following are true:
 *  - confidence score is below threshold (declared via humanReviewThreshold in YAML)
 *  - budget is critically low (< 500)
 *  - unresolved feedback exists from earlier nodes
 *  - Critic has already escalated
 */
export const HumanInterruptManager: NodeImpl = async (state) => {
  const threshold  = DEFAULT_CONFIDENCE_THRESHOLD;
  const confidence = state.confidence ?? 1.0;
  const budget     = (state.prefs?.budget as number) ?? Infinity;

  const needsReview =
    confidence < threshold             ||
    budget < 500                       ||
    (state.feedback ?? []).length > 0  ||
    state.escalatedToHuman === true;

  return { humanReviewRequired: needsReview };
};

/**
 * Human-in-the-loop review node.
 *
 * In production this node would pause the graph (via LangGraph interrupt())
 * and wait for a human to provide feedback before resuming.
 * Here it is stubbed to simulate a human approving the plan with a note.
 */
export const HumanReviewNode: NodeImpl = async (state) => {
  // Stub: simulate human reviewing and approving
  const humanFeedback = state.escalatedToHuman
    ? 'Human reviewer: plan accepted with minor reservations after escalation.'
    : 'Human reviewer: plan looks good, confidence was below threshold.';

  return {
    humanFeedback,
    humanReviewRequired: false,
    escalatedToHuman:    false,
    accepted:            true,
  };
};

// ─── Default export (keyed by node id) ───────────────────────────────────────

const nodeImpls: Record<string, NodeImpl> = {
  PIIValidatorBefore,
  PreferenceAnalyzer,
  ItineraryPlanner,
  HotelFinder,
  FoodRecommender,
  ResultMerger,
  Planner,
  Critic,
  PostgresCheckpointer,
  ToolCallValidatorBefore,
  ToolCallValidatorAfter,
  ToolRetryManager,
  TodoListManager,
  HumanInterruptManager,
  HumanReviewNode,
};

export default nodeImpls;

