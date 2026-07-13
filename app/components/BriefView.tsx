"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function BriefView() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const generate = useCallback(async () => {
    setBusy(true);
    setText("");
    try {
      const res = await fetch("/api/brief", { method: "POST" });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } catch (err) {
      setText(`[${err instanceof Error ? err.message : String(err)}]`);
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-run once when the view opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generate();
  }, [generate]);

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Briefing</h1>
        <button className="linkbtn" onClick={generate} disabled={busy}>
          {busy ? "Thinking…" : "Regenerate"}
        </button>
      </header>
      <div className="brief">
        {text ? <pre className="briefbody">{text}</pre> : <p className="empty">Preparing your briefing…</p>}
      </div>
    </div>
  );
}
