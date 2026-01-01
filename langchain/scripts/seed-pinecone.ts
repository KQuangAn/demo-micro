#!/usr/bin/env node

/**
 * Seed script to populate Pinecone index with documents using integrated embedding
 * Usage: npm run seed:pinecone
 * 
 * This script uses Pinecone's upsertRecords API with text fields.
 * The index must be configured with integrated embedding enabled.
 * Pinecone automatically converts text to vectors - no embedding model specification needed.
 * 
 * Reference: https://docs.pinecone.io/guides/index-data/upsert-data
 */

import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
import hanoiWeatherData from "../data/hanoi-weather-forecasts.json";

// Load environment variables from .env
const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  config({ path: envPath });
  console.log("📝 Loaded environment from .env");
} else {
  console.log("⚠️  No .env file found");
}

const PINECONE_INDEX_NAME = "rag";
const PINECONE_NAMESPACE = "__default__"; // Use default namespace
// Field name for text - must match your index's field_map configuration
// Common values: "text" or "chunk_text"
const TEXT_FIELD = process.env.PINECONE_TEXT_FIELD || "text";

async function seedPinecone() {
  console.log("🌱 Starting Pinecone seed process...\n");
  console.log("📖 Using Pinecone's upsertRecords with text fields\n");

  // Validate environment variables
  if (!process.env.PINECONE_API_KEY) {
    console.error("❌ PINECONE_API_KEY is not set in environment variables");
    console.error("\n💡 Please create a .env file in the langchain directory with:");
    console.error("   PINECONE_API_KEY=your_pinecone_api_key_here");
    console.error(`\n📁 Expected location: ${envPath}`);
    console.error("\n🔗 Get your API key from:");
    console.error("   - Pinecone: https://app.pinecone.io/\n");
    throw new Error("PINECONE_API_KEY is required");
  }

  // PINECONE_INDEX_HOST is optional - only needed if index name doesn't work
  // The SDK can usually find the index by name automatically

  console.log("✅ Environment variables validated");

  // Initialize Pinecone client
  console.log("🔌 Connecting to Pinecone...");
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  // Get the index and namespace
  // If you need to specify a host, use: pinecone.index(PINECONE_INDEX_NAME, "INDEX_HOST")
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const namespace = index.namespace(PINECONE_NAMESPACE);
  
  console.log(`📇 Using index: ${PINECONE_INDEX_NAME}`);
  console.log(`📦 Namespace: ${PINECONE_NAMESPACE}`);
  console.log(`📝 Text field: ${TEXT_FIELD} (must match index field_map)`);

  // Check if index exists and has data
  try {
    const indexStats = await index.describeIndexStats();
    const existingVectors = indexStats.totalRecordCount || 0;
    
    if (existingVectors > 0) {
      console.log(`⚠️  Index already contains ${existingVectors} vectors`);
      console.log("💡 To re-seed, delete the index first or use a different index name");
      return;
    }
  } catch (error) {
    console.log("ℹ️  Index is empty or doesn't exist, proceeding to seed...");
    if (error instanceof Error) {
      console.log(`   (${error.message})`);
    }
  }

  // Prepare records for upsert
  // chunk_text fields are automatically converted to dense vectors by Pinecone
  // Other fields are stored as metadata
  console.log("📄 Preparing records...");
  const records = hanoiWeatherData.map((item, index) => {
    const record: Record<string, string> = {
      _id: `hanoi-weather-${index + 1}`,
      [TEXT_FIELD]: `${item.title}\n\n${item.content}`, // Converted to vectors automatically
      location: item.location,
      period: item.period,
      title: item.title,
    };
    // Only add date if it exists (metadata can't have null values)
    if (item.date) {
      record.date = item.date;
    }
    return record;
  });

  console.log(`📚 Prepared ${records.length} records for indexing`);

  // Upsert records in batches
  // For text with integrated embedding, max batch size is 96 records
  console.log("🚀 Upserting records to Pinecone index...");
  console.log("⏳ This may take a few moments...");

  try {
    const batchSize = 96; // Max batch size for text with integrated embedding
    const totalBatches = Math.ceil(records.length / batchSize);
    
    console.log(`   Processing ${records.length} records in batches of ${batchSize}...`);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

      try {
        // Upsert records - chunk_text is automatically converted to vectors
        // No embedding model specification needed - index configuration handles it
        await namespace.upsertRecords(batch);
        
        console.log(`   ✅ Batch ${batchNum} completed`);
        
        // Small delay between batches to avoid rate limits
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorString = JSON.stringify(error);
        
        console.error(`\n❌ Error processing batch ${batchNum}:`, errorMessage);
        
        if (errorString.includes("Integrated inference is not configured") || 
            errorMessage.includes("Integrated inference is not configured")) {
          console.error("\n❌ Your Pinecone index doesn't have integrated embedding configured!");
          console.error("\n💡 Solution: Configure your index with an embedding model:");
          console.error("   1. Go to https://app.pinecone.io/");
          console.error("   2. Select your 'rag' index");
          console.error("   3. Go to 'Configuration' or 'Settings'");
          console.error("   4. Configure Integrated Inference:");
          console.error("      - Embedding Model: llama-text-embed-v2");
          console.error("      - Field Map: chunk_text (text type)");
          console.error("   5. Save the configuration");
          console.error("\n   OR create a NEW index with integrated embedding:");
          console.error("   1. Click 'Create Index'");
          console.error("   2. Name: 'rag'");
          console.error("   3. Embedding Model: llama-text-embed-v2");
          console.error("   4. Field Map: chunk_text (text type)");
          console.error("   5. Delete the old 'rag' index if it exists");
          console.error("\n📖 See PINECONE-SETUP-GUIDE.md for detailed instructions");
        } else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
          console.error("💡 Rate limit exceeded. Please wait and retry later");
        } else if (errorMessage.includes("field_mapping") || errorMessage.includes("Missing field_mapping field") || errorMessage.includes("field_map")) {
          console.error("\n❌ Field mapping mismatch!");
          console.error(`   Your index expects a field named 'text' but we're using '${TEXT_FIELD}'`);
          console.error("\n💡 Solutions:");
          console.error("   1. Update your index field_map to use 'chunk_text':");
          console.error("      - Go to Pinecone Console > Your index > Configuration");
          console.error("      - Update field_map to use 'chunk_text' instead of 'text'");
          console.error("   2. Or set environment variable to match your index:");
          console.error(`      PINECONE_TEXT_FIELD=text`);
          console.error("      (Add this to your .env file)");
        }
        throw error;
      }
    }

    console.log("✅ Successfully seeded Pinecone index!");
    console.log(`📊 Indexed ${records.length} records`);
    console.log("🎉 Seed process completed!");
  } catch (error) {
    console.error("❌ Error seeding Pinecone:", error);
    throw error;
  }
}

// Run the seed function
seedPinecone()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed failed:", error);
    process.exit(1);
  });
