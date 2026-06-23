'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import clsx from 'clsx';

const NAV = [
  { href: '/chat', label: 'Alfred', icon: '◆' },
  { href: '/knowledge', label: 'Knowledge', icon: '◈' },
  { href: '/projects', label: 'Projects', icon: '◉' },
  { href: '/ideas', label: 'Ideas', icon: '◇' },
  { href: '/collections', label: 'Collections', icon: '◫' },
  { href: '/sync', label: 'Sync', icon: '⟳' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setUnread(d.unreadCount || 0))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(d => setUnread(d.unreadCount || 0))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const themes: Array<{ value: 'light' | 'dark' | 'sunny'; label: string }> = [
    { value: 'light', label: '☀' },
    { value: 'dark', label: '◗' },
    { value: 'sunny', label: '☕' },
  ];

  return (
    <nav
      className="w-56 flex-shrink-0 flex flex-col border-r h-full"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      {/* Wordmark */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
            Valet
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Chief of Staff
        </p>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-2 space-y-0.5">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'font-medium'
                : 'opacity-70 hover:opacity-100'
            )}
            style={
              pathname.startsWith(item.href)
                ? { backgroundColor: 'var(--border)', color: 'var(--text)' }
                : { color: 'var(--text)' }
            }
          >
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Notification indicator */}
      {unread > 0 && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
          <span style={{ color: 'var(--accent)' }}>●</span>
          {' '}Alfred has {unread} item{unread !== 1 ? 's' : ''} worth your attention.
        </div>
      )}

      {/* Theme switcher */}
      <div className="px-4 pb-5 pt-2 flex items-center gap-2">
        <span className="text-xs mr-1" style={{ color: 'var(--text-secondary)' }}>Theme</span>
        {themes.map(t => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={clsx(
              'w-6 h-6 rounded text-xs transition-all',
              theme === t.value ? 'ring-1 ring-offset-1' : 'opacity-50 hover:opacity-80'
            )}
            style={{ color: theme === t.value ? 'var(--text)' : 'var(--text-secondary)' }}
            title={t.value}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
