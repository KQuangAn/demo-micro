# Using Pinecone Embedding Models

This project now supports using **Pinecone's native embedding models** through their Inference API. This eliminates the need for external embedding services (like Google's API) and can help avoid quota issues.

## Available Models

Pinecone offers several embedding models:

1. **`multilingual-e5-large`** (Default)
   - 1024 dimensions
   - Top-performing multilingual model from Microsoft Research
   - Best for: General-purpose vector search, multilingual applications

2. **`llama-text-embed-v2`**
   - High-performance dense embedding model
   - Optimized for multilingual and cross-lingual text retrieval
   - Supports long documents up to 2048 tokens

3. **`pinecone-sparse-english-v0`**
   - Sparse vector model
   - Designed for keyword-style search
   - Best for: Keyword-based queries

## Setup

### 1. Environment Variables

Add to your `.env` file:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_EMBEDDING_MODEL=multilingual-e5-large  # Optional, defaults to multilingual-e5-large
```

**Note**: You no longer need `GOOGLE_API_KEY` for embeddings when using Pinecone models!

### 2. Pinecone Index Configuration

Make sure your Pinecone index matches the embedding model's dimension:

- **`multilingual-e5-large`**: 1024 dimensions
- **`llama-text-embed-v2`**: Check Pinecone docs for dimension
- **`pinecone-sparse-english-v0`**: Sparse vectors (different structure)

**To check your index dimension:**
```bash
npm run check:pinecone
```

**To recreate index with correct dimension:**
1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Delete existing `rag` index
3. Create new index:
   - Name: `rag`
   - Dimension: `1024` (for multilingual-e5-large)
   - Metric: `cosine`

### 3. Seed the Index

```bash
npm run seed:pinecone
```

## Benefits

✅ **No External API Keys**: Only need Pinecone API key  
✅ **No Quota Limits**: Avoid Google API quota issues  
✅ **Integrated**: Everything in one platform  
✅ **Low Latency**: Direct access to Pinecone's infrastructure  

## Switching Models

To use a different model, update your `.env`:

```env
PINECONE_EMBEDDING_MODEL=llama-text-embed-v2
```

Then recreate your Pinecone index with the correct dimension for that model.

## Troubleshooting

### Error: "Cannot read property 'inference' of undefined"

The Pinecone SDK version might not support the Inference API yet. Check:
- Pinecone SDK version: `@pinecone-database/pinecone@^6.1.3`
- Update to latest version: `npm install @pinecone-database/pinecone@latest`

### Error: "Dimension mismatch"

1. Check your embedding model dimension:
   ```bash
   npm run check:pinecone
   ```
2. Recreate Pinecone index with matching dimension

### Error: "Model not found"

Verify the model name is correct:
- `multilingual-e5-large`
- `llama-text-embed-v2`
- `pinecone-sparse-english-v0`

Check [Pinecone Model Gallery](https://docs.pinecone.io/models/overview) for latest models.

## Fallback to Google Embeddings

If you need to switch back to Google embeddings, update `lib/vector-store.ts`:

```typescript
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "models/gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});
```

## References

- [Pinecone Model Gallery](https://docs.pinecone.io/models/overview)
- [Pinecone Inference API](https://www.pinecone.io/blog/pinecone-inference/)
- [Pinecone Console](https://app.pinecone.io/)

