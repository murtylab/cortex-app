import React, { useMemo } from 'react';
import BoxPlot from './boxplot.jsx';
import { buildComparisonData } from './comparePredictionData';
import { MODEL_OPTIONS } from '../constants';
import { Download } from 'lucide-react';
import CanvasEditor from './canvas/CanvasEditor.jsx';

export default function ComparePredictionResults({ entries, selectedIds, onSelectionChange, canvasCards, onCanvasChange, canvasWorkspace, onClose }) {
  const selectedEntries = entries.filter((entry) => selectedIds.includes(entry.id));
  const chartData = useMemo(() => buildComparisonData(selectedEntries, entries), [entries, selectedIds]);
  const downloadComparison = () => {
    const data = selectedEntries.map((entry) => ({
      historyNumber: entries.findIndex((item) => item.id === entry.id) + 1,
      label: entry.label, createdAt: entry.createdAt, settings: entry.settings, result: entry.result,
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compare-prediction-results.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="lab-results-panel" aria-label="Compare prediction results" style={{ marginTop: 8 }}>
      <div className="lab-section-header" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <h3 className="lab-heading" style={{ margin: 0 }}>Compare Prediction results</h3>
        <button type="button" className="lab-download-data" onClick={downloadComparison} disabled={selectedEntries.length < 2}>
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          Download data
        </button>
        <button type="button" className="lab-choice-btn" onClick={onClose} style={{ marginLeft: 'auto', padding: '6px 10px' }}>Close compare</button>
      </div>
      <nav className="lab-results-overview" aria-label="Comparison sections">
        <a href="#lab-compare-overall">
          <span className="lab-results-overview-mark" aria-hidden="true" />
          <span className="lab-results-overview-copy">
            <span className="lab-results-overview-title"><span className="lab-results-overview-index">01</span>Overall compare</span>
            <span className="lab-results-overview-detail">Compare saved prediction results</span>
          </span>
        </a>
        <a href="#lab-compare-canvas">
          <span className="lab-results-overview-mark" aria-hidden="true" />
          <span className="lab-results-overview-copy">
            <span className="lab-results-overview-title"><span className="lab-results-overview-index">02</span>Customize canvas</span>
            <span className="lab-results-overview-detail">Combine and arrange your charts</span>
          </span>
        </a>
      </nav>
      <div className="lab-section-header" id="lab-compare-overall" style={{ marginTop: 36 }}>
        <span className="lab-eyebrow">Overall comparison</span>
        <h3 className="lab-heading">Compare saved prediction results</h3>
      </div>
      <p className="lab-subheading">Select inference history</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 8, marginBottom: 16 }}>
        {[...entries].reverse().map((entry) => {
          const selected = selectedIds.includes(entry.id);
          const modelLabel = MODEL_OPTIONS.find((option) => option.value === entry.settings.model)?.label || entry.settings.model;
          return (
            <label key={entry.id} className={`lab-choice-btn${selected ? ' is-selected' : ''}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, textAlign: 'left', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected} onChange={() => onSelectionChange(selected ? selectedIds.filter((id) => id !== entry.id) : [...selectedIds, entry.id])} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, lineHeight: 1.5 }}>
                <strong>#{entries.findIndex((item) => item.id === entry.id) + 1} · {entry.label}</strong>
                <span>Mapping dataset: {entry.settings.dataset}</span>
                <span>Model: {modelLabel}</span>
                <span>Voxels: {entry.settings.voxelOption}{entry.settings.voxelNumber ? ` · ${entry.settings.voxelNumber}` : ''}</span>
                <span style={{ color: 'var(--lab-muted)' }}>{entry.files.length} images · {new Date(entry.createdAt).toLocaleTimeString()}</span>
              </span>
            </label>
          );
        })}
      </div>
      {selectedEntries.length < 2 ? (
        <p role="status" style={{ fontSize: 13, color: 'var(--lab-muted)' }}>Select at least two inference results to compare.</p>
      ) : (
        <BoxPlot {...chartData} sharedScale height={560} labChart />
      )}
      <div className="lab-section-header" id="lab-compare-canvas" style={{ marginTop: 36 }}>
        <span className="lab-eyebrow">Customize canvas</span>
        <h3 className="lab-heading">Combine and arrange your charts</h3>
      </div>
      <CanvasEditor entries={entries} cards={canvasCards} onChange={onCanvasChange} workspace={canvasWorkspace} />
    </section>
  );
}
