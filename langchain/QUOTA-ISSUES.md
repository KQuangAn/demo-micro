# Handling Google Embedding API Quota Issues

## Problem

You're seeing this error:
```
Quota exceeded for metric: generativelanguage.googleapis.com/embed_content_free_tier_requests, limit: 0
```

This means **Google's free tier has 0 requests allowed** for the `embedding-001` model.

## Solutions

### Option 1: Wait for Quota Reset
- Quotas typically reset daily
- Check the retry delay in the error message
- Wait and try again later

### Option 2: Upgrade Google API Plan
- Free tier: 0 embedding requests
- Paid plans: Higher limits
- Check pricing: https://ai.google.dev/pricing
- Monitor usage: https://ai.dev/usage?tab=rate-limit

### Option 3: Use a Different Embedding Provider

#### Switch to OpenAI Embeddings

1. **Install OpenAI package**:
   ```bash
   npm install @langchain/openai
   ```

2. **Update `lib/vector-store.ts`**:
   ```typescript
   import { OpenAIEmbeddings } from "@langchain/openai";
   
   const embeddings = new OpenAIEmbeddings({
     modelName: "text-embedding-3-small", // 1536 dimensions
     openAIApiKey: process.env.OPENAI_API_KEY,
   });
   ```

3. **Update Pinecone index dimension to 1536** (for text-embedding-3-small)

4. **Update `.env`**:
   ```env
   OPENAI_API_KEY=your_openai_key
   ```

#### Switch to Cohere Embeddings

1. **Install Cohere package**:
   ```bash
   npm install @langchain/cohere
   ```

2. **Update code to use Cohere embeddings**

### Option 4: Use Local Embeddings (Advanced)

For development, you could use a local embedding model, but this requires more setup.

## Current Status

- **Model**: `models/embedding-001` (Google)
- **Dimension**: 768
- **Free Tier Limit**: 0 requests
- **Pinecone Index**: Should be dimension 768, metric cosine

## Quick Fix

The fastest solution is to **upgrade your Google API plan** or **switch to OpenAI embeddings** which has a more generous free tier.

