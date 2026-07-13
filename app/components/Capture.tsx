"use client";

import { useState } from "react";

export default function Capture({
  onSaved,
  onMessage,
}: {
  onSaved?: () => void;
  onMessage?: (msg: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    const isUrl = /^https?:\/\/\S+$/i.test(v);
    try {
      const res = await fetch(isUrl ? "/api/capture" : "/api/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { url: v } : { text: v }),
      });
      const d = await res.json();
      const msg = res.ok
        ? `Captured "${d.title}"${d.collections?.length ? ` → ${d.collections.join(", ")}` : ""}${
            d.status === "duplicate" ? " (already saved)" : ""
          }.`
        : `Couldn't capture: ${d.error}`;
      onMessage?.(msg);
      if (res.ok) {
        setValue("");
        onSaved?.();
      }
    } catch (err) {
      onMessage?.(`Capture failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="capture">
      <input
        value={value}
        placeholder="Capture — paste a URL, or type a note…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <button onClick={save} disabled={busy || !value.trim()}>
        {busy ? "Saving…" : "Capture"}
      </button>
    </div>
  );
}
