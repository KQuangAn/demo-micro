/**
 * Conditional edge router for the HumanInterruptManager node.
 *
 * Shared across all 4 workflows. Routes to the HumanReviewNode if the manager
 * flagged that human review is required, otherwise routes to END.
 *
 * Return values must match the keys defined under `conditionalEdges[].route`
 * in each workflow's YAML config:
 *
 *   conditionalEdges:
 *     - startNode: HumanInterruptManager
 *       route:
 *         humanReview: HumanReviewNode
 *         done: END
 */

import type { TripStateType, ConditionalRouter } from '../lib/graphBuilder';

/**
 * Routes from HumanInterruptManager.
 *
 * Logic:
 *  - humanReviewRequired is true  → route to HumanReviewNode for human intervention
 *  - humanReviewRequired is false → route to END, workflow complete
 */
export const HumanInterruptManagerRouter: ConditionalRouter = (
  state: TripStateType,
): string => {
  if (state.humanReviewRequired || state.escalatedToHuman) {
    return 'humanReview';
  }
  return 'done';
};
