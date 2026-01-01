# Pinecone Integrated Embedding Setup

This project now uses **Pinecone's integrated embedding feature**, which simplifies the workflow by eliminating the need for external embedding APIs.

## What Changed

✅ **Removed unnecessary files:**
- `lib/pinecone-embeddings.ts` - No longer needed (Pinecone handles embeddings)
- `scripts/check-pinecone-index.ts` - Removed unnecessary script

✅ **Simplified code:**
- `lib/vector-store.ts` - Now uses Pinecone's native query methods
- `scripts/seed-pinecone.ts` - Uses `upsertRecords` with text directly
- `app/api/chat/route.ts` - Updated to use simplified search

## How It Works

Pinecone's integrated embedding automatically converts text to vectors when you:
1. **Upsert**: Use `upsertRecords()` with text fields
2. **Query**: Use `queryRecords()` with text queries

No separate embedding API calls needed!

## Setup

### 1. Configure Pinecone Index with Integrated Embedding

**Option A: Configure Existing Index**
1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Select your `rag` index
3. Go to Configuration/Settings
4. Configure Integrated Inference:
   - **Embedding Model**: `llama-text-embed-v2`
   - **Field Map**: `chunk_text` (text type)

**Option B: Create New Index**
1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Create a new index:
   - **Name**: `rag`
   - **Embedding Model**: `llama-text-embed-v2`
   - **Dimension**: Auto-set by the model
   - **Metric**: `cosine`
   - **Field Map**: Set `chunk_text` as the text field

### 2. Environment Variables

Add to your `.env` file:

```env
PINECONE_API_KEY=your_pinecone_api_key
```

**Note**: You no longer need:
- `GOOGLE_API_KEY` (for embeddings)
- `PINECONE_INDEX_HOST` (optional, SDK resolves automatically)
- `PINECONE_EMBEDDING_MODEL` (set in index configuration)

### 3. Seed the Index

```bash
npm run seed:pinecone
```

This will:
- Read documents from `data/hanoi-weather-forecasts.json`
- Convert them to records with `chunk_text` field
- Upsert them using Pinecone's integrated embedding
- Pinecone automatically generates embeddings

## Code Structure

### Seed Script (`scripts/seed-pinecone.ts`)

```typescript
const records = hanoiWeatherData.map((item, index) => ({
  _id: `hanoi-weather-${index + 1}`,
  chunk_text: `${item.title}\n\n${item.content}`, // Text field for embedding
  date: item.date,
  location: item.location,
  // ... other metadata
}));

await index.upsertRecords("__default__", batch);
```

### Vector Store (`lib/vector-store.ts`)

```typescript
// Search using text directly
const results = await index.queryRecords({
  namespace: "__default__",
  topK: 3,
  query: {
    chunk_text: queryText, // Pinecone embeds this automatically
  },
  includeMetadata: true,
});
```

## Benefits

✅ **Simpler**: No external embedding API needed  
✅ **Faster**: Direct integration with Pinecone  
✅ **Cost-effective**: No separate embedding API costs  
✅ **Reliable**: No quota limits from external APIs  

## Reference

- [Pinecone Upsert Guide](https://docs.pinecone.io/guides/index-data/upsert-data)
- [Pinecone Integrated Inference](https://www.pinecone.io/blog/integrated-inference/)

