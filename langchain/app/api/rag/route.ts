import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { getVectorStore } from "@/lib/vector-store";

export async function POST(req: NextRequest) {
  try {
    const { question, model: modelName } = await req.json();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not set in environment variables" },
        { status: 500 }
      );
    }

    // Use provided model or default to gemini-1.5-pro
    const selectedModel = modelName || "gemini-1.5-pro";

    // Create Google Gemini model
    const model = new ChatGoogleGenerativeAI({
      model: selectedModel,
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // Get vector store
    const vectorStore = await getVectorStore();
    const retriever = vectorStore.asRetriever({
      k: 3, // Retrieve top 3 most relevant documents
    });

    // Create the RAG prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant that answers questions about Hanoi weather forecasts based on the provided context documents. 
        
Use only the information from the context documents to answer questions. If the context doesn't contain enough information to answer the question, say so.

Context documents:
{context}

Answer the question based on the context above. Be specific and cite dates or periods when relevant.`,
      ],
      ["human", "{question}"],
    ]);

    // Create the RAG chain
    const ragChain = RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          // Retrieve relevant documents
          const docs = await retriever.getRelevantDocuments(input.question);
          // Combine document contents
          return docs.map((doc) => doc.pageContent).join("\n\n---\n\n");
        },
        question: (input: { question: string }) => input.question,
      },
      prompt,
      model,
    ]);

    // Invoke the chain
    const response = await ragChain.invoke({ question });

    // Extract the answer
    const answer = response.content;

    return NextResponse.json({
      answer,
      question,
    });
  } catch (error: unknown) {
    console.error("Error in RAG chain:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get response";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

