'use client';

import { useState, useEffect } from 'react';

interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  itemCount: number;
}

const DEFAULT_COLLECTIONS = [
  { name: 'Projects', color: '#2563EB', description: 'Active project materials' },
  { name: 'Ideas', color: '#7C3AED', description: 'Ideas and inspiration' },
  { name: 'Reading', color: '#059669', description: 'Articles and long-form content' },
  { name: 'Inspiration', color: '#D97706', description: 'Visual and creative references' },
  { name: 'Resources', color: '#DC2626', description: 'Reference materials and tools' },
  { name: 'Smalley Coffee', color: '#92400E', description: 'Everything Smalley' },
];

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6B7280');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/collections');
    const data = await res.json();
    setCollections(data.collections || []);
  }

  async function createCollection() {
    if (!newName.trim()) return;
    await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    setNewName('');
    setShowNew(false);
    load();
  }

  async function seedDefaults() {
    for (const c of DEFAULT_COLLECTIONS) {
      await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
    }
    load();
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Collections</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Organize your knowledge</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showNew && (
          <div className="mb-4 p-4 rounded-xl border" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--surface)' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createCollection(); }}
              placeholder="Collection name…"
              className="w-full text-sm bg-transparent outline-none mb-3"
              style={{ color: 'var(--text)' }}
            />
            <div className="flex items-center gap-3">
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <button onClick={createCollection} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                Create
              </button>
              <button onClick={() => setShowNew(false)} className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        )}

        {collections.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>No collections yet.</p>
            <button
              onClick={seedDefaults}
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Create default collections
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {collections.map(col => (
              <div
                key={col.id}
                className="p-4 rounded-xl border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', borderLeftWidth: 3, borderLeftColor: col.color }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{col.name}</p>
                {col.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{col.description}</p>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {col.itemCount} {col.itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
