/**
 * Conditional edge routers for the Subagents-as-Tools workflow.
 *
 * The router for ToolCallValidatorBefore decides whether to dispatch to
 * HotelFinder or FoodRecommender based on what has already been fetched.
 *
 * Return values must match the keys defined under `conditionalEdges[].route`
 * in configs/subagents_as_tools.yaml.
 */

import type { TripStateType, ConditionalRouter } from '../lib/graphBuilder';

/**
 * Routes from ToolCallValidatorBefore.
 *
 * Logic:
 *  - Hotels not yet fetched → dispatch to HotelFinder
 *  - Food not yet fetched   → dispatch to FoodRecommender
 *  - Fallback               → HotelFinder (re-trigger)
 */
export const ToolCallValidatorBeforeRouter: ConditionalRouter = (
  state: TripStateType,
): string => {
  if (!state.hotels || state.hotels.length === 0) {
    return 'hotelNeeded';
  }
  if (!state.food || state.food.length === 0) {
    return 'foodNeeded';
  }
  return 'hotelNeeded'; // fallback: re-run hotel step
};
