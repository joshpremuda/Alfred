'use client';

import { useState, useEffect } from 'react';

interface ConnectorStatus {
  name: string;
  description: string;
  enabled: boolean;
  requiredEnvVars: string[];
}

interface SyncResult {
  connector: string;
  imported: number;
  skipped: number;
  errors: string[];
}

const SETUP_INSTRUCTIONS: Record<string, { steps: string[]; url: string }> = {
  'Instapaper': {
    url: 'https://instapaper.com',
    steps: [
      'Add to .env.local:',
      'INSTAPAPER_USERNAME=your@email.com',
      'INSTAPAPER_PASSWORD=yourpassword',
    ],
  },
  'Feedly': {
    url: 'https://feedly.com/i/cortex',
    steps: [
      'Go to feedly.com/i/cortex',
      'Generate a Developer Token',
      'Add to .env.local:',
      'FEEDLY_ACCESS_TOKEN=your_token',
    ],
  },
  'X (Twitter)': {
    url: 'https://developer.twitter.com',
    steps: [
      'Go to developer.twitter.com',
      'Create an app, get a Bearer Token',
      'Add to .env.local:',
      'X_BEARER_TOKEN=your_token',
      'X_USER_ID=your_numeric_id',
    ],
  },
  'Pinterest': {
    url: 'https://developers.pinterest.com',
    steps: [
      'Go to developers.pinterest.com',
      'Create an app, get an access token',
      'Add to .env.local:',
      'PINTEREST_ACCESS_TOKEN=your_token',
    ],
  },
};

export default function SyncPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    const res = await fetch('/api/sync');
    const data = await res.json();
    setConnectors(data.connectors || []);
  }

  async function runSync(connectorName?: string) {
    setSyncing(connectorName || 'all');
    setResults([]);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectorName ? { connector: connectorName } : {}),
      });
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setSyncing(null);
    }
  }

  const enabled = connectors.filter(c => c.enabled);
  const disabled = connectors.filter(c => !c.enabled);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Sync</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {enabled.length} connector{enabled.length !== 1 ? 's' : ''} active
          </p>
        </div>
        {enabled.length > 0 && (
          <button
            onClick={() => runSync()}
            disabled={!!syncing}
            className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {syncing === 'all' ? 'Syncing…' : 'Sync All'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

        {/* Sync results */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map(r => (
              <div
                key={r.connector}
                className="p-3 rounded-xl border text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <p className="font-medium" style={{ color: 'var(--text)' }}>{r.connector}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {r.imported} imported · {r.skipped} already saved
                </p>
                {r.errors.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{r.errors[0]}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Active connectors */}
        {enabled.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Active
            </p>
            <div className="space-y-2">
              {enabled.map(c => (
                <div
                  key={c.name}
                  className="flex items-center justify-between p-4 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                  </div>
                  <button
                    onClick={() => runSync(c.name)}
                    disabled={!!syncing}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    {syncing === c.name ? 'Syncing…' : 'Sync'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available connectors (not yet configured) */}
        {disabled.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Available — not yet configured
            </p>
            <div className="space-y-2">
              {disabled.map(c => {
                const setup = SETUP_INSTRUCTIONS[c.name];
                const isOpen = expanded === c.name;
                return (
                  <div
                    key={c.name}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                  >
                    <button
                      className="w-full flex items-center justify-between p-4 text-left"
                      onClick={() => setExpanded(isOpen ? null : c.name)}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {isOpen ? '▲' : '▼'} Setup
                      </span>
                    </button>

                    {isOpen && setup && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="mt-3 space-y-1">
                          {setup.steps.map((step, i) => (
                            <p key={i} className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                              {step}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                          Then restart Alfred and come back here.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {connectors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading connectors…</p>
          </div>
        )}
      </div>
    </div>
  );
}
