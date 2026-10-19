import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDraftEntries, hydrateDraftEntries } from './canvasDraftStorage.js';

test('saved canvas recreates image URLs after original page URLs are revoked', async () => {
  const image = new Blob(['saved-image-bytes'], { type: 'image/png' });
  const originalURL = URL.createObjectURL(image);
  const entry = { id: 1, result: [{ mean: { a: 0.2 }, rdm: [[0]] }], files: [{ uid: 'a', label: 'a.png', file: image, blobURL: originalURL }] };
  const cards = [{ id: 'card', historyId: 1, x: 35, y: 60, w: 700, h: 450, showLegend: false, palette: 'viridis', groupFilter: ['face'], excludedFilenames: ['b'], highlightedFilenames: ['a'] }];
  // Structured clone is the browser's IndexedDB serialization format.
  const snapshot = structuredClone({ entries: prepareDraftEntries([entry]), cards });
  URL.revokeObjectURL(originalURL);
  assert.equal(snapshot.entries[0].files[0].blobURL, undefined);
  const restored = hydrateDraftEntries(snapshot.entries);
  try {
    assert.notEqual(restored.entries[0].files[0].blobURL, originalURL);
    assert.equal(await fetch(restored.entries[0].files[0].blobURL).then((result) => result.text()), 'saved-image-bytes');
    assert.deepEqual(snapshot.cards, cards);
    assert.deepEqual(restored.entries[0].result, entry.result);
    snapshot.cards[0].x = 999;
    snapshot.cards[0].highlightedFilenames.push('c');
    assert.equal(cards[0].x, 35);
    assert.deepEqual(cards[0].highlightedFilenames, ['a']);
  } finally { restored.release(); }
});

test('draft preparation keeps remote image references without changing source entries', () => {
  const entries = [{ id: 2, files: [{ uid: 'remote', blobURL: '/assets/example.png' }] }];
  const snapshot = prepareDraftEntries(entries);
  assert.equal(snapshot[0].files[0].blobURL, '/assets/example.png');
  snapshot[0].files[0].blobURL = 'changed';
  assert.equal(entries[0].files[0].blobURL, '/assets/example.png');
  const restored = hydrateDraftEntries(entries);
  assert.equal(restored.entries[0].files[0].blobURL, '/assets/example.png');
  restored.release();
});
