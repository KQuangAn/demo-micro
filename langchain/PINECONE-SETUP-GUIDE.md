# Pinecone Index Setup Guide

## Error: "Integrated inference is not configured for this index"

This error means your Pinecone index doesn't have **integrated embedding** configured with an embedding model.

## Solution 1: Configure Existing Index (Recommended)

If you already have a `rag` index, you can configure it with integrated embedding:

### Step 1: Go to Pinecone Console
1. Visit [https://app.pinecone.io/](https://app.pinecone.io/)
2. Sign in to your account

### Step 2: Configure Index
1. Select your `rag` index
2. Go to **"Configuration"** or **"Settings"** tab
3. Find **"Integrated Inference"** or **"Embedding Model"** section
4. Configure:
   - **Embedding Model**: `llama-text-embed-v2`
   - **Field Map**: 
     - Field name: `chunk_text`
     - Type: `text`
5. **Save** the configuration

### Step 3: Run Seed Script
```bash
npm run seed:pinecone
```

## Solution 2: Create New Index with Integrated Embedding

If you prefer to create a new index:

### Step 1: Go to Pinecone Console
1. Visit [https://app.pinecone.io/](https://app.pinecone.io/)
2. Sign in to your account

### Step 2: Create New Index
1. Click **"Create Index"** button
2. Fill in the details:
   - **Index Name**: `rag`
   - **Embedding Model**: `llama-text-embed-v2`
   - **Metric**: `cosine`
   - **Field Map**: 
     - Field name: `chunk_text`
     - Type: `text`
   - **Pod Type**: Choose based on your needs (free tier available)

### Step 3: Delete Old Index (if exists)
If you have an old `rag` index without integrated embedding:
1. Go to your indexes list
2. Find the `rag` index
3. Click **Delete** (make sure it's the right one!)

### Step 4: Run Seed Script
```bash
npm run seed:pinecone
```

## Solution 2: Use Regular Embeddings (Keep Existing Index)

If you want to keep your existing index without integrated embedding, you'll need to:

1. **Generate embeddings externally** (using Google, OpenAI, etc.)
2. **Upsert vectors directly** instead of text

This requires updating the code to use regular embeddings. See the fallback option below.

## Checking Your Index Configuration

To check if your index has integrated embedding configured:

1. Go to Pinecone Console
2. Select your `rag` index
3. Look for **"Embedding Model"** or **"Integrated Inference"** in the index details
4. If you see `llama-text-embed-v2` (or another model) listed, integrated embedding is configured
5. If not, you need to configure it (see Solution 1 above) or create a new index (see Solution 2)

## Using llama-text-embed-v2

This project is configured to use **`llama-text-embed-v2`** as the embedding model. Make sure your Pinecone index is configured with this model:

- **Model**: `llama-text-embed-v2`
- **Field Map**: `chunk_text` (text type)
- **Text Field**: All records must have a `chunk_text` field containing the text to embed

## Quick Reference

### Index with Integrated Embedding ✅
- Can use `upsertRecords()` with text
- Can use `queryRecords()` with text
- No external embedding API needed
- Simpler code

### Index without Integrated Embedding ❌
- Must generate embeddings externally
- Must use `upsert()` with vectors
- Must use `query()` with vectors
- Requires embedding API (Google, OpenAI, etc.)

## Next Steps

1. **Create new index** with integrated embedding (recommended)
2. **Run seed script** again
3. **Test RAG** in the chat interface

For more details, see: [Pinecone Integrated Inference](https://www.pinecone.io/blog/integrated-inference/)

