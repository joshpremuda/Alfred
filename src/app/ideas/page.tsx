'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

interface Idea {
  id: string;
  title: string;
  description: string;
  status: string;
  notes: string;
  created_at: number;
}

const STATUS_OPTIONS = ['raw', 'developing', 'active', 'shelved'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  raw: { backgroundColor: '#6B728020', color: '#6B7280' },
  developing: { backgroundColor: '#3B82F620', color: '#3B82F6' },
  active: { backgroundColor: '#22C55E20', color: '#22C55E' },
  shelved: { backgroundColor: '#F59E0B20', color: '#F59E0B' },
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/ideas');
    const data = await res.json();
    setIdeas(data.ideas || []);
  }

  async function createIdea() {
    if (!newTitle.trim()) return;
    await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, description: newDesc }),
    });
    setNewTitle('');
    setNewDesc('');
    setShowNew(false);
    load();
  }

  async function updateStatus(idea: Idea, status: string) {
    await fetch('/api/ideas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...idea, status }),
    });
    load();
  }

  const filtered = filter === 'all' ? ideas : ideas.filter(i => i.status === filter);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Idea Reservoir</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ideas.length} ideas — nothing is ever deleted</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + Add Idea
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="px-6 py-3 border-b flex gap-2 flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx('px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors')}
            style={
              filter === s
                ? { backgroundColor: 'var(--border)', color: 'var(--text)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showNew && (
          <div
            className="mb-4 p-4 rounded-xl border"
            style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--surface)' }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createIdea(); if (e.key === 'Escape') setShowNew(false); }}
              placeholder="Idea title…"
              className="w-full text-sm font-medium bg-transparent outline-none mb-2"
              style={{ color: 'var(--text)' }}
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)…"
              rows={2}
              className="w-full text-xs bg-transparent outline-none resize-none"
              style={{ color: 'var(--text-secondary)' }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={createIdea} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                Add to Reservoir
              </button>
              <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {filtered.map(idea => (
            <div
              key={idea.id}
              className="p-4 rounded-xl border cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              onClick={() => setExpanded(expanded === idea.id ? null : idea.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{idea.title}</p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={STATUS_STYLE[idea.status] || {}}
                >
                  {idea.status}
                </span>
              </div>

              {idea.description && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{idea.description}</p>
              )}

              {expanded === idea.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  {idea.notes && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{idea.notes}</p>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_OPTIONS.filter(s => s !== idea.status).map(s => (
                      <button
                        key={s}
                        onClick={e => { e.stopPropagation(); updateStatus(idea, s); }}
                        className="text-xs px-2 py-1 rounded-lg border capitalize"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        Mark {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                    Added {new Date(idea.created_at * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {filter === 'all' ? 'No ideas yet.' : `No ${filter} ideas.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
