import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, Move, Maximize2, Undo2, Redo2, Layers, Plus, Eye, MousePointer2, Save, ExternalLink, Download } from 'lucide-react';
import CanvasChart from './CanvasChart.jsx';
import StimuliPanel from './StimuliPanel.jsx';
import { exportCanvas } from './canvasExport';
import { paletteNames } from '../chartPalettes';
import { CANVAS_WIDTH, canvasRect, constrainRect, transformRect } from './canvasGeometry';
import './CanvasEditor.css';

const chartNames = { bar: 'Bar chart', box: 'Boxplot', rdm: 'RDM' };

export default function CanvasEditor({ entries, cards, onChange, workspace }) {
  const [historyId, setHistoryId] = useState('');
  const [chartType, setChartType] = useState('rdm');
  const [selectedId, setSelectedId] = useState(cards.at(-1)?.id || null);
  const [preview, setPreview] = useState(false);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState('fit');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [gesture, setGesture] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [exportFormat, setExportFormat] = useState('png');
  const [transparentExport, setTransparentExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const stageRef = useRef(null);
  const viewportRef = useRef(null);
  const interactionRef = useRef(null);
  const selectedEntry = entries.find((entry) => String(entry.id) === historyId) || entries.at(-1);
  const normalizedCards = useMemo(() => cards.map((card, index) => ({ ...card, ...canvasRect(card, index) })), [cards]);
  const selectedCard = normalizedCards.find((card) => card.id === selectedId);
  const scale = zoom === 'fit' ? Math.max(0.1, Math.min(1, (viewportWidth - 48) / CANVAS_WIDTH)) : Number(zoom);
  const renderedCards = normalizedCards.map((card) => gesture?.id === card.id ? { ...card, ...gesture.rect } : card);
  const canvasHeight = Math.max(800, ...renderedCards.map((card) => card.y + card.h + 32));
  const historyKey = entries.map((entry) => entry.id).join(',');
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setUndoStack([]); setRedoStack([]); }, [historyKey]);
  const commit = (next) => { setUndoStack((previous) => [...previous.slice(-29), cards]); setRedoStack([]); onChange(next); };
  const updateCard = (id, patch) => commit(normalizedCards.map((card) => card.id === id ? { ...card, ...patch } : card));
  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack((previous) => [...previous, cards]); onChange(undoStack.at(-1)); setUndoStack((previous) => previous.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack((previous) => [...previous, cards]); onChange(redoStack.at(-1)); setRedoStack((previous) => previous.slice(0, -1));
  };
  const addChart = () => {
    if (!selectedEntry) return;
    const id = crypto.randomUUID(), index = cards.length;
    commit([...normalizedCards, { id, historyId: selectedEntry.id, type: chartType, order: 'group', x: 24 + index % 2 * 576, y: 24 + Math.floor(index / 2) * 480, w: 552, h: 440, palette: 'default', showTitle: true, showLegend: true, showLabels: true }]);
    setSelectedId(id); setPreview(false);
  };
  const removeSelected = () => { commit(normalizedCards.filter((card) => card.id !== selectedId)); setSelectedId(null); };
  const duplicateSelected = () => {
    if (!selectedCard) return;
    const id = crypto.randomUUID();
    commit([...normalizedCards, { ...selectedCard, id, ...constrainRect({ ...selectedCard, x: selectedCard.x + 24, y: selectedCard.y + 24 }) }]); setSelectedId(id);
  };
  const startGesture = (event, card, action) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(card.id);
    interactionRef.current = { id: card.id, rect: canvasRect(card), startX: event.clientX, startY: event.clientY, action, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const gestureRect = (event, active) => transformRect(active.rect, (event.clientX - active.startX) / scale, (event.clientY - active.startY) / scale, active.action, snap);
  const moveGesture = (event) => {
    const active = interactionRef.current;
    if (active && event.pointerId === active.pointerId) setGesture({ id: active.id, rect: gestureRect(event, active) });
  };
  const finishGesture = (event) => {
    const active = interactionRef.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const rect = gestureRect(event, active);
    interactionRef.current = null; setGesture(null);
    if (JSON.stringify(rect) !== JSON.stringify(active.rect)) updateCard(active.id, rect);
  };
  const changeGeometry = (field, value) => {
    if (selectedCard && Number.isFinite(value)) updateCard(selectedCard.id, constrainRect({ ...canvasRect(selectedCard), [field]: value }));
  };
  return (
    <div className={`lab-canvas-editor${preview ? ' is-preview' : ''}`} onKeyDown={(event) => {
      if (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    }}>
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-brand"><Layers size={16} /> Canvas editor</div>
        <button type="button" title="Undo" aria-label="Undo canvas change" disabled={!undoStack.length} onClick={undo}><Undo2 size={15} /></button>
        <button type="button" title="Redo" aria-label="Redo canvas change" disabled={!redoStack.length} onClick={redo}><Redo2 size={15} /></button>
        <span className="canvas-toolbar-divider" />
        <label className="canvas-toolbar-label">History<select aria-label="History for new chart" value={selectedEntry?.id || ''} onChange={(event) => setHistoryId(event.target.value)}>
          {entries.map((entry, index) => <option key={entry.id} value={entry.id}>#{index + 1} · {entry.label} · {entry.settings.model}</option>)}
        </select></label>
        <select aria-label="New chart type" value={chartType} onChange={(event) => setChartType(event.target.value)}>{Object.entries(chartNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
        <button type="button" onClick={addChart} disabled={!selectedEntry}><Plus size={15} /> Add chart</button>
        {workspace && <>
          <button type="button" disabled={workspace.busy} onClick={workspace.save}><Save size={15} /> {workspace.busy ? 'Saving…' : 'Save canvas'}</button>
          {!workspace.standalone && <a className="canvas-open-link" href={workspace.openUrl} target="_blank" rel="noopener noreferrer" aria-disabled={workspace.busy} onClick={workspace.openInNewPage}><ExternalLink size={15} /> Open in new page</a>}
          {workspace.hasRemote && <button type="button" onClick={workspace.loadSaved}>Load saved</button>}
        </>}
        <select aria-label="Canvas export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}><option value="png">PNG · 2×</option><option value="svg">SVG · vector</option></select>
        <label className="canvas-toolbar-label"><input type="checkbox" checked={transparentExport} onChange={(event) => setTransparentExport(event.target.checked)} /> Transparent background</label>
        <button type="button" disabled={!cards.length || exporting || !!gesture} onClick={async () => {
          setExporting(true); setExportStatus('Exporting…');
          try { await exportCanvas(stageRef.current, exportFormat, canvasHeight, { transparentBackground: transparentExport }); setExportStatus('Canvas exported'); }
          catch (error) { setExportStatus(error?.message || 'Could not export canvas.'); }
          finally { setExporting(false); }
        }}><Download size={15} /> {exporting ? 'Exporting…' : 'Export canvas'}</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)} style={{ marginLeft: 'auto' }}><Eye size={15} /> {preview ? 'Edit' : 'Preview'}</button>
      </div>
      <div className="canvas-editor-body">
        <div className="canvas-workspace">
          <div className="canvas-viewbar"><span>{preview ? 'Preview' : 'Drag to move · corner handle to resize'}</span><label><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} /> Snap</label><select aria-label="Canvas zoom" value={zoom} onChange={(event) => setZoom(event.target.value)}><option value="fit">Fit</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></div>
          <div className="canvas-viewport" ref={viewportRef} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={() => { interactionRef.current = null; setGesture(null); }}>
            <div className="canvas-stage-space" style={{ width: CANVAS_WIDTH * scale, height: canvasHeight * scale, margin: '24px auto' }}>
              <div className="canvas-stage" ref={stageRef} style={{ width: CANVAS_WIDTH, height: canvasHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }} onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
                {!cards.length && <div className="canvas-blank"><Layers size={36} strokeWidth={1} /><h4>Your canvas, your layout</h4><p>Add a chart above. Place two RDMs side by side, resize each, and keep just the titles and scales you need.</p></div>}
                {renderedCards.map((card, index) => {
                  const entry = entries.find((item) => item.id === card.historyId);
                  if (!entry) return null;
                  const selected = selectedId === card.id && !preview;
                  return (
                    <article key={card.id} tabIndex={preview ? -1 : 0} aria-label={`${chartNames[card.type]} from history ${entries.indexOf(entry) + 1}`} className={`canvas-chart-object${selected ? ' is-selected' : ''}`} style={{ left: card.x, top: card.y, width: card.w, height: card.h, zIndex: index + 1, background: card.background || '#ffffff' }} onPointerDownCapture={() => { if (!preview) setSelectedId(card.id); }} onKeyDown={(event) => {
                      if (preview || event.target !== event.currentTarget) return;
                      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); commit(normalizedCards.filter((item) => item.id !== card.id)); }
                      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                      if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; updateCard(card.id, transformRect(card, x * (event.shiftKey ? 10 : 1), y * (event.shiftKey ? 10 : 1), 'move')); }
                    }}>
                      {card.showTitle !== false && <div className="canvas-chart-title" onPointerDown={preview ? undefined : (event) => startGesture(event, card, 'move')}>{card.title || `#${entries.indexOf(entry) + 1} · ${entry.label} · ${entry.settings.dataset} · ${entry.settings.model}`}</div>}
                      <div className="canvas-chart-content"><CanvasChart entry={entry} card={card} /></div>
                      {!preview && <button type="button" className="canvas-move-handle" aria-label="Drag chart to move" onPointerDown={(event) => startGesture(event, card, 'move')}><Move size={15} /> {selected ? chartNames[card.type] : 'Move'}</button>}
                      {selected && <><button type="button" className="canvas-object-delete" aria-label="Delete selected chart" onClick={removeSelected}><Trash2 size={14} /></button><button type="button" className="canvas-resize-handle" aria-label="Drag to resize chart" onPointerDown={(event) => startGesture(event, card, 'resize')}><Maximize2 size={12} /></button></>}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {!preview && <aside className="canvas-inspector" aria-label="Chart properties">
          <div className="canvas-inspector-heading"><MousePointer2 size={14} /> Chart properties</div>
          {!selectedCard ? <p className="canvas-inspector-hint">Select a chart to edit its size, colors, title and scale.</p> : <>
            <label>Chart type<select value={selectedCard.type} onChange={(event) => updateCard(selectedId, { type: event.target.value })}>{Object.entries(chartNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <label>History<select value={selectedCard.historyId} onChange={(event) => updateCard(selectedId, { historyId: Number(event.target.value), groupFilter: undefined, excludedFilenames: [], highlightedFilenames: [] })}>{entries.map((entry, index) => <option key={entry.id} value={entry.id}>#{index + 1} · {entry.label}</option>)}</select></label>
            <div className="canvas-geometry-fields">{['x', 'y', 'w', 'h'].map((field) => <label key={field}>{({ x: 'X', y: 'Y', w: 'Width', h: 'Height' })[field]}<input type="number" step={8} value={Math.round(selectedCard[field])} onChange={(event) => changeGeometry(field, event.target.valueAsNumber)} /></label>)}</div>
            <label>Palette<select value={selectedCard.palette || 'default'} onChange={(event) => updateCard(selectedId, { palette: event.target.value })}>{Object.entries(paletteNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            {selectedCard.palette === 'custom' && <div className="canvas-geometry-fields"><label>Low value<input type="color" value={selectedCard.colorLow || '#253494'} onChange={(event) => updateCard(selectedId, { colorLow: event.target.value })} /></label><label>High value<input type="color" value={selectedCard.colorHigh || '#fdbb84'} onChange={(event) => updateCard(selectedId, { colorHigh: event.target.value })} /></label></div>}
            <label className="canvas-check"><input type="checkbox" checked={selectedCard.background === 'transparent'} onChange={(event) => updateCard(selectedId, { background: event.target.checked ? 'transparent' : '#ffffff' })} /> Transparent chart background</label>
            {selectedCard.background !== 'transparent' && <label>Background<input type="color" value={selectedCard.background || '#ffffff'} onChange={(event) => updateCard(selectedId, { background: event.target.value })} /></label>}
            <label className="canvas-check"><input type="checkbox" checked={selectedCard.showTitle !== false} onChange={(event) => updateCard(selectedId, { showTitle: event.target.checked })} /> Show title</label>
            {selectedCard.showTitle !== false && <label>Title<input type="text" placeholder="Automatic history title" value={selectedCard.title || ''} onChange={(event) => updateCard(selectedId, { title: event.target.value })} /></label>}
            {selectedCard.type === 'rdm' && <label className="canvas-check"><input type="checkbox" checked={selectedCard.showLegend !== false} onChange={(event) => updateCard(selectedId, { showLegend: event.target.checked })} /> Show color scale</label>}
            {selectedCard.type === 'rdm' && <>
              <div className="canvas-geometry-fields">{['colorMin', 'colorMax'].map((field) => <label key={field}>{field === 'colorMin' ? 'Scale minimum' : 'Scale maximum'}<input type="number" step="any" placeholder="Auto" value={selectedCard[field] ?? ''} onChange={(event) => updateCard(selectedId, { [field]: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : undefined })} /></label>)}</div>
              {Number.isFinite(selectedCard.colorMin) && Number.isFinite(selectedCard.colorMax) && selectedCard.colorMin >= selectedCard.colorMax && <p role="status" className="canvas-inspector-hint">Minimum must be smaller than maximum. Using automatic range.</p>}
            </>}
            <label className="canvas-check"><input type="checkbox" checked={selectedCard.showLabels !== false} onChange={(event) => updateCard(selectedId, { showLabels: event.target.checked })} /> Show group labels</label>
            {selectedCard.type !== 'box' && <label>Order<select value={selectedCard.order} onChange={(event) => updateCard(selectedId, { order: event.target.value })}><option value="group">Group</option><option value="ranking">Rank</option></select></label>}
            <StimuliPanel key={`${selectedCard.id}-${selectedCard.historyId}`} entry={entries.find((entry) => entry.id === selectedCard.historyId)} card={selectedCard} onChange={(patch) => updateCard(selectedId, patch)} />
            <div className="canvas-inspector-actions"><button type="button" onClick={duplicateSelected}><Copy size={14} /> Duplicate</button><button type="button" onClick={removeSelected}><Trash2 size={14} /> Delete</button></div>
            <div className="canvas-inspector-actions"><button type="button" onClick={() => commit([...normalizedCards.filter((card) => card.id !== selectedId), selectedCard])}>Bring to front</button><button type="button" onClick={() => commit([selectedCard, ...normalizedCards.filter((card) => card.id !== selectedId)])}>Send to back</button></div>
          </>}
        </aside>}
      </div>
      <div className="canvas-statusbar"><span>{cards.length} charts · 1200 × {Math.round(canvasHeight)} canvas</span><span role="status">{workspace ? workspace.status || (workspace.dirty ? 'Unsaved edits' : 'Saved locally') : 'Layout saved in this compare sheet'}</span>{workspace?.savedUrl && !workspace.standalone && <a href={workspace.savedUrl} target="_blank" rel="noopener noreferrer">Open saved canvas ↗</a>}</div>
      {exportStatus && <div className="canvas-statusbar" role="status">{exportStatus}</div>}
    </div>
  );
}
