import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildUploadBrainData, getBrainImageLabels, getVoxelWinner } from '../services/uploadBrainData.js';
import { displayResponseExtent } from '../services/uploadBrainProjection.js';
import { brainImageNeighbors, brainTooltipPosition, filterBrainImages } from '../services/uploadBrainInterface.js';
import './uploadBrainMap.css';

const UploadBrainViewer = lazy(() => import('../components/UploadBrainViewer.jsx'));
const format = (value) => Number.isFinite(value) ? value.toFixed(3) : '—';
const ROI_NAMES = {
  eba: 'Extrastriate Body Area', fba: 'Fusiform Body Area', ffa: 'Fusiform Face Area',
  ofa: 'Occipital Face Area', opa: 'Occipital Place Area', ppa: 'Parahippocampal Place Area',
  rsc: 'Retrosplenial Cortex', vwfa: 'Visual Word Form Area',
};
const VIEWS = { overview: 'Overview', ventral: 'Ventral', dorsal: 'Dorsal', lateral: 'Right side', medial: 'Left side' };

function VoxelPreview({ hovered, selected, winner, data, imageLabels, stimulusSetLabel, onSelect, onDismiss }) {
  const tooltipRef = useRef(null);
  const latestHover = useRef(hovered);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const coordinate = data.roi.volumeCoordinatesZyx[hovered.responseIndex];
  const updatePosition = useCallback(() => {
    const tooltip = tooltipRef.current;
    const stage = tooltip?.parentElement;
    if (!tooltip || !stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const next = brainTooltipPosition({
      canvasX: latestHover.current.canvasX, canvasY: latestHover.current.canvasY,
      stageWidth: stageBounds.width, stageHeight: stageBounds.height,
      tooltipWidth: bounds.width, tooltipHeight: bounds.height,
    });
    setPosition((current) => current.left === next.left && current.top === next.top ? current : next);
  }, []);

  useLayoutEffect(() => { latestHover.current = hovered; updatePosition(); }, [hovered, updatePosition]);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(tooltip);
    observer.observe(tooltip.parentElement);
    return () => observer.disconnect();
  }, [updatePosition]);

  return (
    <div ref={tooltipRef} className="upload-brain-tooltip" style={position} role="status" tabIndex={0}
      aria-label="Voxel response comparison and anatomical details"
      onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) onDismiss(); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) onDismiss(); }}>
      <div className="upload-brain-tooltip-heading">
        <strong>{data.region.toUpperCase()} · {hovered.hemisphere.toUpperCase()}</strong>
        <button type="button" aria-label="Dismiss voxel preview" onClick={onDismiss}>×</button>
      </div>
      <span className="upload-brain-tooltip-collection">Among {data.images.length} {stimulusSetLabel} · model units</span>
      <div className="upload-brain-hover-comparison">
        <div className="upload-brain-hover-image upload-brain-hover-selected" data-testid="upload-brain-selected">
          <strong className="upload-brain-context-label">Shown on brain</strong>
          <img src={selected.url} alt={imageLabels.get(selected.id)} width={64} height={64} decoding="async" />
          <strong>{imageLabels.get(selected.id)}</strong>
          <span>Voxel response: {format(selected.values[hovered.responseIndex])}</span>
        </div>
        <div className="upload-brain-hover-image" data-testid="upload-brain-winner" data-image-id={winner.image.id}>
          <strong className="upload-brain-context-label">Highest at this voxel</strong>
          <img src={winner.image.url} alt={imageLabels.get(winner.image.id)} width={64} height={64} decoding="async" />
          <strong>{imageLabels.get(winner.image.id)}</strong>
          <span>Predicted response: {format(winner.value)}</span>
        </div>
      </div>
      <span className="upload-brain-hover-context-note">{winner.image.id === selected.id ? 'Same image as brain map' : 'Comparison preview · brain unchanged'}</span>
      {winner.value < 0 && <span>All predictions here are negative; this is the least negative.</span>}
      {winner.image.id !== selected.id && <button type="button" className="upload-brain-show-image" onClick={() => onSelect(winner.image.id)}>View this image on the brain</button>}
      <div className="upload-brain-hover-geometry">
        <span>Selected image surface value: {format(hovered.surfaceValue)}</span>
        <span>ROI response index: {hovered.responseIndex}</span>
        <span>Volume voxel [z, y, x]: [{coordinate.join(', ')}]</span>
        {Number.isInteger(hovered.vertexIndex) && <span>Surface vertex: {hovered.vertexIndex.toLocaleString()}</span>}
      </div>
    </div>
  );
}

