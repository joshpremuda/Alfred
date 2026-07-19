"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

export default function PaperFilterView() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    setText("");
    try {
      const res = await fetch("/api/paper-filter", { method: "POST" });
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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <div className="view">
      <header className="viewhead">
        <h1>The Paper Filter</h1>
        <button className="linkbtn" onClick={run} disabled={busy}>
          {busy ? "Reading…" : "Refresh"}
        </button>
      </header>
      <div className="brief">
        {text ? <Markdown text={text} /> : <p className="empty">Reading today&rsquo;s news across your sources…</p>}
      </div>
    </div>
  );
}
