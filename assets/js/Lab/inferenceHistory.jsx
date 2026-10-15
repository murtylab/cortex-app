import React from 'react';

export default function InferenceHistory({ entries, activeId, onSelect }) {
  if (!entries.length) return null;

  return (
    <section aria-label="Inference history" style={{ marginTop: 12 }}>
      <p className="lab-section-label">Inference History</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {[...entries].reverse().map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`lab-choice-btn${activeId === entry.id ? ' is-selected' : ''}`}
            aria-pressed={activeId === entry.id}
            onClick={() => onSelect(entry)}
            style={{ textAlign: 'left', padding: '8px 10px' }}
          >
            <span style={{ display: 'block' }}>{entry.label}</span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: 'var(--lab-muted)' }}>
              {entry.settings.model} · {entry.settings.dataset} · {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
