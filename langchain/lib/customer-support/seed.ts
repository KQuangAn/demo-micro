/**
 * ══════════════════════════════════════════════════════════════════
 *  Customer Support — Seed Pinecone
 * ══════════════════════════════════════════════════════════════════
 *
 *  Seeds the knowledge base articles into a dedicated Pinecone
 *  namespace so they don't collide with the weather data.
 *
 *  Run:  pnpm seed:support
 *
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";
import { knowledgeBase } from "./data";

const INDEX_NAME = "rag";
const NAMESPACE = "customer-support";
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

async function seed() {
  console.log("🌱 Seeding customer-support knowledge base into Pinecone...\n");

  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(INDEX_NAME);
  const namespace = index.namespace(NAMESPACE);

  // Check existing data
  try {
    const stats = await index.describeIndexStats();
    const nsStats = stats.namespaces?.[NAMESPACE];
    if (nsStats && nsStats.recordCount && nsStats.recordCount > 0) {
      console.log(`⚠️  Namespace "${NAMESPACE}" already has ${nsStats.recordCount} records.`);
      console.log("   Delete the namespace first to re-seed, or skip.\n");

      const arg = process.argv[2];
      if (arg !== "--force") {
        console.log('   Pass --force to re-seed anyway.\n');
        return;
      }
      console.log("   --force flag detected, deleting existing records...");
      await namespace.deleteAll();
      console.log("   ✅ Deleted existing records.\n");
    }
  } catch {
    // namespace doesn't exist yet — fine
  }

  // Build records
  const records = knowledgeBase.map((article) => ({
    _id: article.id,
    [TEXT_FIELD]: `${article.title}\n\n${article.content}`,
    title: article.title,
    category: article.category,
    tags: article.tags.join(", "),
  }));

  console.log(`📄 Upserting ${records.length} articles...`);

  // Batch upsert (max 96 for integrated embedding)
  const batchSize = 96;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await namespace.upsertRecords(batch);
    console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
  }

  // Wait a moment for indexing
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`\n✅ Done! ${records.length} articles in namespace "${NAMESPACE}"`);
  console.log("   You can now run: pnpm support\n");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
