'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BRIEFING_FEEDS } from '@/lib/briefing/feeds';

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

interface CustomSource {
  id: string;
  name: string;
  homepage: string;
  rss?: string;
}

export default function PaperFilterPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'brief' | 'sources'>('brief');
  const [customSources, setCustomSources] = useState<CustomSource[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newRss, setNewRss] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSources(); }, []);

  async function loadSources() {
    const res = await fetch('/api/paper-filter/sources');
    const json = await res.json();
    setCustomSources(json.sources || []);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setData(null);
    setTab('brief');
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

  async function addSource() {
    if (!newName.trim() || !newUrl.trim()) return;
    setSaving(true);
    await fetch('/api/paper-filter/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), homepage: newUrl.trim(), rss: newRss.trim() || undefined }),
    });
    setNewName(''); setNewUrl(''); setNewRss('');
    setAdding(false);
    setSaving(false);
    loadSources();
  }

  async function removeSource(id: string) {
    await fetch('/api/paper-filter/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    loadSources();
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['brief', 'sources'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-medium capitalize"
                style={{
                  backgroundColor: tab === t ? 'var(--border)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                {t === 'sources' ? `Sources (${BRIEFING_FEEDS.length + customSources.length})` : 'Brief'}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {loading ? 'Filtering…' : data ? 'Refresh' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* BRIEF TAB */}
        {tab === 'brief' && (
          <>
            {!data && !loading && !error && (
              <div className="max-w-2xl mx-auto text-center py-20">
                <p className="text-3xl mb-3">☕</p>
                <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  Your morning brief is ready to brew.
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Alfred pulls headlines from {BRIEFING_FEEDS.length + customSources.length} sources and distills them into what actually matters.
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
                  Pulling from {BRIEFING_FEEDS.length + customSources.length} sources and filtering…
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>This takes about 15–30 seconds.</p>
              </div>
            )}

            {error && (
              <div className="max-w-2xl mx-auto p-4 rounded-xl border text-sm" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Couldn&apos;t generate brief</p>
                <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
              </div>
            )}

            {data && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="p-6 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-semibold tracking-wider uppercase mt-5 mb-2" style={{ color: 'var(--text-secondary)' }}>{children}</h2>,
                      p: ({ children }) => <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text)' }}>{children}</p>,
                      ul: ({ children }) => <ul className="space-y-1.5 mb-4">{children}</ul>,
                      li: ({ children }) => (
                        <li className="text-sm flex gap-2 leading-relaxed" style={{ color: 'var(--text)' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>–</span>
                          <span>{children}</span>
                        </li>
                      ),
                      hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-xs not-italic" style={{ color: 'var(--text-secondary)' }}>{children}</em>,
                    }}
                  >
                    {data.brief}
                  </ReactMarkdown>
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                  {data.meta.sourcesSucceeded}/{data.meta.sourcesAttempted} sources · {Math.round(data.meta.totalMs / 1000)}s
                </p>
              </div>
            )}
          </>
        )}

        {/* SOURCES TAB */}
        {tab === 'sources' && (
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Add custom source */}
            <div>
              {!adding ? (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full py-2.5 rounded-xl border text-sm border-dashed"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + Add source
                </button>
              ) : (
                <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>New source</p>
                  <input
                    placeholder="Name (e.g. Axios)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                  />
                  <input
                    placeholder="Homepage URL (e.g. https://axios.com)"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                  />
                  <input
                    placeholder="RSS feed URL (optional — leave blank to auto-scrape)"
                    value={newRss}
                    onChange={e => setNewRss(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addSource}
                      disabled={saving || !newName.trim() || !newUrl.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      {saving ? 'Saving…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewName(''); setNewUrl(''); setNewRss(''); }}
                      className="px-4 py-1.5 rounded-lg text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Custom sources */}
            {customSources.length > 0 && (
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Custom
                </p>
                <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border)' }}>
                  {customSources.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{s.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.rss || s.homepage}</p>
                      </div>
                      <button
                        onClick={() => removeSource(s.id)}
                        className="text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default sources */}
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                Default ({BRIEFING_FEEDS.length})
              </p>
              <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border)' }}>
                {BRIEFING_FEEDS.map(s => (
                  <div key={s.name} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{s.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {s.rss ? 'RSS' : 'scrape'} · {s.homepage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
