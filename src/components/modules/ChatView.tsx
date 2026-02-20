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
      <div style={{ maxWidth: 800, margin: "0 auto", paddingTop: 60 }}>
        <div className="panel" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Claude Code 未启用</div>
          <div style={{ color: "var(--text-dim)", marginBottom: 20 }}>
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-disp)", fontSize: 24, letterSpacing: 2, color: "var(--accent)" }}>
            AI 聊天
          </div>
          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "rgba(0,200,255,0.1)", color: "var(--accent)", border: "1px solid rgba(0,200,255,0.2)" }}>
            Claude Code
          </span>
        </div>
        <button className="btn btn-ghost" onClick={clearChat} style={{ fontSize: 12 }}>
          清空对话
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "0 0 20px 0" }}>
        {messages.length === 0 && !streaming && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <div>开始一段对话吧</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>Claude Code 会帮你解答问题</div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: 16,
                background: msg.role === "user"
                  ? "var(--accent)"
                  : "var(--panel)",
                color: msg.role === "user" ? "white" : "var(--text)",
                border: msg.role === "user" ? "none" : "1px solid var(--border)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              {msg.content}
            </div>
            <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, padding: "0 8px" }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}

        {streaming && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: 16,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
                fontSize: 14,
              }}
            >
              {currentThinking && (
                <div style={{ marginBottom: 8, fontStyle: "italic", opacity: 0.7 }}>
                  💭 {currentThinking}
                </div>
              )}
              {currentResponse || "正在思考..."}
              <span className="blink" style={{ marginLeft: 4 }}>▊</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Shift+Enter 换行)"
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--text)",
              fontSize: 14,
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              minHeight: 44,
              maxHeight: 200,
            }}
          />
          <button
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: 16,
              fontSize: 14,
            }}
          >
            {loading ? "..." : "发送"}
          </button>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
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
