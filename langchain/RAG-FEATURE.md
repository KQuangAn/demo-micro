# RAG (Retrieval Augmented Generation) Feature

This project includes a RAG chain that retrieves information from a source of truth (documents) and answers questions based on that information.

## What is RAG?

RAG (Retrieval Augmented Generation) is a technique that:
1. **Retrieves** relevant documents from a knowledge base
2. **Augments** the LLM prompt with context from those documents
3. **Generates** answers based on the retrieved context

This ensures the AI answers questions using only information from your source documents, making responses more accurate and grounded in facts.

## How It Works

### 1. Document Storage
- Weather forecast documents for Hanoi are stored in `data/hanoi-weather-forecasts.json`
- Documents are converted to embeddings using Google's embedding model
- Embeddings are stored in a vector store for fast similarity search

### 2. Retrieval
- When you ask a question, the system:
  - Converts your question to an embedding
  - Searches for the 3 most similar documents (k=3)
  - Retrieves those documents as context

### 3. Generation
- The retrieved documents are added to the prompt as context
- The LLM generates an answer based on the context
- The answer is grounded in the source documents

## Using RAG Mode

### In the UI:
1. Check the **"RAG Mode"** checkbox in the chat header
2. Ask questions about Hanoi weather forecasts
3. The system will answer based on the documents in `data/hanoi-weather-forecasts.json`

### Example Questions:
- "What's the weather in Hanoi today?"
- "Will it rain on New Year's Eve?"
- "What's the best time to visit Hanoi?"
- "What's the climate like in Hanoi?"

### API Usage:

```typescript
// POST /api/chat
{
  "messages": [
    { "role": "user", "content": "What's the weather in Hanoi tomorrow?" }
  ],
  "model": "gemini-1.5-pro",
  "useRAG": true  // Enable RAG mode
}
```

## Files Structure

```
langchain/
├── data/
│   └── hanoi-weather-forecasts.json    # Source documents
├── lib/
│   └── vector-store.ts                 # Vector store initialization
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts                # Chat endpoint (supports RAG)
│   │   └── rag/
│   │       └── route.ts                 # Dedicated RAG endpoint
│   └── components/
│       └── Chat.tsx                    # Chat UI with RAG toggle
```

## Adding Your Own Documents

To add your own documents:

1. **Create a JSON file** in `data/` directory:
```json
[
  {
    "title": "Document Title",
    "content": "Document content here...",
    "metadata": {
      "category": "example",
      "date": "2024-01-01"
    }
  }
]
```

2. **Update `lib/vector-store.ts`**:
```typescript
import yourData from "../data/your-documents.json";

// Add to documents array
const documents = [
  ...hanoiWeatherData.map(...),
  ...yourData.map(...),
];
```

3. **Restart the server** to rebuild the vector store

## Technical Details

### Vector Store
- Uses **Pinecone** for persistent vector storage
- Index name: `rag`
- Endpoint: `https://rag-46823aa.svc.aped-4627-b74a.pinecone.io`
- Documents are stored persistently and survive server restarts
- Requires `PINECONE_API_KEY` environment variable

### Embeddings
- Uses Google's `embedding-001` model
- 768-dimensional vectors
- Cosine similarity for retrieval

### Retrieval Parameters
- `k=3`: Retrieves top 3 most relevant documents
- Adjust in `lib/vector-store.ts` or `app/api/chat/route.ts`

## RAG vs Agent Mode

| Feature | Agent Mode | RAG Mode |
|---------|-----------|----------|
| **Source** | General knowledge + Tools | Your documents only |
| **Accuracy** | May hallucinate | Grounded in documents |
| **Use Case** | General questions, tool usage | Domain-specific Q&A |
| **Speed** | Fast | Slightly slower (retrieval step) |

## Best Practices

1. **Document Quality**: Write clear, well-structured documents
2. **Chunking**: Break long documents into smaller chunks (200-500 words)
3. **Metadata**: Add relevant metadata for better filtering
4. **Testing**: Test with various question phrasings
5. **Monitoring**: Check which documents are retrieved for each question

## Troubleshooting

### No relevant documents found
- Check if your question matches document content
- Try rephrasing the question
- Verify documents are loaded correctly

### Answers not accurate
- Increase `k` value to retrieve more documents
- Improve document quality and structure
- Add more relevant documents

### Slow responses
- Reduce `k` value
- Use a faster embedding model
- Consider caching embeddings

## Next Steps

- [ ] Add persistent vector store (Pinecone/Weaviate)
- [ ] Add document upload functionality
- [ ] Add document management UI
- [ ] Add citation/source links in responses
- [ ] Add confidence scores for retrieved documents

