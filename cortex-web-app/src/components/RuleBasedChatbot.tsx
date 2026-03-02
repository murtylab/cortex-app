'use client';

import { useState, useRef, useEffect } from 'react';
import './RuleBasedChatbot.css';

const API_BASE = process.env.NEXT_PUBLIC_RULE_CHAT_API || 'http://localhost:8000';

type Message = { role: 'user' | 'assistant'; text: string };

export default function RuleBasedChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Ask me about model performance (best/worst for PPA, FFA, EBA), model info, or scores. Try: "Best model for FFA?" or "What is BLIP2?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rule-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = typeof data.reply === 'string' ? data.reply : 'Sorry, I couldn’t process that.';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: 'Rule chat is unavailable. Start the chat API (e.g. uvicorn main:app --reload in chat-api/) or check NEXT_PUBLIC_RULE_CHAT_API.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rule-chat-widget" aria-label="Rule-based performance chat">
      <div className={`rule-chat-panel ${open ? 'rule-chat-panel-open' : ''}`}>
        <header className="rule-chat-header">
          <span className="rule-chat-title">Performance Chat</span>
          <button
            type="button"
            className="rule-chat-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close chat' : 'Open chat'}
          >
            {open ? '−' : '＋'}
          </button>
        </header>
        {open && (
          <>
            <div className="rule-chat-messages" ref={listRef}>
              {messages.map((msg, i) => (
                <div key={i} className={`rule-chat-msg rule-chat-msg-${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              {loading && (
                <div className="rule-chat-msg rule-chat-msg-assistant rule-chat-loading">
                  …
                </div>
              )}
            </div>
            <div className="rule-chat-input-wrap">
              <input
                type="text"
                className="rule-chat-input"
                placeholder="Ask about models, PPA, FFA, EBA…”
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                disabled={loading}
              />
              <button type="button" className="rule-chat-send" onClick={send} disabled={loading}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
