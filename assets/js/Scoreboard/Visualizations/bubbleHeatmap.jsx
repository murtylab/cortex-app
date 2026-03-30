import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const COL_W    = 52;   // px per experiment column
const ROW_H    = 22;   // px per model row
const COL_GAP  = 4;
const ROW_GAP  = 2;
const MIN_R    = 3;
const MAX_R    = 11;
const LEFT_W   = 210;  // width reserved for Y-axis model names
const RIGHT_W  = 16;   // right padding

// YES = blue, NO = warm-red, tie = gray  (matches Python script)
const BASE_COLORS = {
  yes: [26,  77, 230],
  no:  [217, 26,  26],
  tie: [153, 153, 153],
};

function blendWithWhite([r, g, b], t) {
  // t=0 → white, t=1 → full color
  return `rgb(${Math.round((1-t)*255 + t*r)},${Math.round((1-t)*255 + t*g)},${Math.round((1-t)*255 + t*b)})`;
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function shortLabel(expKey) {
  // "berman_2017::main::PPA" → "berman_2017 PPA"
  const parts = expKey.split('::');
  const exp = parts[0] || expKey;
  const roi = parts[2] && parts[2] !== 'ROI' ? parts[2] : null;
  return roi ? `${exp} [${roi}]` : exp;
}

const BubbleHeatmap = ({ data, trainSource, region, modelType, allowedModelValues, rank, selectedExperiments, selectedModel, onModelClick }) => {
  const headerRef = useRef();
  const bodyRef   = useRef();
  const legendRef = useRef();

  useEffect(() => {
    if (!data || !trainSource) return;
    const src = data[trainSource];
    if (!src) return;

    const { models: allModels, experiments: allExperiments, cells, conf_min = 1, conf_max = 4 } = src;

    const isRanked = rank === 'rank';

    // --- filter models by modelType, then sort ---
    let models = (allowedModelValues && allowedModelValues.size > 0)
      ? allModels.filter(m => allowedModelValues.has(m))
      : [...allModels];
    if (!isRanked) models = [...models].sort((a, b) => a.localeCompare(b));

    // --- filter experiments by region/ROI and selectedExperiments, then sort ---
    const activeROIs = Array.isArray(region)
      ? region.filter(r => r !== 'Across Regions').map(r => r.toLowerCase())
      : [];
    const activeExpFilter = Array.isArray(selectedExperiments) && selectedExperiments.length > 0
      ? new Set(selectedExperiments)
      : null;

    let experiments = allExperiments.filter(ex => {
      if (activeROIs.length > 0) {
        const roiPart = (ex.split('::')[2] || '').toLowerCase();
        if (!activeROIs.includes(roiPart)) return false;
      }
      if (activeExpFilter && !activeExpFilter.has(ex)) return false;
      return true;
    });
    if (!isRanked) experiments = [...experiments].sort((a, b) => a.localeCompare(b));
    const confRange = conf_max - conf_min || 1;

    // --- clear ---
    d3.select(headerRef.current).selectAll('*').remove();
    d3.select(bodyRef.current).selectAll('*').remove();
    d3.select(legendRef.current).selectAll('*').remove();

    const nExp   = experiments.length;
    const nModel = models.length;
    const svgW   = LEFT_W + nExp * (COL_W + COL_GAP) + RIGHT_W;

    // ====== HEADER (experiment labels) ======
    const HEADER_H = 130;
    const svgH_header = HEADER_H;

    const svgHeader = d3.select(headerRef.current)
      .append('svg')
      .attr('width', svgW)
      .attr('height', svgH_header)
      .style('font-family', "'Inter', system-ui, sans-serif");

    experiments.forEach((ex, xi) => {
      const cx = LEFT_W + xi * (COL_W + COL_GAP) + COL_W / 2;
      svgHeader.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('transform', `translate(${cx}, ${HEADER_H - 8}) rotate(-55)`)
        .style('font-size', '10px')
        .style('fill', '#555')
        .style('text-anchor', 'end')
        .text(shortLabel(ex));
    });

    // light column dividers
    experiments.forEach((_, xi) => {
      const cx = LEFT_W + xi * (COL_W + COL_GAP) + COL_W / 2;
      svgHeader.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', HEADER_H - 4).attr('y2', HEADER_H)
        .attr('stroke', '#ccc').attr('stroke-width', 1);
    });

    // ====== BODY (circles) ======
    const svgH_body = nModel * (ROW_H + ROW_GAP) + 10;

    const svgBody = d3.select(bodyRef.current)
      .append('svg')
      .attr('width', svgW)
      .attr('height', svgH_body)
      .style('font-family', "'Inter', system-ui, sans-serif");

    // zebra stripes
    models.forEach((m, yi) => {
      const ry = yi * (ROW_H + ROW_GAP);
      if (yi % 2 === 0) {
        svgBody.append('rect')
          .attr('x', 0).attr('y', ry)
          .attr('width', svgW).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(0,0,0,0.03)');
      }
    });

    // selected model highlight
    if (selectedModel) {
      const si = models.indexOf(selectedModel);
      if (si !== -1) {
        const ry = si * (ROW_H + ROW_GAP);
        svgBody.append('rect')
          .attr('x', 0).attr('y', ry - ROW_GAP / 2)
          .attr('width', svgW).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(137,102,163,0.14)')
          .attr('stroke', '#7050a0').attr('stroke-width', 2).attr('rx', 3)
          .style('pointer-events', 'none');
      }
    }

    // bubbles
    const cellData = [];
    experiments.forEach((ex, xi) => {
      models.forEach((m, yi) => {
        const cell = cells?.[ex]?.[m];
        if (!cell) return;
        cellData.push({ ex, m, xi, yi, ...cell });
      });
    });

    svgBody.selectAll('circle.bubble')
      .data(cellData)
      .enter().append('circle')
      .attr('class', 'bubble')
      .attr('cx', d => LEFT_W + d.xi * (COL_W + COL_GAP) + COL_W / 2)
      .attr('cy', d => d.yi * (ROW_H + ROW_GAP) + ROW_H / 2)
      .attr('r', d => {
        const strength = clamp01((d.maj_pct - 0.5) / 0.5);
        return MIN_R + strength * (MAX_R - MIN_R);
      })
      .attr('fill', d => {
        const base = BASE_COLORS[d.majority] || BASE_COLORS.tie;
        const t = clamp01((d.mean_conf - conf_min) / confRange);
        return blendWithWhite(base, t);
      })
      .attr('stroke', '#00000033')
      .attr('stroke-width', 0.4)
      .style('opacity', d => selectedModel ? (d.m === selectedModel ? 1 : 0.25) : 1)
      .style('cursor', 'pointer')
      .on('click', (_, d) => onModelClick && onModelClick(d.m === selectedModel ? null : d.m));

    // Y-axis model names
    models.forEach((m, yi) => {
      const isSelected = m === selectedModel;
      svgBody.append('text')
        .attr('x', LEFT_W - 8)
        .attr('y', yi * (ROW_H + ROW_GAP) + ROW_H / 2)
        .attr('dominant-baseline', 'central')
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('fill', isSelected ? '#6b4a8c' : '#444')
        .style('font-weight', isSelected ? '600' : '400')
        .style('cursor', 'pointer')
        .text(m)
        .on('click', () => onModelClick && onModelClick(m === selectedModel ? null : m));
    });

    // column grid lines (subtle)
    experiments.forEach((_, xi) => {
      const cx = LEFT_W + xi * (COL_W + COL_GAP) + COL_W / 2;
      svgBody.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', 0).attr('y2', svgH_body)
        .attr('stroke', '#e0e0e0').attr('stroke-width', 0.5)
        .style('pointer-events', 'none');
    });

    // ====== LEGEND ======
    const leg = d3.select(legendRef.current)
      .append('svg')
      .attr('width', 340)
      .attr('height', 80)
      .style('font-family', "'Inter', system-ui, sans-serif");

    // color legend
    const colorItems = [
      { key: 'yes', label: 'Majority YES (>50%)' },
      { key: 'no',  label: 'Majority NO (>50%)'  },
      { key: 'tie', label: 'Tie / equal'          },
    ];
    colorItems.forEach(({ key, label }, i) => {
      const x = i * 110 + 8;
      leg.append('circle').attr('cx', x + 8).attr('cy', 16).attr('r', 7)
        .attr('fill', blendWithWhite(BASE_COLORS[key], 1))
        .attr('stroke', '#00000044').attr('stroke-width', 0.6);
      leg.append('text').attr('x', x + 20).attr('y', 20)
        .style('font-size', '10px').style('fill', '#555').text(label);
    });

    // size legend
    const sizeItems = [
      { pct: 0.5,  label: '50%' },
      { pct: 0.75, label: '75%' },
      { pct: 1.0,  label: '100%' },
    ];
    leg.append('text').attr('x', 8).attr('y', 44)
      .style('font-size', '10px').style('fill', '#888').text('Majority strength:');
    sizeItems.forEach(({ pct, label }, i) => {
      const x = 120 + i * 72;
      const r = MIN_R + clamp01((pct - 0.5) / 0.5) * (MAX_R - MIN_R);
      leg.append('circle').attr('cx', x + 8).attr('cy', 58).attr('r', r)
        .attr('fill', blendWithWhite(BASE_COLORS.yes, 0.85))
        .attr('stroke', '#00000044').attr('stroke-width', 0.6);
      leg.append('text').attr('x', x + 8).attr('y', 74)
        .attr('text-anchor', 'middle').style('font-size', '9px').style('fill', '#777')
        .text(label);
    });

    // confidence legend
    leg.append('text').attr('x', 8).attr('y', 72)
      .style('font-size', '10px').style('fill', '#888').text('Opacity = confidence (1–4)');

  }, [data, trainSource, region, allowedModelValues, rank, selectedExperiments, selectedModel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* legend */}
      <div ref={legendRef} style={{ flex: '0 0 auto', paddingLeft: 8, paddingBottom: 4 }} />

      {/* fixed header */}
      <div ref={headerRef} style={{ flex: '0 0 auto', overflowX: 'hidden' }} />

      {/* scrollable body */}
      <div
        ref={bodyRef}
        style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          overflowX: 'auto',
          minHeight: 0,
        }}
      />
    </div>
  );
};

export default BubbleHeatmap;
