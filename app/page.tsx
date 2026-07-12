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
  const [capture, setCapture] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function refreshCount() {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItemCount(d.count ?? 0))
      .catch(() => {});
  }

  // Load persisted history + saved theme + item count.
  useEffect(() => {
    const saved = (localStorage.getItem("valet-theme") as Theme) || "light";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {});
    refreshCount();
  }, []);

  async function saveCapture() {
    const value = capture.trim();
    if (!value || capturing) return;
    setCapturing(true);
    const isUrl = /^https?:\/\/\S+$/i.test(value);
    try {
      const res = await fetch(isUrl ? "/api/capture" : "/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { url: value } : { text: value }),
      });
      const data = await res.json();
      const note = res.ok
        ? `Captured "${data.title}"${data.collections?.length ? ` → ${data.collections.join(", ")}` : ""}${data.status === "duplicate" ? " (already saved)" : ""}.`
        : `Couldn't capture: ${data.error}`;
      setMessages((m) => [...m, { role: "assistant", content: note }]);
      if (res.ok) {
        setCapture("");
        refreshCount();
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Capture failed: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setCapturing(false);
    }
  }

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
          Alfred
          <small>
            Valet · Chief of Staff
            {itemCount !== null ? ` · ${itemCount} in vault` : ""}
          </small>
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

      <div className="capture">
        <input
          value={capture}
          placeholder="Capture — paste a URL, or type a note…"
          onChange={(e) => setCapture(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCapture();
          }}
        />
        <button onClick={saveCapture} disabled={capturing || !capture.trim()}>
          {capturing ? "Saving…" : "Capture"}
        </button>
      </div>

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
