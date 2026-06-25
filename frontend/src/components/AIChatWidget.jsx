import { useState, useRef, useEffect } from "react";
import React from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function AIChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your IT Help Desk assistant. Ask me about your tickets, or anything IT-related — I can also help you figure out how to submit a new ticket.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  if (!user) return null;

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const history = nextMessages
        .slice(0, -1)
        .filter((_, i) => i > 0) // drop the assistant greeting
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post("/ai/chat", { message: text, history });
      setMockMode(!!res.data.mock);
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply, mock: !!res.data.mock }]);
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong reaching the assistant.";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={s.launcher}
        aria-label="Open AI assistant"
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={s.panel}>
          <div style={s.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={s.headerIcon}>🤖</span>
              <div>
                <div style={s.headerTitle}>
                  IT Assistant
                  {mockMode && <span style={s.mockBadge}>🧪 Mock mode</span>}
                </div>
                <div style={s.headerSub}>Ask about your tickets or get IT help</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={s.closeBtn}>✕</button>
          </div>

          {mockMode && (
            <div style={s.mockBanner}>
              🧪 Running in mock mode — live AI is unavailable (no API key or no billing credits). Responses are limited canned replies based on your ticket data.
            </div>
          )}

          <div style={s.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} style={{ ...s.bubbleRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ ...s.bubble, ...(m.role === "user" ? s.bubbleUser : s.bubbleAssistant) }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ ...s.bubbleRow, justifyContent: "flex-start" }}>
                <div style={{ ...s.bubble, ...s.bubbleAssistant, ...s.typing }}>
                  <span style={s.dot} /><span style={{ ...s.dot, animationDelay: "0.15s" }} /><span style={{ ...s.dot, animationDelay: "0.3s" }} />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={send} style={s.inputRow}>
            <input
              style={s.input}
              placeholder="Ask about your tickets or IT issues..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading} style={s.sendBtn}>
              {loading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes aiBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: .4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

const s = {
  launcher: {
    position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
    background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", color: "#fff",
    fontSize: 24, cursor: "pointer", boxShadow: "0 8px 24px rgba(59,130,246,.4)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
  },
  panel: {
    position: "fixed", bottom: 92, right: 24, width: 360, maxHeight: 560, height: 480,
    background: "#13131f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
    boxShadow: "0 16px 48px rgba(0,0,0,.5)", display: "flex", flexDirection: "column",
    overflow: "hidden", zIndex: 1000, fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "#1a1a28",
  },
  headerIcon: { fontSize: 20 },
  headerTitle: { fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 },
  headerSub: { fontSize: 10, color: "#6666aa", marginTop: 1 },
  mockBadge: {
    fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,.15)",
    border: "1px solid rgba(245,158,11,.3)", borderRadius: 99, padding: "1px 7px",
  },
  mockBanner: {
    fontSize: 11, color: "#fcd34d", background: "rgba(245,158,11,.1)",
    borderBottom: "1px solid rgba(245,158,11,.2)", padding: "8px 14px", lineHeight: 1.4,
  },
  closeBtn: { background: "none", border: "none", color: "#6666aa", fontSize: 14, cursor: "pointer", padding: 4 },
  messages: { flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 },
  bubbleRow: { display: "flex" },
  bubble: {
    maxWidth: "82%", padding: "9px 13px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
    whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  bubbleUser: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", borderBottomRightRadius: 4 },
  bubbleAssistant: { background: "#1e1e2e", color: "#d0d0e8", border: "1px solid rgba(255,255,255,0.06)", borderBottomLeftRadius: 4 },
  typing: { display: "flex", gap: 4, padding: "12px 16px" },
  dot: {
    width: 6, height: 6, borderRadius: "50%", background: "#6666aa",
    display: "inline-block", animation: "aiBounce 1.2s infinite ease-in-out",
  },
  inputRow: { display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  input: {
    flex: 1, background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 9,
    padding: "9px 12px", color: "#e0e0f0", fontSize: 13, outline: "none", fontFamily: "inherit",
  },
  sendBtn: {
    background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 9,
    padding: "9px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
};