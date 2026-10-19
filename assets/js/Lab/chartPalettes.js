import * as d3 from 'd3';

export const paletteNames = { default: 'Original', viridis: 'Viridis', plasma: 'Plasma', cividis: 'Cividis', blues: 'Blues', magma: 'Magma', custom: 'Custom colors' };
export function chartInterpolator(palette, low = '#253494', high = '#fdbb84', fallback = d3.interpolatePlasma) {
  if (palette === 'custom') return d3.interpolateRgb(low, high);
  return ({ viridis: d3.interpolateViridis, plasma: d3.interpolatePlasma, cividis: d3.interpolateCividis, blues: d3.interpolateBlues, magma: d3.interpolateMagma })[palette] || fallback;
}
