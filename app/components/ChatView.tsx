"use client";

import { useEffect, useRef, useState } from "react";
import Capture from "./Capture";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ChatView() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t }),
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const ch = dec.decode(value, { stream: true });
        setMessages((m) => {
          const n = [...m];
          n[n.length - 1] = { role: "assistant", content: n[n.length - 1].content + ch };
          return n;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const n = [...m];
        n[n.length - 1] = { role: "assistant", content: `[${err instanceof Error ? err.message : String(err)}]` };
        return n;
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      alert("Voice input isn't supported in this browser (try Chrome/Arc).");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " : "") + text);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  function systemNote(msg: string) {
    setMessages((m) => [...m, { role: "assistant", content: msg }]);
  }

  return (
    <div className="view chatview">
      <Capture onMessage={systemNote} />

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="empty">
            Good day, Josh. I&rsquo;m Alfred. Ask me anything — &ldquo;what should I work on
            today?&rdquo;, &ldquo;what&rsquo;s stalled?&rdquo;, or capture something above.
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
        <button
          className={listening ? "mic listening" : "mic"}
          onClick={toggleMic}
          title="Voice input"
          aria-label="Voice input"
        >
          {listening ? "●" : "🎙"}
        </button>
        <textarea
          value={input}
          placeholder="Message Alfred…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
