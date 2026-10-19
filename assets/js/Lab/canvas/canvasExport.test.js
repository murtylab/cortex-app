import test from 'node:test';
import assert from 'node:assert/strict';
import { pngExportSize, buildCanvasSvg } from './canvasExport.js';

test('PNG exports at 2x logical canvas size, independent of editor zoom', () => {
  assert.deepEqual(pngExportSize(1200, 800), { width: 2400, height: 1600 });
  assert.deepEqual(pngExportSize(1200, 1600), { width: 2400, height: 3200 });
});

test('large canvases respect image dimension and total pixel limits', () => {
  for (const [width, height] of [[1200, 100000], [1200, 10000], [20000, 20000]]) {
    const dimensions = pngExportSize(width, height);
    assert.ok(dimensions.width <= 16000 && dimensions.height <= 16000);
    assert.ok(dimensions.width * dimensions.height <= 32_020_000);
    assert.ok(Math.abs(dimensions.width / dimensions.height - width / height) < 0.002);
  }
});

test('export fails clearly when there is no rendered canvas', () => {
  assert.throws(() => buildCanvasSvg(null, 1200, 800), /not ready/);
});
