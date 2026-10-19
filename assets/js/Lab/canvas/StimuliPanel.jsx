import React, { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { getCanvasStimuli } from './canvasData';

export default function StimuliPanel({ entry, card, onChange }) {
  const [search, setSearch] = useState('');
  const stimuli = useMemo(() => getCanvasStimuli(entry), [entry]);
  const groups = useMemo(() => [...new Set(stimuli.map((stimulus) => stimulus.groupKey))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [stimuli]);
  const activeGroups = card.groupFilter ?? groups;
  const excluded = card.excludedFilenames || [];
  const highlighted = card.highlightedFilenames || [];
  const matching = stimuli.filter((stimulus) => `${stimulus.label} ${stimulus.groupKey}`.toLowerCase().includes(search.toLowerCase()));
  const visible = stimuli.filter((stimulus) => activeGroups.includes(stimulus.groupKey) && !excluded.includes(stimulus.filename));
  const toggle = (values, value) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  return (
    <section className="canvas-stimuli-panel" aria-label="Chart stimuli">
      <div className="canvas-inspector-heading">Stimuli <span>{visible.length} / {stimuli.length}</span></div>
      <p className="canvas-inspector-hint">Edits apply to this chart only.</p>
      <details open>
        <summary>Filter by group</summary>
        <div className="canvas-stimuli-actions">
          <button type="button" onClick={() => onChange({ groupFilter: undefined })}>All groups</button>
          <button type="button" onClick={() => onChange({ groupFilter: [] })}>None</button>
        </div>
        {groups.map((group) => <div className="canvas-stimuli-group" key={group}>
          <label className="canvas-check"><input type="checkbox" checked={activeGroups.includes(group)} onChange={() => onChange({ groupFilter: toggle(activeGroups, group) })} /><span title={group}>{group}</span></label>
          <button type="button" title={`Show only ${group}`} onClick={() => onChange({ groupFilter: [group] })}>Only</button>
          <button type="button" title={`Highlight ${group}`} aria-label={`Highlight group ${group}`} onClick={() => onChange({ highlightedFilenames: [...new Set([...highlighted, ...stimuli.filter((stimulus) => stimulus.groupKey === group).map((stimulus) => stimulus.filename)])] })}><Star size={12} /></button>
        </div>)}
      </details>
      <details open>
        <summary>Images & highlights</summary>
        <label className="canvas-stimuli-search">Search stimuli<input type="search" value={search} placeholder="Image or group…" onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="canvas-stimuli-actions">
          <button type="button" onClick={() => onChange({ excludedFilenames: [] })}>Restore images</button>
          <button type="button" onClick={() => onChange({ highlightedFilenames: [] })}>Clear highlights</button>
        </div>
        <label>Highlight color<input type="color" value={card.highlightColor || '#D46B24'} onChange={(event) => onChange({ highlightColor: event.target.value })} /></label>
        <div className="canvas-stimuli-list">
          {matching.map((stimulus) => {
            const shown = !excluded.includes(stimulus.filename);
            const selected = highlighted.includes(stimulus.filename);
            return <div className={`canvas-stimulus-row${!shown || !activeGroups.includes(stimulus.groupKey) ? ' is-hidden' : ''}`} key={stimulus.filename}>
              <label className="canvas-check">
                <input type="checkbox" checked={shown} aria-label={`Include ${stimulus.label}`} onChange={() => onChange({ excludedFilenames: toggle(excluded, stimulus.filename) })} />
                {stimulus.blobURL && <img src={stimulus.blobURL} alt="" />}
                <span title={stimulus.label}>{stimulus.label}<small>{stimulus.groupKey}</small></span>
              </label>
              <button type="button" aria-pressed={selected} aria-label={`Highlight ${stimulus.label}`} title={selected ? 'Remove highlight' : 'Highlight stimulus'} onClick={() => onChange({ highlightedFilenames: toggle(highlighted, stimulus.filename) })}><Star size={13} fill={selected ? card.highlightColor || '#D46B24' : 'none'} /></button>
            </div>;
          })}
          {!matching.length && <p className="canvas-inspector-hint">No matching stimuli.</p>}
        </div>
      </details>
      <button type="button" onClick={() => onChange({ groupFilter: undefined, excludedFilenames: [], highlightedFilenames: [] })}>Reset stimuli edits</button>
    </section>
  );
}
