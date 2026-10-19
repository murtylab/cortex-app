import { CANVAS_WIDTH } from './canvasGeometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPERTIES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'opacity', 'visibility', 'display'];

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function pngExportSize(width, height) {
  const scale = Math.min(2, 16000 / width, 16000 / height, Math.sqrt(32_000_000 / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Copy computed chart styles so CSS variables and page styles resolve in standalone SVGs.
function cloneChartSvg(source) {
  const clone = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const computed = getComputedStyle(node);
    for (const property of STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) copies[index].style.setProperty(property, value);
    }
    // SVG presentation attributes are intentionally used for chart transforms.
    copies[index].style.removeProperty('transform-box');
    copies[index].style.removeProperty('transform-origin');
  });
  for (const property of ['width', 'height', 'margin-top', 'margin', 'transform']) clone.style.removeProperty(property);
  return clone;
}

export function buildCanvasSvg(stage, width = CANVAS_WIDTH, height, { transparentBackground = false } = {}) {
  if (!stage) throw new Error('Canvas is not ready to export.');
  const stageBounds = stage.getBoundingClientRect();
  const scale = stageBounds.width / width;
  if (!scale || !height) throw new Error('Canvas is not ready to export.');
  const output = svgElement('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
  if (!transparentBackground) output.append(svgElement('rect', { width, height, fill: '#ffffff' }));

  for (const card of stage.querySelectorAll('.canvas-chart-object')) {
    const bounds = card.getBoundingClientRect();
    const x = (bounds.left - stageBounds.left) / scale;
    const y = (bounds.top - stageBounds.top) / scale;
    const w = bounds.width / scale, h = bounds.height / scale;
    const group = svgElement('g', { transform: `translate(${x},${y})` });
    if (!transparentBackground) group.append(svgElement('rect', { width: w, height: h, fill: getComputedStyle(card).backgroundColor }));

    const title = card.querySelector('.canvas-chart-title');
    if (title) {
      const style = getComputedStyle(title);
      const clipId = `canvas-title-${output.children.length}`;
      const clip = svgElement('clipPath', { id: clipId });
      clip.append(svgElement('rect', { x: 12, y: 0, width: Math.max(1, w - 24), height: 40 }));
      group.append(clip);
      const size = parseFloat(style.fontSize) || 12;
      const lineHeight = parseFloat(style.lineHeight) || size * 1.4;
      const text = svgElement('text', { x: 12, y: 10 + size, fill: style.color, 'font-family': style.fontFamily, 'font-size': style.fontSize, 'font-weight': style.fontWeight, 'clip-path': `url(#${clipId})` });
      const measure = document.createElement('canvas').getContext('2d');
      if (measure) measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const lines = [];
      let line = '';
      for (const word of title.textContent.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure && measure.measureText(next).width > w - 24) { lines.push(line); line = word; }
        else line = next;
      }
      if (line) lines.push(line);
      lines.slice(0, 2).forEach((content, index) => {
        const span = svgElement('tspan', { x: 12, y: 10 + size + index * lineHeight });
        span.textContent = content;
        text.append(span);
      });
      group.append(text);
    }
    for (const chart of card.querySelectorAll('.canvas-chart-content svg')) {
      const chartBounds = chart.getBoundingClientRect();
      const clone = cloneChartSvg(chart);
      const svgWidth = Number(chart.getAttribute('width')) || chartBounds.width / scale;
      const svgHeight = Number(chart.getAttribute('height')) || chartBounds.height / scale;
      if (!clone.hasAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      clone.setAttribute('x', String((chartBounds.left - bounds.left) / scale));
      clone.setAttribute('y', String((chartBounds.top - bounds.top) / scale));
      clone.setAttribute('width', String(chartBounds.width / scale));
      clone.setAttribute('height', String(chartBounds.height / scale));
      group.append(clone);
    }
    const notice = card.querySelector('.canvas-empty-chart');
    if (notice) {
      const text = svgElement('text', { x: 16, y: h / 2, fill: '#8a8378', 'font-size': 12 });
      text.textContent = notice.textContent;
      group.append(text);
    }
    output.append(group);
  }
  return new XMLSerializer().serializeToString(output);
}

async function svgToPng(svg, width, height) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Could not render the canvas export.')); image.src = url; });
    const dimensions = pngExportSize(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create PNG.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export async function exportCanvas(stage, format, height, options = {}) {
  await document.fonts?.ready;
  const svg = buildCanvasSvg(stage, CANVAS_WIDTH, height, options);
  const blob = format === 'svg' ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }) : await svgToPng(svg, CANVAS_WIDTH, height);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cortex-canvas.${format === 'svg' ? 'svg' : 'png'}`;
  document.body.append(link);
  link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
