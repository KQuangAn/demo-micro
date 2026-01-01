# Pinecone Setup Guide

## Dimension Mismatch Issue

If you see the error:
```
Vector dimension 0 does not match the dimension of the index 1024
```

This means your Pinecone index was created with dimension **1024**, but Google's `embedding-001` model produces **768-dimensional** vectors.

## Solutions

### Option 1: Recreate Pinecone Index with Correct Dimension (Recommended)

1. **Delete the existing index** in Pinecone Console:
   - Go to [Pinecone Console](https://app.pinecone.io/)
   - Navigate to your index `rag`
   - Delete it

2. **Create a new index** with dimension **768**:
   - Name: `rag`
   - Dimension: `768`
   - Metric: `cosine` (recommended for embeddings)
   - Pod type: Choose based on your needs

3. **Run the seed command**:
   ```bash
   npm run seed:pinecone
   ```

### Option 2: Use a Different Embedding Model

If you need to keep dimension 1024, you'll need to use a different embedding model that produces 1024 dimensions. However, Google's embedding models produce 768 dimensions.

Alternative options:
- Use OpenAI's `text-embedding-3-large` (3072 dimensions, can be reduced)
- Use OpenAI's `text-embedding-3-small` (1536 dimensions)
- Use Cohere embeddings
- Use a custom embedding model

## Check Index Configuration

Run this command to check your index configuration:

```bash
npm run check:pinecone
```

This will:
- Show your index dimension
- Show your embedding model dimension
- Alert you if there's a mismatch

## Current Configuration

- **Embedding Model**: `models/embedding-001` (Google)
- **Expected Dimension**: 768
- **Pinecone Index**: Should be configured for 768 dimensions

## Troubleshooting

### Error: "Index does not exist"
- Create the index in Pinecone Console first
- Make sure the index name matches: `rag`

### Error: "Dimension mismatch"
- Run `npm run check:pinecone` to verify dimensions
- Recreate the index with the correct dimension (768)

### Error: "API key invalid"
- Verify `PINECONE_API_KEY` in `.env.local`
- Get your API key from [Pinecone Console](https://app.pinecone.io/)

