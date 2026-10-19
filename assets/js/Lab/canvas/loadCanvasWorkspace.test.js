import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasWorkspaceUrl, loadCanvasWorkspace } from './loadCanvasWorkspace.js';

test('workspace URL directly targets the standalone HTML entry on the same origin', () => {
  const url = new URL(canvasWorkspaceUrl('http://localhost:5173', 'draft id', 'token'));
  assert.equal(url.origin, 'http://localhost:5173');
  assert.equal(url.pathname, '/lab/canvas/index.html');
  assert.equal(url.searchParams.get('draft'), 'draft id');
  assert.equal(url.searchParams.get('openRequestId'), 'token');
});

test('new page waits until its exact save commits instead of loading a stale snapshot', async () => {
  const snapshots = [null, { id: 'a', openRequestId: 'old', cards: ['old'] }, { id: 'a', openRequestId: 'new', cards: ['new'] }];
  let reads = 0;
  const draft = await loadCanvasWorkspace('a', { openRequestId: 'new', read: async () => snapshots[reads++], pollMs: 0 });
  assert.equal(reads, 3);
  assert.deepEqual(draft.cards, ['new']);
});

test('a refreshed saved URL loads immediately without an opening token', async () => {
  const snapshot = { id: 'a', openRequestId: 'older-open', cards: ['saved'] };
  assert.equal(await loadCanvasWorkspace('a', { read: async () => snapshot }), snapshot);
  assert.equal(await loadCanvasWorkspace('missing', { read: async () => null }), null);
});

test('failed opening saves time out with an actionable message', async () => {
  await assert.rejects(loadCanvasWorkspace('a', { openRequestId: 'missing', read: async () => null, timeoutMs: 0 }), /not finished saving/);
});

test('leaving the page cancels a pending load', async () => {
  const controller = new AbortController();
  await assert.rejects(loadCanvasWorkspace('a', { signal: controller.signal, read: async () => { controller.abort(); return null; } }), { name: 'AbortError' });
});
