"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark" | "sunny";
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const THEMES: Theme[] = ["light", "dark", "sunny"];

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load persisted history + saved theme.
  useEffect(() => {
    const saved = (localStorage.getItem("valet-theme") as Theme) || "light";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  function pickTheme(t: Theme) {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("valet-theme", t);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: `[${msg}]` };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Alfred<small>Valet · Chief of Staff</small>
        </div>
        <div className="themes">
          {THEMES.map((t) => (
            <button
              key={t}
              aria-pressed={theme === t}
              onClick={() => pickTheme(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="empty">
            Good day, Josh. I&rsquo;m Alfred. Ask me anything, or say
            &ldquo;Brief me&rdquo; once your calendar and projects are connected.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
      </div>

      <div className="composer">
        <textarea
          value={input}
          placeholder="Message Alfred…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
