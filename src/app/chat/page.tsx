'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefing(null);
    try {
      const res = await fetch('/api/brief');
      const data = await res.json();
      setBriefing(data.brief || data.error || 'Unable to generate briefing.');
    } catch {
      setBriefing('Unable to connect to Alfred.');
    } finally {
      setBriefLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    if (!text) setInput('');

    const userMsg: Message = { role: 'user', content: msg, id: Date.now().toString() };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.conversationId && !conversationId) {
              setConversationId(data.conversationId);
            }
            if (data.text) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.text }
                    : m
                )
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Check that your API key is configured.' }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const STARTERS = [
    'What should I work on today?',
    'Brief me.',
    'What projects are stalled?',
    'What opportunities am I missing?',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Alfred</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Chief of Staff</p>
        </div>
        <button
          onClick={handleBrief}
          disabled={briefLoading}
          className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--border)',
            color: 'var(--text)',
          }}
        >
          {briefLoading ? 'Briefing…' : 'Brief Me'}
        </button>
      </div>

      {/* Briefing panel */}
      {briefing && (
        <div
          className="mx-6 mt-4 p-4 rounded-xl border text-sm prose-alfred"
          style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--surface)', color: 'var(--text)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--accent)' }}>
              Today's Briefing
            </span>
            <button
              onClick={() => setBriefing(null)}
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Dismiss
            </button>
          </div>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && !briefing && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-16">
            <div className="text-center">
              <p className="text-2xl font-light mb-1" style={{ color: 'var(--text)' }}>
                Good{getTimeOfDay()}, Josh.
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                What can I help you with?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left px-3 py-2.5 rounded-xl text-sm border transition-colors hover:opacity-80"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 mr-3 flex items-center justify-center text-xs"
                style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                ◆
              </div>
            )}
            <div
              className={clsx(
                'max-w-2xl text-sm',
                msg.role === 'user'
                  ? 'px-4 py-2.5 rounded-2xl rounded-tr-sm'
                  : 'prose-alfred'
              )}
              style={
                msg.role === 'user'
                  ? { backgroundColor: 'var(--accent)', color: '#fff' }
                  : { color: 'var(--text)' }
              }
            >
              {msg.role === 'user' ? (
                <span>{msg.content}</span>
              ) : msg.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                <span className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>
                  Thinking…
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="px-6 pb-6 pt-3 flex-shrink-0"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Alfred anything…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
            style={{
              color: 'var(--text)',
              maxHeight: '120px',
              minHeight: '24px',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            ↑
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          ⌘↵ to send
        </p>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return ' morning';
  if (h < 17) return ' afternoon';
  return ' evening';
}
