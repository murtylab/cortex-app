import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasChartData, getCanvasStimuli } from './canvasData.js';

const entry = {
  id: 12,
  files: [
    { uid: 'a', serverKey: 'a', label: 'A', groupKey: 'face' },
    { uid: 'b', serverKey: 'b', label: 'B', groupKey: 'scene' },
    { uid: 'c', serverKey: 'c', label: 'C', groupKey: 'face' },
    { uid: 'd', serverKey: 'd', label: 'D', groupKey: 'scene' },
  ],
  result: [{ mean: { a: 0.2, b: 0.8, c: -0.3, d: 0.4 }, sem: { a: 0.01, b: 0.02, c: 0.03, d: 0.04 },
    rdm: [[0, 1, 2, 3], [1, 0, 4, 5], [2, 4, 0, 6], [3, 5, 6, 0]] }],
};
const cell = (view, x, y) => view.heatmap.find((value) => value.x === x && value.y === y)?.value;

test('default chart includes all saved stimuli and their original mappings', () => {
  const view = buildCanvasChartData(entry, { order: 'group' });
  assert.deepEqual(view.filenames, ['a', 'b', 'c', 'd']);
  assert.deepEqual(view.sortedFilenames, ['a', 'c', 'b', 'd']);
  assert.equal(view.heatmap.length, 16);
  assert.equal(view.fileMappings[2].groupKey, 'face');
  assert.equal(view.bars[2].sem, 0.03);
});

test('group filter preserves original RDM indices on both axes', () => {
  const view = buildCanvasChartData(entry, { groupFilter: ['scene'] });
  assert.deepEqual(view.filenames, ['b', 'd']);
  assert.equal(view.heatmap.length, 4);
  assert.equal(cell(view, 'b', 'd'), 5);
  assert.equal(cell(view, 'd', 'b'), 5);
  assert.equal(cell(view, 'd', 'd'), 0);
});

test('excluding one stimulus removes its bar and both RDM axes', () => {
  const view = buildCanvasChartData(entry, { excludedFilenames: ['b'] });
  assert.deepEqual(view.filenames, ['a', 'c', 'd']);
  assert.equal(view.heatmap.length, 9);
  assert.equal(cell(view, 'c', 'd'), 6);
  assert.ok(view.heatmap.every((value) => value.x !== 'b' && value.y !== 'b'));
});

test('only visible highlights are sent to renderers; highlighted images remain in data', () => {
  const view = buildCanvasChartData(entry, { groupFilter: ['face'], highlightedFilenames: ['a', 'b', 'c'] });
  assert.deepEqual(view.highlightedFilenames, ['a', 'c']);
  assert.equal(view.bars.length, 2);
  assert.deepEqual(buildCanvasChartData(entry, { groupFilter: ['scene'], highlightedFilenames: ['a'] }).highlightedFilenames, []);
});

test('empty group selection shows no images; resetting restores them', () => {
  assert.equal(buildCanvasChartData(entry, { groupFilter: [] }).filenames.length, 0);
  assert.equal(buildCanvasChartData(entry, { groupFilter: undefined, excludedFilenames: [] }).filenames.length, 4);
});

test('two charts edit independently without changing source history or RDM', () => {
  const before = JSON.stringify(entry);
  const firstCard = { excludedFilenames: ['b'], highlightedFilenames: ['c'], order: 'ranking' };
  const beforeCard = JSON.stringify(firstCard);
  const first = buildCanvasChartData(entry, firstCard);
  const second = buildCanvasChartData(entry, { groupFilter: ['scene'] });
  assert.deepEqual(first.sortedFilenames, ['d', 'a', 'c']);
  assert.deepEqual(second.filenames, ['b', 'd']);
  assert.equal(cell(second, 'b', 'd'), 5);
  assert.equal(JSON.stringify(entry), before);
  assert.equal(JSON.stringify(firstCard), beforeCard);
});

test('saved chart edits survive JSON roundtrip and missing RDM is not fabricated', () => {
  const card = { groupFilter: ['face'], excludedFilenames: ['c'], highlightedFilenames: ['a'] };
  assert.deepEqual(buildCanvasChartData(entry, JSON.parse(JSON.stringify(card))), buildCanvasChartData(entry, card));
  assert.deepEqual(buildCanvasChartData({ ...entry, result: [{ mean: { a: 0.2 } }] }, {}).heatmap, []);
  assert.deepEqual(getCanvasStimuli(undefined), []);
});
