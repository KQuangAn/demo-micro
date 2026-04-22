/**
 * Conditional edge routers for the Critic Loop workflow.
 *
 * The router for Critic handles three outcomes:
 *  - Plan needs more work        → loop back to Planner
 *  - Plan accepted               → proceed to PostgresCheckpointer
 *  - Max iterations exceeded     → escalate to HumanReviewNode
 *
 * Return values must match the keys defined under `conditionalEdges[].route`
 * in configs/critic_loop.yaml.
 */

import type { TripStateType, ConditionalRouter } from '../lib/graphBuilder';

/**
 * Routes from Critic.
 *
 * Priority:
 *  1. escalatedToHuman is true → human must intervene
 *  2. accepted is false        → loop back to Planner for revision
 *  3. accepted is true         → proceed to checkpoint
 */
export const CriticRouter: ConditionalRouter = (state: TripStateType): string => {
  if (state.escalatedToHuman) {
    return 'escalated';
  }
  if (!state.accepted) {
    return 'improvementNeeded';
  }
  return 'planAccepted';
};
