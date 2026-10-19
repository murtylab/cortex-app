import { loadCanvasDraft } from './canvasDraftStorage.js';

export function canvasWorkspaceUrl(origin, id, openRequestId) {
  const url = new URL('/lab/canvas/index.html', origin);
  url.searchParams.set('draft', id);
  if (openRequestId) url.searchParams.set('openRequestId', openRequestId);
  return url.href;
}

export async function loadCanvasWorkspace(id, { openRequestId, signal, read = loadCanvasDraft, timeoutMs = 30000, pollMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    signal?.throwIfAborted();
    const draft = await read(id);
    signal?.throwIfAborted();
    // Never show an older snapshot while this particular Open action is saving.
    if (draft && (!openRequestId || draft.openRequestId === openRequestId)) return draft;
    if (!openRequestId) return null;
    if (Date.now() >= deadline) throw new Error('The canvas has not finished saving. Return to the original page, check Save canvas, then try opening it again.');
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  } while (true);
}
