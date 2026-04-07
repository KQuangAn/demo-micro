"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  agent?: "simple" | "react";
  durationMs?: number;
  steps?: number;
}

type AgentMode = "simple" | "react";

export default function EC2Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>("react");
  const [threadId, setThreadId] = useState<string>("");
  const [showInfo, setShowInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate threadId for react agent on mount
  useEffect(() => {
    setThreadId(`thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const endpoint =
          agentMode === "react" ? "/api/ec2/react" : "/api/ec2/simple";

        const body: Record<string, string> = { message: trimmed };
        if (agentMode === "react" && threadId) {
          body.threadId = threadId;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        const assistantMessage: Message = {
          role: "assistant",
          content: data.message || "No response",
          agent: data.agent,
          durationMs: data.durationMs,
          steps: data.reasoningSteps,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Save threadId from response for react agent
        if (data.threadId) {
          setThreadId(data.threadId);
        }
      } catch (error: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ Error: ${error.message}`,
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, agentMode, threadId]
  );

  const clearChat = () => {
    setMessages([]);
    setThreadId(
      `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
  };

  const quickQuestions = [
    "List all my security groups",
    "Which groups have SSH open to the internet?",
    "Run a full security audit",
    "Analyze the legacy-app security group",
    "Find groups with port 6379 open to the world",
    "What ports are exposed on web-server-prod?",
    "Is my Redis cache secure?",
    "Compare database-prod and dev-anything-goes groups",
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🛡️ EC2 Security Group Analyzer
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              AI-powered security group analysis using LangChain
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Agent mode toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setAgentMode("simple")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  agentMode === "simple"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                Simple Agent
              </button>
              <button
                onClick={() => setAgentMode("react")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  agentMode === "react"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                ReAct Agent
              </button>
            </div>
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {/* Agent mode info banner */}
      {showInfo && (
        <div
          className={`px-6 py-3 text-sm border-b ${
            agentMode === "react"
              ? "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
          }`}
        >
          <div className="max-w-5xl mx-auto flex justify-between items-start">
            <div>
              {agentMode === "react" ? (
                <>
                  <strong className="text-purple-700 dark:text-purple-300">
                    ReAct Agent
                  </strong>
                  <span className="text-purple-600 dark:text-purple-400">
                    {" "}— Multi-step reasoning with memory. Thinks step-by-step,
                    calls multiple tools, remembers conversation history.
                    Thread: <code className="text-xs">{threadId.slice(0, 20)}…</code>
                  </span>
                </>
              ) : (
                <>
                  <strong className="text-blue-700 dark:text-blue-300">
                    Simple Agent
                  </strong>
                  <span className="text-blue-600 dark:text-blue-400">
                    {" "}— Single-pass. Faster and cheaper but no memory between
                    messages. Best for quick lookups.
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🔒</div>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Ask about your EC2 Security Groups
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-lg mx-auto">
                I can list, search, and analyze your security groups for
                misconfigurations, open ports, and security risks.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors text-sm text-gray-700 dark:text-gray-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {msg.role === "assistant" && msg.agent && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        msg.agent === "react"
                          ? "bg-purple-400"
                          : "bg-blue-400"
                      }`}
                    />
                    {msg.agent === "react" ? "ReAct Agent" : "Simple Agent"}
                    {msg.steps !== undefined && msg.steps > 0 && (
                      <span>• {msg.steps} tool calls</span>
                    )}
                    {msg.durationMs && (
                      <span>• {(msg.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                  {agentMode === "react"
                    ? "Thinking step by step…"
                    : "Processing…"}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-5xl mx-auto flex gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your security groups…"
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-6 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50 ${
              agentMode === "react"
                ? "bg-purple-500 hover:bg-purple-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
