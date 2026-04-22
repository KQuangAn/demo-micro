/**
 * CLI runner — builds and executes a real LangGraph StateGraph from a YAML config.
 *
 * Usage: ts-node src/run.ts [sequential|parallel|subagents_as_tools|critic_loop]
 *
 * For Postgres checkpointing in production:
 *   import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
 *   import pg from 'pg';
 *   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
 *   const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
 *   await checkpointer.setup();
 *   const graph = buildLangGraph(cfg, nodeImpls, conditionalRouters, checkpointer);
 */

import path from 'path';
import { MemorySaver } from '@langchain/langgraph';
import { loadGraphConfig, buildLangGraph } from '../lib/graphBuilder';
import nodeImpls from '../nodes/impls';
import { conditionalRouters } from '../edges/routers';

const workflow = process.argv[2] ?? 'sequential';
const cfgPath = path.resolve(__dirname, '../configs', `${workflow}.yaml`);

const sampleInput = {
  budget: 1500,
  trip_length: 3,
  dietary_restrictions: ['pork'],
  interests: ['sightseeing', 'food'],
  destinations: ['Paris'],
};

async function main() {
  console.log(`\n▶  Running workflow: ${workflow}\n`);

  const cfg = loadGraphConfig(cfgPath);
  console.log(`   Nodes: ${cfg.nodes.map(n => n.id).join(', ')}`);
  console.log(`   Edges: ${cfg.edges.length} total\n`);

  // MemorySaver for local dev — swap for PostgresSaver in production
  const checkpointer = new MemorySaver();

  const graph = buildLangGraph(cfg, nodeImpls, conditionalRouters, checkpointer);

  // thread_id scopes the checkpoint so different runs don't collide
  const config = { configurable: { thread_id: `trip-${workflow}-${Date.now()}` } };

  const result = await graph.invoke(
    { userInput: sampleInput },
    config,
  );

  console.log('\n✅  Final state snapshot:');
  console.log('   Prefs       :', result.prefs);
  console.log('   Itinerary   :', JSON.stringify(result.itinerary, null, 2));
  console.log('   Hotels      :', result.hotels);
  console.log('   Food        :', result.food?.map((f: any) => `${f.name} (${f.cuisine})`));
  console.log('   Accepted    :', result.accepted);
  console.log('   Feedback    :', result.feedback);
  console.log('   Checkpoint  :', result.checkpoint?.timestamp ?? '(none)');
  console.log('   Human review:', result.humanReviewRequired);
  console.log('   Todos       :', result.todos);
}

main().catch(err => { console.error(err); process.exit(1); });
