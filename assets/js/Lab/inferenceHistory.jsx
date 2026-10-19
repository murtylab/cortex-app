import React, { useState } from 'react';

export default function InferenceHistory({ entries, activeId, onSelect, onCompare, hasCompareSheet = false, isCompareOpen = false, compareCount = 0 }) {
  const [showCompareHint, setShowCompareHint] = useState(false);
  if (!entries.length) return null;

  return (
    <section aria-label="Inference history" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className="lab-section-label" style={{ margin: 0 }}>Inference History</p>
        <button
          type="button"
          className="lab-choice-btn"
          onClick={() => {
            setShowCompareHint(entries.length < 2);
            if (entries.length >= 2) onCompare?.();
          }}
          title={entries.length < 2 ? 'Run at least two inferences to compare' : 'Compare inference history'}
          style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
        >
          Compare
        </button>
      </div>
      {showCompareHint && entries.length < 2 && (
        <p role="status" style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--lab-muted)' }}>
          At least two inference results are required to compare.
        </p>
      )}
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
      {hasCompareSheet && (
        <button
          type="button"
          className={`lab-choice-btn${isCompareOpen ? ' is-selected' : ''}`}
          onClick={onCompare}
          aria-pressed={isCompareOpen}
          style={{ display: 'block', width: '100%', marginTop: 8, padding: '10px', textAlign: 'left' }}
        >
          <span style={{ display: 'block' }}>Compare Prediction results</span>
          <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: 'var(--lab-muted)' }}>{compareCount} histories selected · Open sheet →</span>
        </button>
      )}
    </section>
  );
}
