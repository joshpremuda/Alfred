'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface Project {
  id: string;
  name: string;
  status: string;
  description: string;
  next_actions: string;
  updated_at: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  stalled: '#EF4444',
  paused: '#F59E0B',
  complete: '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  stalled: 'Stalled',
  paused: 'Paused',
  complete: 'Complete',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [editData, setEditData] = useState<Partial<Project>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data.projects || []);
  }

  async function createProject() {
    if (!newName.trim()) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    setNewName('');
    setShowNew(false);
    load();
  }

  async function updateProject(id: string, data: Partial<Project>) {
    const p = projects.find(p => p.id === id)!;
    const nextActions = typeof data.next_actions === 'string'
      ? data.next_actions.split('\n').filter(Boolean)
      : JSON.parse(p.next_actions || '[]');

    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...p,
        ...data,
        next_actions: nextActions,
      }),
    });
    setEditing(null);
    load();
  }

  const byStatus = ['active', 'stalled', 'paused', 'complete'].map(status => ({
    status,
    items: projects.filter(p => p.status === status),
  })).filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Projects</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{projects.length} total</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {showNew && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false); }}
              placeholder="Project name…"
              className="flex-1 px-3 py-2 rounded-lg text-sm border bg-transparent outline-none"
              style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
            />
            <button onClick={createProject} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              Add
            </button>
            <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        )}

        {byStatus.map(group => (
          <div key={group.status}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[group.status] }} />
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
                {STATUS_LABELS[group.status]}
              </span>
            </div>

            <div className="space-y-2">
              {group.items.map(project => {
                const actions = (() => { try { return JSON.parse(project.next_actions) as string[]; } catch { return []; } })();
                const isEditing = editing === project.id;

                return (
                  <div
                    key={project.id}
                    className="p-4 rounded-xl border"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          value={editData.name ?? project.name}
                          onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                          className="w-full text-sm font-medium bg-transparent border-b outline-none pb-1"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                        <select
                          value={editData.status ?? project.status}
                          onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                          className="text-xs px-2 py-1 rounded border bg-transparent"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          {Object.keys(STATUS_LABELS).map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <textarea
                          value={editData.description ?? project.description}
                          onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                          placeholder="Description…"
                          rows={2}
                          className="w-full text-xs bg-transparent border rounded-lg p-2 outline-none resize-none"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                        <textarea
                          value={editData.next_actions ?? actions.join('\n')}
                          onChange={e => setEditData(d => ({ ...d, next_actions: e.target.value }))}
                          placeholder="Next actions (one per line)…"
                          rows={3}
                          className="w-full text-xs bg-transparent border rounded-lg p-2 outline-none resize-none font-mono"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateProject(project.id, editData)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditing(null); setEditData({}); }}
                            className="px-3 py-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditing(project.id); setEditData({}); }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{project.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${STATUS_COLORS[project.status]}20`, color: STATUS_COLORS[project.status] }}>
                            {STATUS_LABELS[project.status]}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
                        )}
                        {actions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {actions.slice(0, 3).map((a, i) => (
                              <p key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <span>→</span>{a}
                              </p>
                            ))}
                            {actions.length > 3 && (
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>+{actions.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Add a project or ask Alfred to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
