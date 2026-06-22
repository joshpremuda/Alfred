'use client';

import { useState, useEffect, useRef } from 'react';

interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  source?: string;
  excerpt?: string;
  created_at: number;
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeItem[] | null>(null);
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const res = await fetch('/api/knowledge?limit=50');
    const data = await res.json();
    setItems(data.items || []);
    setTotal(data.total || 0);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!v.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(v)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    }, 300);
  }

  async function handleUrlCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setUrlLoading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        setUrl('');
        loadItems();
      }
    } finally {
      setUrlLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/knowledge/upload', { method: 'POST', body: formData });
      if (res.ok) loadItems();
    } finally {
      setFileLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    loadItems();
  }

  const displayItems = searchResults ?? items;

  const TYPE_ICON: Record<string, string> = {
    url: '↗',
    document: '◻',
    note: '◈',
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Knowledge Vault</h1>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{total} items saved</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add content */}
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <form onSubmit={handleUrlCapture} className="flex gap-2 mb-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste a URL to save…"
              className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <button
              type="submit"
              disabled={urlLoading || !url}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {urlLoading ? 'Saving…' : 'Save URL'}
            </button>
          </form>

          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md,.doc,.docx" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={fileLoading}
              className="px-3 py-1.5 rounded-lg text-sm border transition-opacity disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {fileLoading ? 'Uploading…' : '+ Upload file'}
            </button>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>PDF, TXT, MD</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search knowledge…"
            className="w-full px-3 py-2 rounded-lg text-sm border bg-transparent outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>

        {/* Items */}
        <div className="px-6 py-4 space-y-2">
          {searchResults !== null && searchResults.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              No results for "{search}"
            </p>
          )}
          {displayItems.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl border group transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <span className="text-xs mt-0.5 w-4 flex-shrink-0 text-center" style={{ color: 'var(--text-secondary)' }}>
                {TYPE_ICON[item.type] || '◈'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {item.title}
                </p>
                {item.excerpt && (
                  <p
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: 'var(--text-secondary)' }}
                    dangerouslySetInnerHTML={{ __html: item.excerpt }}
                  />
                )}
                {item.source && !item.source.startsWith('/') && (
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs mt-0.5 truncate block hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {new URL(item.source).hostname}
                  </a>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(item.created_at * 1000).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 text-xs transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}

          {displayItems.length === 0 && searchResults === null && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your knowledge vault is empty.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Save URLs, upload documents, or ask Alfred to save information.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
