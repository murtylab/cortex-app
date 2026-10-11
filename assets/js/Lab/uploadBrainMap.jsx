import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { buildUploadBrainData, getBrainImageLabels, getVoxelWinner } from '../services/uploadBrainData.js';
import { displayResponseExtent } from '../services/uploadBrainProjection.js';
import './uploadBrainMap.css';

const UploadBrainViewer = lazy(() => import('../components/UploadBrainViewer.jsx'));
const format = (value) => Number.isFinite(value) ? value.toFixed(3) : '—';

export default function UploadBrainMap({ predictionResult, files, displayFiles = files, dataset, region, model, stimulusSetLabel = 'Uploaded images' }) {
  const [mapping, setMapping] = useState(null);
  const [mappingError, setMappingError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  // Keep the inspected voxel available while moving from the canvas to its preview.
  const inspectVoxel = useCallback((datum) => {
    const index = datum?.responseIndex;
    if (Number.isInteger(index) && index >= 0) setHoverIndex(index);
  }, []);

  useEffect(() => {
    if (dataset !== 'nsd_1000' || !predictionResult) return;
    const controller = new AbortController();
    setMappingError('');
    fetch('/assets/brainModel/subject1-prediction-mapping.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The brain mapping could not be loaded.');
        return response.json();
      })
      .then((loaded) => { if (!controller.signal.aborted) setMapping(loaded); })
      .catch((error) => {
        if (!controller.signal.aborted) setMappingError(error.message || 'The brain mapping could not be loaded.');
      });
    return () => controller.abort();
  }, [dataset, predictionResult]);

  const data = useMemo(() => buildUploadBrainData({ predictionResult, files, dataset, region, model, mapping }),
    [predictionResult, files, dataset, region, model, mapping]);
  const imageLabels = useMemo(() => getBrainImageLabels(data.images, displayFiles), [data.images, displayFiles]);
  const selected = data.images?.find((image) => image.id === selectedId) ?? data.images?.[0];
  const winner = data.status === 'ready' && hoverIndex !== null ? getVoxelWinner(data.images, hoverIndex) : null;
  const coordinate = data.roi?.volumeCoordinatesZyx?.[hoverIndex];
  const extent = data.status === 'ready' ? displayResponseExtent(data.range) : 1;

  useEffect(() => { setHoverIndex(null); }, [selected?.id, predictionResult, region, dataset, model]);

  let notice = '';
  if (dataset !== 'nsd_1000') notice = 'Choose NSD-1000 mapping and run inference to view NSD Subject 1 predictions on this brain.';
  else if (!predictionResult) notice = 'Run inference to view the brain response.';
  else if (mappingError) notice = mappingError;
  else if (!mapping) notice = 'Loading brain mapping…';
  else if (data.status !== 'ready') notice = data.reason;

  return (
    <section className="upload-brain-map" aria-labelledby="upload-brain-heading" data-testid="upload-brain-map">
      <div className="lab-section-header">
        <span className="lab-eyebrow">Spatial analysis</span>
        <h3 className="lab-heading" id="upload-brain-heading">3D brain response</h3>
      </div>
      {notice ? <p className="upload-brain-notice" role="status">{notice}</p> : selected && (
        <div className="upload-brain-content">
          <div className="upload-brain-toolbar">
            <div>
              <strong>NSD Subject 1 · {region.toUpperCase()}</strong>
              <span>{data.images.length} {data.images.length === 1 ? 'image' : 'images'} · {stimulusSetLabel} · {model}</span>
            </div>
            <label>
              Image coloring the brain
              <select aria-label="Image coloring the brain" value={selected.id}
                onChange={(event) => { setSelectedId(event.target.value); setHoverIndex(null); }}>
                {data.images.map((image) => <option key={image.id} value={image.id}>{imageLabels.get(image.id)}</option>)}
              </select>
            </label>
          </div>
          <Suspense fallback={<div className="upload-brain-loading" role="status">Loading 3D view…</div>}>
            <UploadBrainViewer mapping={mapping} roi={data.roi} values={selected.values} range={data.range}
              onVoxelHover={inspectVoxel} />
          </Suspense>
          <div className="upload-brain-scale" aria-label="Predicted response color scale, fixed across this image set">
            <span>{format(-extent)}</span>
            <div><span>0</span></div>
            <span>{format(extent)}</span>
            <small>Predicted response · same scale for this image set</small>
          </div>
          <div className="upload-brain-previews">
            <div className="upload-brain-preview" data-testid="upload-brain-selected">
              <img src={selected.url} alt={imageLabels.get(selected.id)} />
              <div><strong>Coloring the brain</strong><span>{imageLabels.get(selected.id)}</span>
                {winner && <span>At this voxel: {format(selected.values[hoverIndex])}</span>}
              </div>
            </div>
            <div className="upload-brain-preview" data-testid="upload-brain-winner" aria-live="polite">
              {winner ? <>
                <img src={winner.image.url} alt={imageLabels.get(winner.image.id)} />
                <div><strong>Highest response at inspected voxel</strong><span>{imageLabels.get(winner.image.id)} · {format(winner.value)}</span>
                  <span>Last inspected: voxel {hoverIndex + 1} · {data.roi.hemispheres[hoverIndex]} · x {coordinate[2]}, y {coordinate[1]}, z {coordinate[0]}</span>
                  {winner.image.id !== selected.id && <button type="button" onClick={() => {
                    setSelectedId(winner.image.id); setHoverIndex(null);
                  }}>View this image on the brain</button>}
                </div>
              </> : <p>Hover over the colored region to preview its highest-response image in this set. The brain stays on your selected image.</p>}
            </div>
          </div>
          <details className="upload-brain-method"><summary>About this map</summary>
            <p>Model predictions, not measured activity. Only the selected region’s Subject 1 responses are shown;
              the readout may be trained jointly across NSD subjects. Surface colors interpolate nearby voxels;
              hover reports the dominant source voxel in native volume coordinates (zero-based).
              The highest-response image is chosen only from this image set.</p>
            <p>{data.roi.mappedResponseCount} of {data.roi.responseCount} voxels have surface support.
              {data.roi.unmappedResponseIndices.length > 0 && ' Voxels without verified surface support are not plotted.'}
              {' '}The region uses the training selection (fLoc t &gt; 7). Gray cortex is not predicted here.</p>
          </details>
        </div>
      )}
    </section>
  );
}
