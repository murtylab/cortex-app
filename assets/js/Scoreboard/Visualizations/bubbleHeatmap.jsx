import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

const COL_W    = 52;
const ROW_H    = 22;
const COL_GAP  = 4;
const ROW_GAP  = 2;
const MIN_R    = 3;
const MAX_R    = 11;
const RIGHT_W  = 16;
const OV_W     = 175;   // overview panel width
const NAME_W   = 165;   // fixed model-name column width in detail
const LEGEND_W = 140;   // right rail: YES / NO / tie + size note
const HEADER_BOT = 10;  // tick line / padding at bottom of experiment header

// YES = sage teal, NO = terracotta, tie = warm gray
const BASE_COLORS = {
  yes: [ 90, 155, 140],
  no:  [190, 120,  80],
  tie: [160, 155, 150],
};

const BG = [247, 247, 244];
function blendWithWhite([r, g, b], t) {
  return `rgb(${Math.round((1-t)*BG[0]+t*r)},${Math.round((1-t)*BG[1]+t*g)},${Math.round((1-t)*BG[2]+t*b)})`;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function shortLabel(expKey) {
  const parts = expKey.split('::');
  const exp = parts[0] || expKey;
  const roi = parts[2] && parts[2] !== 'ROI' ? parts[2] : null;
  return roi ? `${exp} [${roi}]` : exp;
}

/** Shared filter/sort so header height (JSX) matches SVG. */
function getQualiSlice(data, trainSource, region, allowedModelValues, rank, selectedExperiments) {
  if (!data || !trainSource) return null;
  const src = data[trainSource];
  if (!src) return null;
  const { models: allModels, experiments: allExperiments, cells, conf_min = 1, conf_max = 4 } = src;
  const isRanked = rank === 'rank';
  let models = (allowedModelValues && allowedModelValues.size > 0)
    ? allModels.filter(m => allowedModelValues.has(m))
    : [...allModels];
  if (!isRanked) {
    models = [...models].sort((a, b) => a.localeCompare(b));
  } else {
    // sort by average yes-win-rate across all experiments, descending
    const score = {};
    models.forEach(m => {
      const rates = allExperiments.map(ex => {
        const cell = cells?.[ex]?.[m];
        if (!cell) return null;
        if (cell.majority === 'yes') return cell.maj_pct;
        if (cell.majority === 'no')  return 1 - cell.maj_pct;
        return 0.5;
      }).filter(v => v !== null);
      score[m] = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    });
    models = [...models].sort((a, b) => score[b] - score[a]);
  }
  const activeROIs = Array.isArray(region)
    ? region.filter(r => r !== 'Across Regions').map(r => r.toLowerCase()) : [];
  const activeExpFilter = Array.isArray(selectedExperiments) && selectedExperiments.length > 0
    ? new Set(selectedExperiments) : null;
  let experiments = allExperiments.filter(ex => {
    if (activeROIs.length > 0) {
      const roiPart = (ex.split('::')[2] || '').toLowerCase();
      if (!activeROIs.includes(roiPart)) return false;
    }
    if (activeExpFilter && !activeExpFilter.has(ex)) return false;
    return true;
  });
  if (!isRanked) experiments = [...experiments].sort((a, b) => a.localeCompare(b));
  return { models, experiments, cells, conf_min, conf_max };
}

/**
 * Header height for vertical labels: one full string rotated -90° (read with head tilted left).
 * After rotation, horizontal text length maps to vertical span — need enough SVG height.
 */
function computeRotatedVerticalHeaderHeight(experiments, labelFont) {
  const nExp = experiments.length;
  if (nExp === 0) return 72;
  const maxLen = Math.max(4, ...experiments.map(e => shortLabel(e).length));
  const textRunPx = maxLen * labelFont * 0.54;
  return Math.min(440, Math.max(72, Math.ceil(textRunPx + HEADER_BOT + 22)));
}

const BubbleHeatmap = ({
  data, trainSource, region,
  allowedModelValues, rank, selectedExperiments,
  selectedModel, onModelClick,
}) => {
  const ovRef      = useRef();    // overview mini-grid SVG container (measured)
  const namesRef   = useRef();    // fixed model-name column (scroll-synced vertically)
  const headerRef  = useRef();    // experiment labels (scroll-synced horizontally)
  const bodyRef    = useRef();    // scrollable bubble body

  const [ovH, setOvH] = useState(0);
  const stateRef = useRef({ nModel: 0, totalBodyH: 0, visRectNode: null });

  const slice = useMemo(
    () => getQualiSlice(data, trainSource, region, allowedModelValues, rank, selectedExperiments),
    [data, trainSource, region, allowedModelValues, rank, selectedExperiments]
  );

  // ── Measure overview container height ────────────────────────────
  useEffect(() => {
    const el = ovRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setOvH(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Scroll sync ───────────────────────────────────────────────────
  useEffect(() => {
    const bodyEl = bodyRef.current;
    if (!bodyEl) return;
    const handleScroll = () => {
      // sync header horizontally
      if (headerRef.current) headerRef.current.scrollLeft = bodyEl.scrollLeft;
      // sync names column vertically
      if (namesRef.current) namesRef.current.scrollTop = bodyEl.scrollTop;
      // update visible-range rect in overview
      const { nModel, totalBodyH, visRectNode } = stateRef.current;
      const currentOvH = ovRef.current ? ovRef.current.clientHeight : 0;
      if (!nModel || !totalBodyH || !visRectNode || currentOvH <= 0) return;
      const visH = Math.max(4, (bodyEl.clientHeight / totalBodyH) * currentOvH);
      const maxScroll = Math.max(1, totalBodyH - bodyEl.clientHeight);
      const rectY = (bodyEl.scrollTop / maxScroll) * (currentOvH - visH);
      d3.select(visRectNode)
        .attr('y', Math.max(0, rectY))
        .attr('height', visH);
    };
    bodyEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => bodyEl.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Main draw ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!slice || ovH <= 0) return;
    const { models, experiments, cells, conf_min = 1, conf_max = 4 } = slice;
    const nExp = experiments.length;
    const nModel = models.length;
    if (nExp === 0 || nModel === 0) return;

    const confRange  = conf_max - conf_min || 1;
    const totalBodyH = nModel * (ROW_H + ROW_GAP);
    stateRef.current = { nModel, totalBodyH, visRectNode: null };

    const labelFont = nExp > 28 ? 7 : nExp > 20 ? 8 : nExp > 14 ? 9 : 10;
    const headerSvgH = computeRotatedVerticalHeaderHeight(experiments, labelFont);
    const labelCy = (headerSvgH - HEADER_BOT) / 2;

    // clear all containers
    [ovRef, namesRef, headerRef, bodyRef].forEach(r => {
      if (r.current) d3.select(r.current).selectAll('*').remove();
    });

    const svgW_detail = nExp * (COL_W + COL_GAP) + RIGHT_W;
    const svgH_body   = totalBodyH + 10;
    // overview cell dimensions (scale all data to fit the overview panel)
    const ovRowH = Math.max(1, ovH / nModel);
    const ovColW = Math.max(1, OV_W / nExp);
    // Bubble radii in overview: same maj_pct logic as detail, scaled to cell size
    const cellSpan = Math.min(ovColW, ovRowH);
    const ovRMax = Math.max(0.6, cellSpan / 2 - 0.6);
    const ovRMin = Math.max(0.35, ovRMax * (MIN_R / MAX_R));

    // ── OVERVIEW: mini bubble grid (circles like detail, scaled) ─
    const svgOv = d3.select(ovRef.current)
      .append('svg')
      .attr('width', OV_W)
      .attr('height', ovH)
      .style('display', 'block')
      .style('font-family', "'Inter', system-ui, sans-serif");

    // subtle row bands (behind circles)
    models.forEach((_, yi) => {
      if (yi % 2 === 0) {
        svgOv.append('rect')
          .attr('x', 0).attr('y', yi * ovRowH)
          .attr('width', OV_W).attr('height', ovRowH)
          .attr('fill', 'rgba(0,0,0,0.02)');
      }
    });

    experiments.forEach((ex, xi) => {
      models.forEach((m, yi) => {
        const cell = cells?.[ex]?.[m];
        const cx = xi * ovColW + ovColW / 2;
        const cy = yi * ovRowH + ovRowH / 2;
        if (!cell) {
          svgOv.append('circle')
            .attr('cx', cx).attr('cy', cy).attr('r', ovRMin * 0.45)
            .attr('fill', '#e8e4dc')
            .attr('stroke', '#ddd').attr('stroke-width', 0.2)
            .style('pointer-events', 'none');
          return;
        }
        const strength = clamp01((cell.maj_pct - 0.5) / 0.5);
        const r = ovRMin + strength * (ovRMax - ovRMin);
        const fill = blendWithWhite(
          BASE_COLORS[cell.majority] || BASE_COLORS.tie,
          clamp01((cell.mean_conf - conf_min) / confRange)
        );
        const g = svgOv.append('g')
          .style('opacity', selectedModel ? (m === selectedModel ? 1 : 0.3) : 1)
          .style('cursor', 'pointer')
          .on('click', () => onModelClick && onModelClick(m === selectedModel ? null : m));
        g.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', r)
          .attr('fill', fill)
          .attr('stroke', '#00000033').attr('stroke-width', 0.35);
      });
    });

    // left-edge selection indicator
    if (selectedModel) {
      const si = models.indexOf(selectedModel);
      if (si !== -1) {
        svgOv.append('rect')
          .attr('x', 0).attr('y', si * ovRowH)
          .attr('width', 3).attr('height', Math.max(1, ovRowH))
          .attr('fill', '#7050a0').style('pointer-events', 'none');
      }
    }

    // visible-range rect (drawn last, on top)
    const initVisH = Math.max(4, (300 / Math.max(1, totalBodyH)) * ovH);
    const visRect = svgOv.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', OV_W).attr('height', initVisH)
      .attr('fill', 'rgba(137,102,163,0.12)')
      .attr('stroke', '#7050a0').attr('stroke-width', 1.5).attr('rx', 2)
      .style('pointer-events', 'none');
    stateRef.current.visRectNode = visRect.node();

    // ── NAMES SVG (fixed left column, v-scroll synced to body) ────
    const svgNames = d3.select(namesRef.current)
      .append('svg')
      .attr('width', NAME_W)
      .attr('height', svgH_body)
      .style('display', 'block')
      .style('font-family', "'Inter', system-ui, sans-serif");

    // zebra + selection in names column
    models.forEach((m, yi) => {
      const ry = yi * (ROW_H + ROW_GAP);
      if (yi % 2 === 0) {
        svgNames.append('rect')
          .attr('x', 0).attr('y', ry)
          .attr('width', NAME_W).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(0,0,0,0.025)');
      }
      if (m === selectedModel) {
        svgNames.append('rect')
          .attr('x', 0).attr('y', ry - ROW_GAP / 2)
          .attr('width', NAME_W).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(137,102,163,0.14)')
          .style('pointer-events', 'none');
        svgNames.append('rect')
          .attr('x', 0).attr('y', ry).attr('width', 3).attr('height', ROW_H)
          .attr('fill', '#7050a0').style('pointer-events', 'none');
      }
      const isSelected = m === selectedModel;
      svgNames.append('text')
        .attr('x', NAME_W - 8)
        .attr('y', ry + ROW_H / 2)
        .attr('dominant-baseline', 'central')
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('fill', isSelected ? '#6b4a8c' : '#444')
        .style('font-weight', isSelected ? '600' : '400')
        .style('cursor', 'pointer')
        .text(m)
        .on('click', () => onModelClick && onModelClick(m === selectedModel ? null : m));
    });

    // ── HEADER SVG: full experiment name as one line, rotate -90° (vertical, head-left reading) ──
    const svgHeader = d3.select(headerRef.current)
      .append('svg')
      .attr('width', svgW_detail)
      .attr('height', headerSvgH)
      .attr('overflow', 'visible')
      .style('display', 'block')
      .style('font-family', "'Inter', system-ui, sans-serif");

    experiments.forEach((ex, xi) => {
      const cx = xi * (COL_W + COL_GAP) + COL_W / 2;
      const full = shortLabel(ex);
      const textEl = svgHeader.append('text')
        .attr('x', cx)
        .attr('y', labelCy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('transform', `rotate(-90, ${cx}, ${labelCy})`)
        .style('font-size', `${labelFont}px`)
        .style('fill', '#444')
        .text(full);
      textEl.append('title').text(full);
      svgHeader.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', headerSvgH - 2).attr('y2', headerSvgH)
        .attr('stroke', '#ccc').attr('stroke-width', 1);
    });

    // ── BODY SVG (bubbles only, scrollable) ───────────────────────
    const svgBody = d3.select(bodyRef.current)
      .append('svg')
      .attr('width', svgW_detail).attr('height', svgH_body)
      .style('display', 'block')
      .style('font-family', "'Inter', system-ui, sans-serif");

    // zebra + selection highlight
    models.forEach((m, yi) => {
      const ry = yi * (ROW_H + ROW_GAP);
      if (yi % 2 === 0) {
        svgBody.append('rect')
          .attr('x', 0).attr('y', ry)
          .attr('width', svgW_detail).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(0,0,0,0.03)');
      }
      if (m === selectedModel) {
        svgBody.append('rect')
          .attr('x', 0).attr('y', ry - ROW_GAP / 2)
          .attr('width', svgW_detail).attr('height', ROW_H + ROW_GAP)
          .attr('fill', 'rgba(137,102,163,0.14)')
          .attr('stroke', '#7050a0').attr('stroke-width', 2).attr('rx', 3)
          .style('pointer-events', 'none');
      }
    });

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
      .attr('cx', d => d.xi * (COL_W + COL_GAP) + COL_W / 2)
      .attr('cy', d => d.yi * (ROW_H + ROW_GAP) + ROW_H / 2)
      .attr('r', d => MIN_R + clamp01((d.maj_pct - 0.5) / 0.5) * (MAX_R - MIN_R))
      .attr('fill', d => blendWithWhite(
        BASE_COLORS[d.majority] || BASE_COLORS.tie,
        clamp01((d.mean_conf - conf_min) / confRange)
      ))
      .attr('stroke', '#00000033').attr('stroke-width', 0.4)
      .style('opacity', d => selectedModel ? (d.m === selectedModel ? 1 : 0.25) : 1)
      .style('cursor', 'pointer')
      .on('click', (_, d) => onModelClick && onModelClick(d.m === selectedModel ? null : d.m));

    // column grid lines
    experiments.forEach((_, xi) => {
      const cx = xi * (COL_W + COL_GAP) + COL_W / 2;
      svgBody.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', 0).attr('y2', svgH_body)
        .attr('stroke', '#e0e0e0').attr('stroke-width', 0.5)
        .style('pointer-events', 'none');
    });

  }, [slice, ovH, selectedModel, onModelClick]);

  const legFont = { fontFamily: "'Inter', system-ui, sans-serif", fontSize: '10px', color: '#555' };
  const legMuted = { ...legFont, fontSize: '9px', color: '#888' };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', minHeight: 0 }}>
      {/* Left: Overview title + minimap only */}
      <div
        style={{
          width: OV_W,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e0ddd8',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: '0 0 auto',
            padding: '6px 8px',
            borderBottom: '1px solid #eee',
            fontSize: '9px',
            fontWeight: 600,
            color: '#b0a8bc',
            fontFamily: "'Inter', system-ui, sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Overview
        </div>
        <div ref={ovRef} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }} />
      </div>

      {/* Center: chart */}
      <div
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'row',
            minWidth: 0,
            borderBottom: '1px solid #eee',
            overflow: 'visible',
          }}
        >
          <div style={{ width: NAME_W, flexShrink: 0 }} />
          <div
            ref={headerRef}
            style={{
              flex: 1,
              minWidth: 0,
              overflowX: 'hidden',
              overflowY: 'visible',
            }}
          />
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'row', minWidth: 0 }}>
          <div ref={namesRef} style={{ width: NAME_W, flexShrink: 0, overflow: 'hidden' }} />
          <div ref={bodyRef} style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, overflow: 'auto' }} />
        </div>
      </div>

      {/* Right: YES / NO / tie legend (separate rail) */}
      <div
        style={{
          width: LEGEND_W,
          flexShrink: 0,
          borderLeft: '1px solid #e0ddd8',
          padding: '10px 10px 10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'rgba(0,0,0,0.02)',
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        <div style={{ ...legFont, fontWeight: 600, color: '#6b4a8c', fontSize: '9px', letterSpacing: '0.06em' }}>
          LEGEND
        </div>
        <div style={legFont}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: 'rgb(90,155,140)' }}>●</span> Majority YES (&gt;50%)
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: 'rgb(190,120,80)' }}>●</span> Majority NO (&gt;50%)
          </div>
          <div>
            <span style={{ color: 'rgb(160,155,150)' }}>●</span> Tie / equal
          </div>
        </div>
        <div style={{ ...legMuted, borderTop: '1px solid #e8e2ee', paddingTop: 8 }}>
          <div style={{ marginBottom: 6 }}>Bubble size → majority strength</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(90,155,140)', opacity: 0.85 }} />
              <span style={{ fontSize: '8px' }}>50%</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(90,155,140)', opacity: 0.85 }} />
              <span style={{ fontSize: '8px' }}>75%</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgb(90,155,140)', opacity: 0.85 }} />
              <span style={{ fontSize: '8px' }}>100%</span>
            </span>
          </div>
        </div>
        <div style={legMuted}>Paler fill → lower mean confidence (1–4)</div>
      </div>
    </div>
  );
};

export default BubbleHeatmap;
