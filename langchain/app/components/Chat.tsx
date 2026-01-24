"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Model {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  shortName?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-1.5-pro");
  const [useRAG, setUseRAG] = useState<boolean>(false);
  const [showModels, setShowModels] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [sessionId] = useState<string>(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
//use useChat of ai lib , allow streaming 
  // Fetch models on component mount
  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await fetch("/api/models");
        if (response.ok) {
          const data = await response.json();
          const modelList = data.models || [];
          
          // Extract model names and filter for chat models
          const chatModels = modelList
            .filter((m: Model) => 
              m.supportedGenerationMethods?.includes("generateContent") ||
              m.name.includes("gemini")
            )
            .map((m: Model) => {
              // Extract model name from full path (e.g., "models/gemini-1.5-pro" -> "gemini-1.5-pro")
              const modelName = m.name.includes("/") 
                ? m.name.split("/").pop() || m.name 
                : m.name.replace("models/", "");
              return { ...m, shortName: modelName };
            });
          
          setModels(chatModels);
          if (chatModels.length > 0 && selectedModel === "gemini-1.5-pro") {
            // Only update if still using default
            const defaultModel = chatModels.find(m => m.shortName === "gemini-1.5-pro") 
              || chatModels[0];
            if (defaultModel?.shortName) {
              setSelectedModel(defaultModel.shortName);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    loadModels();
  }, []);

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch("/api/models");
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      const data = await response.json();
      const modelList = data.models || [];
      
      // Extract model names and filter for chat models
      const chatModels = modelList
        .filter((m: Model) => 
          m.supportedGenerationMethods?.includes("generateContent") ||
          m.name.includes("gemini")
        )
        .map((m: Model) => {
          // Extract model name from full path (e.g., "models/gemini-1.5-pro" -> "gemini-1.5-pro")
          const modelName = m.name.includes("/") 
            ? m.name.split("/").pop() || m.name 
            : m.name.replace("models/", "");
          return { ...m, shortName: modelName };
        });
      
      setModels(chatModels);
      setShowModels(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load models";
      const errorMsg: Message = {
        role: "assistant",
        content: `Error loading models: ${errorMessage}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          model: selectedModel,
          useRAG: useRAG,
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message || "No response from agent",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 border-b">
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">LangChain Chat</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Chat with Google Gemini using LangChain {useRAG ? "RAG Chain" : "Agent"}
              {useRAG && " (Hanoi Weather Forecasts)"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRAG}
                onChange={(e) => setUseRAG(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                RAG Mode
              </span>
            </label>
            <label htmlFor="model-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Model:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoadingModels || models.length === 0}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
            >
              {isLoadingModels ? (
                <option>Loading models...</option>
              ) : models.length === 0 ? (
                <option>No models available</option>
              ) : (
                models
                  .filter((m: any) => m.shortName)
                  .map((model: any, index: number) => (
                    <option key={index} value={model.shortName}>
                      {model.displayName || model.shortName}
                    </option>
                  ))
              )}
            </select>
            <button
              onClick={fetchModels}
              disabled={isLoadingModels}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
            >
              {isLoadingModels ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {showModels && models.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b p-4 max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Available Models ({models.length})</h2>
            <button
              onClick={() => setShowModels(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {models.map((model, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700"
              >
                <div className="font-semibold text-sm">{model.displayName || model.name}</div>
                {model.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {model.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {model.name}
                </div>
                {model.inputTokenLimit && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Tokens: {model.inputTokenLimit.toLocaleString()} input
                    {model.outputTokenLimit && ` / ${model.outputTokenLimit.toLocaleString()} output`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p>Start a conversation by typing a message below.</p>
            <p className="text-sm mt-2">
              Try: "What's the weather in Tokyo?"
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              }`}
            >
              <div className="text-sm font-semibold mb-1">
                {message.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