export default function UploadBrainMap({ predictionResult, files, displayFiles = files, dataset, region, model, stimulusSetLabel = 'Uploaded images' }) {
  const [mapping, setMapping] = useState(null);
  const [mappingError, setMappingError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [imageSearch, setImageSearch] = useState('');
  const [view, setView] = useState('overview');
  const [hemisphereMode, setHemisphereMode] = useState('both');
  const [resetKey, setResetKey] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 901px)').matches);
  // Keep an inspected voxel available while moving into its comparison card.
  const inspectVoxel = useCallback((datum) => { if (datum !== null) setHovered(datum); }, []);
  const dismissVoxel = useCallback(() => setHovered(null), []);
  const selectImage = useCallback((id) => { setSelectedId(id); setHovered(null); }, []);

  useEffect(() => {
    if (dataset !== 'nsd_1000' || !predictionResult) return undefined;
    const controller = new AbortController();
    setMappingError('');
    fetch('/assets/brainModel/subject1-prediction-mapping.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The brain mapping could not be loaded.');
        return response.json();
      })
      .then((loaded) => { if (!controller.signal.aborted) setMapping(loaded); })
      .catch((error) => { if (!controller.signal.aborted) setMappingError(error.message || 'The brain mapping could not be loaded.'); });
    return () => controller.abort();
  }, [dataset, predictionResult]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(min-width: 901px)');
    const update = () => setControlsOpen(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const data = useMemo(() => buildUploadBrainData({ predictionResult, files, dataset, region, model, mapping }),
    [predictionResult, files, dataset, region, model, mapping]);
  const imageLabels = useMemo(() => getBrainImageLabels(data.images, displayFiles), [data.images, displayFiles]);
  const filteredImages = useMemo(() => filterBrainImages(data.images, imageLabels, imageSearch), [data.images, imageLabels, imageSearch]);
  const selected = data.images.find((image) => image.id === selectedId) ?? data.images[0];
  const neighbors = brainImageNeighbors(filteredImages, selected?.id);
  const selectedFilteredId = filteredImages.some((image) => image.id === selected?.id) ? selected.id : '';
  const winner = data.status === 'ready' && hovered ? getVoxelWinner(data.images, hovered.responseIndex) : null;
  const extent = data.status === 'ready' ? displayResponseExtent(data.range) : 1;

  useEffect(() => { setHovered(null); }, [selected?.id, predictionResult, region, dataset, model]);
  useEffect(() => { setImageSearch(''); }, [predictionResult, region, dataset, model]);

  let notice = '';
  if (dataset !== 'nsd_1000') notice = 'Choose NSD-1000 mapping and run inference to view NSD Subject 1 predictions on this brain.';
  else if (!predictionResult) notice = 'Run inference to view the brain response.';
  else if (mappingError) notice = mappingError;
  else if (!mapping) notice = 'Loading brain mapping…';
  else if (data.status !== 'ready') notice = data.reason;

  return (
    <section className="upload-brain-map" aria-labelledby="upload-brain-heading" data-testid="upload-brain-map"
      onKeyDown={(event) => { if (event.key === 'Escape') setHovered(null); }}>
      <div className="upload-brain-card">
        <header className="upload-brain-header">
          <span className="upload-brain-eyebrow">Predicted responses · NSD Subject 1</span>
          <h3 id="upload-brain-heading">3D Brain Map</h3>
          <p>{model} · {region.toUpperCase()}</p>
        </header>
        {notice ? <p className="upload-brain-notice" role="status">{notice}</p> : selected && <>
          <div className="upload-brain-stimulus-bar" aria-label="Brain-map image selection">
            <div className="upload-brain-picker">
              <div className="upload-brain-picker-row">
                <div className="upload-brain-collection"><span>Image collection</span><strong>{stimulusSetLabel} ({data.images.length})</strong></div>
                <label className="upload-brain-search"><span className="upload-brain-sr-only">Search brain-map images</span>
                  <input type="search" placeholder="Search images…" value={imageSearch} onChange={(event) => setImageSearch(event.target.value)} /></label>
              </div>
              <div className="upload-brain-picker-row">
                <label className="upload-brain-image-select"><span className="upload-brain-sr-only">Image coloring the brain</span>
                  <select aria-label="Image coloring the brain" value={selectedFilteredId} disabled={!filteredImages.length} onChange={(event) => selectImage(event.target.value)}>
                    <option value="" disabled>{filteredImages.length ? 'Select an image…' : 'No matching images'}</option>
                    {filteredImages.map((image) => <option key={image.id} value={image.id}>{imageLabels.get(image.id)}</option>)}
                  </select></label>
                <div className="upload-brain-image-navigation">
                  <button type="button" aria-label="Previous brain-map image" disabled={!neighbors.previous} onClick={() => { if (neighbors.previous) selectImage(neighbors.previous.id); }}>←</button>
                  <button type="button" aria-label="Next brain-map image" disabled={!neighbors.next} onClick={() => { if (neighbors.next) selectImage(neighbors.next.id); }}>→</button>
                </div>
                <span className="upload-brain-image-count" role="status">{imageSearch.trim() ? filteredImages.length + ' found' : data.images.length + ' images'}</span>
              </div>
            </div>
            <div className="upload-brain-current-image" data-testid="upload-brain-current" aria-live="polite">
              <img src={selected.url} alt={imageLabels.get(selected.id)} width={64} height={64} />
              <div><span className="upload-brain-context-label">Shown on brain</span><strong>{imageLabels.get(selected.id)}</strong><span>{stimulusSetLabel}</span></div>
            </div>
          </div>

          <div className="upload-brain-layout">
            <aside className="upload-brain-controls" aria-label="Brain map controls">
              <details open={controlsOpen} onToggle={(event) => setControlsOpen(event.currentTarget.open)}>
                <summary>Display controls</summary>
                <div className="upload-brain-control-fields">
                  <fieldset><legend>Cortical surface</legend><span>Inflated · NSD Subject 1</span></fieldset>
                  <fieldset><legend>Brain region</legend><strong>{region.toUpperCase()}</strong><span>{ROI_NAMES[data.region]}</span><small>Selected in the inference settings</small></fieldset>
                  <fieldset><legend>View</legend>
                    <label><span className="upload-brain-sr-only">Brain view</span><select aria-label="Brain view" value={view} onChange={(event) => { setView(event.target.value); setHovered(null); }}>{Object.entries(VIEWS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label><span className="upload-brain-sr-only">Visible hemispheres</span><select aria-label="Visible hemispheres" value={hemisphereMode} onChange={(event) => { setHemisphereMode(event.target.value); setHovered(null); }}><option value="both">Both hemispheres</option><option value="lh">Left hemisphere</option><option value="rh">Right hemisphere</option></select></label>
                  </fieldset>
                  <div className="upload-brain-scale" aria-label={'Fixed predicted response scale from minus ' + format(extent) + ' to plus ' + format(extent)}>
                    <div className="upload-brain-scale-heading"><strong>Selected image response</strong><span>model units · fixed scale</span></div>
                    <div className="upload-brain-scale-gradient" aria-hidden="true" />
                    <div className="upload-brain-scale-labels"><span>−{format(extent)}</span><span>0</span><span>+{format(extent)}</span></div>
                  </div>
                  <button type="button" className="upload-brain-reset" onClick={() => { setResetKey((key) => key + 1); setHovered(null); }}>Reset 3D view</button>
                  <p className="upload-brain-coverage">{data.roi.mappedResponseCount} / {data.roi.responseCount} responses mapped{data.roi.unmappedResponseIndices.length > 0 ? ' · ' + data.roi.unmappedResponseIndices.length + ' unmapped' : ''}</p>
                </div>
              </details>
            </aside>
            <div className="upload-brain-stage-column">
              <div className="upload-brain-stage" data-image-id={selected.id}>
                <Suspense fallback={<div className="upload-brain-loading" role="status">Loading 3D view…</div>}>
                  <UploadBrainViewer mapping={mapping} roi={data.roi} values={selected.values} range={data.range} view={view} hemisphereMode={hemisphereMode} resetKey={resetKey} onVoxelHover={inspectVoxel} onViewInteraction={dismissVoxel} />
                </Suspense>
                {hovered && winner && <VoxelPreview hovered={hovered} selected={selected} winner={winner} data={data} imageLabels={imageLabels} stimulusSetLabel={stimulusSetLabel} onSelect={selectImage} onDismiss={dismissVoxel} />}
              </div>
              <div className="upload-brain-stage-footer">
                <div><strong>Hover previews do not change the brain.</strong><span>Colors show the selected image · hover compares images at a voxel</span></div>
                <div><span>Drag to rotate · scroll to zoom</span><span>Keyboard: arrow keys rotate · +/− zoom</span></div>
              </div>
            </div>
          </div>
          <footer className="upload-brain-science-note">
            <p>Model predictions, not measured BOLD.</p>
            <details className="upload-brain-method"><summary>Mapping details</summary>
              <p>Only the selected region’s Subject 1 responses are shown; the readout may be trained jointly across NSD subjects. Surface colors interpolate nearby voxels. Hover ranks raw predictions at the dominant source voxel within this image set; search only filters the image picker.</p>
              <p>The region uses the training selection (fLoc t &gt; 7). Volume coordinates are zero-based. Gray cortex has no predictions in this view; voxels without verified surface support are not plotted.</p>
            </details>
          </footer>
        </>}
      </div>
    </section>
  );
}
