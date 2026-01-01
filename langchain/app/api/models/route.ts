import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not set in environment variables" },
        { status: 500 }
      );
    }

    // Call Google Generative AI REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Failed to fetch models: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Extract and format model information
    const modelList = (data.models || []).map((model: any) => ({
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      supportedGenerationMethods: model.supportedGenerationMethods || [],
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit,
      version: model.version,
      temperature: model.temperature,
      topP: model.topP,
      topK: model.topK,
    }));

    return NextResponse.json({
      models: modelList,
      count: modelList.length,
    });
  } catch (error: unknown) {
    console.error("Error listing models:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to list models";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

