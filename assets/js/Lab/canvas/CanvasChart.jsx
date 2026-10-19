import React, { memo, useMemo } from 'react';
import BarChart from '../barchart.jsx';
import Heatmap from '../heatmap.jsx';
import { buildCanvasChartData } from './canvasData';

export default memo(function CanvasChart({ entry, card }) {
  const { bars, heatmap, filenames, sortedFilenames, fileMappings, highlightedFilenames } = useMemo(() => buildCanvasChartData(entry, card), [entry, card]);
  const height = Math.max(140, card.h - (card.showTitle === false ? 16 : 56));
  const appearance = { palette: card.palette || 'default', colorLow: card.colorLow, colorHigh: card.colorHigh, showGroupLabels: card.showLabels !== false, highlightedFilenames, highlightColor: card.highlightColor || '#D46B24' };
  if (!filenames.length) return <p role="status" className="canvas-empty-chart">No stimuli match this chart’s filters. Restore groups or images in the Stimuli panel.</p>;
  if (card.type === 'rdm') return heatmap.length && filenames.length > 1
    ? <Heatmap heatmapData={heatmap} originalFilenames={filenames} sortedFilenames={sortedFilenames} width={card.w - 16} height={height} fileMappings={fileMappings} order={card.order} showLegend={card.showLegend !== false} colorMin={card.colorMin} colorMax={card.colorMax} canvasFit {...appearance} labChart />
    : <p role="status" className="canvas-empty-chart">RDM requires at least two visible stimuli and a saved RDM.</p>;
  return <BarChart barChartData={bars} fileMappings={fileMappings} height={height - 12} order={card.type === 'box' ? 'group' : card.order} fixedChartType={card.type} hideControls {...appearance} labChart />;
});
