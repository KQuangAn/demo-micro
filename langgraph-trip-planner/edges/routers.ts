/**
 * Central registry of all conditional edge routers.
 *
 * Each workflow that declares a `conditionalEdges` block in its YAML config
 * must have a corresponding router exported here, keyed by the `startNode` id.
 *
 * Routers live in per-workflow files under edges/:
 *   edges/subagents_as_tools.ts  →  ToolCallValidatorBeforeRouter
 *   edges/critic_loop.ts         →  CriticRouter
 *   edges/human_interrupt.ts     →  HumanInterruptManagerRouter  (shared, all workflows)
 */

import type { ConditionalRouter } from '../lib/graphBuilder';

export { ToolCallValidatorBeforeRouter } from './subagents_as_tools';
export { CriticRouter } from './critic_loop';
export { HumanInterruptManagerRouter } from './human_interrupt';

import { ToolCallValidatorBeforeRouter } from './subagents_as_tools';
import { CriticRouter } from './critic_loop';
import { HumanInterruptManagerRouter } from './human_interrupt';

/**
 * Map of startNode id → router function.
 * Passed to buildLangGraph(); keys must match the `startNode` fields
 * in each YAML `conditionalEdges` block.
 */
export const conditionalRouters: Record<string, ConditionalRouter> = {
  ToolCallValidatorBefore: ToolCallValidatorBeforeRouter,
  Critic:                  CriticRouter,
  HumanInterruptManager:   HumanInterruptManagerRouter,
};
