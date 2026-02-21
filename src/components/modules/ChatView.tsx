import { useState, useRef, useEffect } from "react";
import { useStore } from "@/stores/app";
import { runShellCommand } from "@/services/tauri";
import type { ChatMessage } from "@/types";

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [currentThinking, setCurrentThinking] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Settings from store
  const claudeCodeEnabled = useStore((s) => s.claudeCodeEnabled);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, currentThinking]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setStreaming(true);
    setCurrentResponse("");

    try {
      // Build conversation context
      const conversation = messages
        .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const prompt = conversation
        ? `${conversation}\n\nHuman: ${userMessage.content}\n\nAssistant:`
        : `Human: ${userMessage.content}\n\nAssistant:`;

      // Use Claude Code with streaming simulation
      // Since Claude Code doesn't support streaming via CLI, we'll simulate it
      const result = await runShellCommand("claude", ["-p", prompt]);

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: result,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      let errorContent = errMsg;

      if (errMsg.includes("Failed to run") || errMsg.includes("not found") || errMsg.includes("ENOENT")) {
        errorContent = "❌ Claude CLI 未安装。请先安装：npm install -g @anthropic-ai/claude-code";
      } else if (errMsg.includes("Session") || errMsg.includes("session")) {
        errorContent = "❌ 无法在嵌套会话中运行。请直接在终端中打开应用。";
      }

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: errorContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreaming(false);
      setCurrentThinking("");
      setCurrentResponse("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentThinking("");
    setCurrentResponse("");
  };

  if (!claudeCodeEnabled) {
    return (
      <div className="max-w-[800px] mx-auto pt-[60px]">
        <div className="panel p-10 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <div className="text-lg font-medium mb-2">Claude Code 未启用</div>
          <div className="text-text-dim mb-5">
            请先在设置中启用 Claude Code 并配置路径
          </div>
          <button
            className="btn btn-primary"
            onClick={() => useStore.getState().setView("settings")}
          >
            前往设置
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-[900px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="font-disp text-2xl tracking-widest text-accent">
            AI 聊天
          </div>
          <span className="text-[10px] px-2 py-0.75 rounded-full bg-accent/10 text-accent border border-accent/20">
            Claude Code
          </span>
        </div>
        <button className="btn btn-ghost text-xs" onClick={clearChat}>
          清空对话
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto flex flex-col gap-4 pb-5">
        {messages.length === 0 && !streaming && (
          <div className="flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <div className="text-5xl mb-3">💬</div>
              <div>开始一段对话吧</div>
              <div className="text-xs mt-2">Claude Code 会帮你解答问题</div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={{
                background: msg.role === "user" ? "var(--accent)" : "var(--panel)",
                color: msg.role === "user" ? "white" : "var(--text)",
                border: msg.role === "user" ? "none" : "1px solid var(--border)",
              }}
            >
              {msg.content}
            </div>
            <span className="text-[10px] text-text-dim mt-1 px-2">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}

        {streaming && (
          <div className="flex flex-col items-start">
            <div
              className="max-w-[80%] px-4 py-3 rounded-2xl text-sm"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
              }}
            >
              {currentThinking && (
                <div className="mb-2 italic opacity-70">
                  💭 {currentThinking}
                </div>
              )}
              {currentResponse || "正在思考..."}
              <span className="blink ml-1">▊</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Shift+Enter 换行)"
            disabled={loading}
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl border border-border bg-panel text-sm resize-none outline-none font-inherit min-h-[44px] max-h-[200px]"
          />
          <button
            className="btn btn-primary px-5 py-2.5 rounded-2xl text-sm"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? "..." : "发送"}
          </button>
        </div>
        <div className="text-[10px] text-text-dim mt-2 text-center">
          Enter 发送 · Shift+Enter 换行 · Claude Code 提供 AI 支持
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
}
