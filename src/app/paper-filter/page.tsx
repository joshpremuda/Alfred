'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FeedMeta {
  source: string;
  ok: boolean;
  method: string;
  count: number;
  error?: string;
}

interface BriefingData {
  brief: string;
  meta: {
    sourcesAttempted: number;
    sourcesSucceeded: number;
    fetchMs: number;
    totalMs: number;
    date: string;
  };
  feeds: FeedMeta[];
}

export default function PaperFilterPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/paper-filter');
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to generate briefing');
      } else {
        setData(json);
      }
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Paper Filter</h1>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Daily Brief
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{today}</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {loading ? 'Filtering…' : data ? 'Refresh' : 'Generate Brief'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!data && !loading && !error && (
          <div className="max-w-2xl mx-auto text-center py-20">
            <p className="text-3xl mb-3">☕</p>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Your morning brief is ready to brew.
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Alfred will pull headlines from {18} sources — NYT, FT, BBC, Semafor, The Economist, and more — and distill them into what actually matters.
            </p>
            <button
              onClick={generate}
              className="mt-6 px-6 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              Generate Today&apos;s Brief
            </button>
          </div>
        )}

        {loading && (
          <div className="max-w-2xl mx-auto py-20 text-center">
            <p className="text-xs animate-pulse" style={{ color: 'var(--text-secondary)' }}>
              Pulling from 18 sources and filtering…
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              This takes about 15–30 seconds.
            </p>
          </div>
        )}

        {error && (
          <div
            className="max-w-2xl mx-auto p-4 rounded-xl border text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <p className="font-medium mb-1">Couldn&apos;t generate brief</p>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        )}

        {data && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Brief */}
            <div
              className="p-6 rounded-xl border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <div className="prose prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xs font-semibold tracking-wider uppercase mt-5 mb-2" style={{ color: 'var(--text-secondary)' }}>{children}</h2>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text)' }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-1.5 mb-4">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm flex gap-2 leading-relaxed" style={{ color: 'var(--text)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>–</span>
                        <span>{children}</span>
                      </li>
                    ),
                    hr: () => (
                      <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-xs not-italic" style={{ color: 'var(--text-secondary)' }}>{children}</em>
                    ),
                  }}
                >
                  {data.brief}
                </ReactMarkdown>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.meta.sourcesSucceeded}/{data.meta.sourcesAttempted} sources · {Math.round(data.meta.totalMs / 1000)}s
              </p>
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {showSources ? 'Hide sources' : 'Source breakdown'}
              </button>
            </div>

            {showSources && (
              <div
                className="rounded-xl border divide-y"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                {data.feeds.map(f => (
                  <div key={f.source} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs" style={{ color: f.ok ? 'var(--text)' : 'var(--text-secondary)' }}>
                      {f.source}
                    </span>
                    <div className="flex items-center gap-2">
                      {f.ok ? (
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {f.count} items via {f.method}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#EF4444' }}>
                          {f.error || 'unavailable'}
                        </span>
                      )}
                      <span style={{ color: f.ok ? '#22C55E' : '#6B7280' }}>
                        {f.ok ? '●' : '○'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
