import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasEditor from './CanvasEditor.jsx';
import useCanvasWorkspace from './useCanvasWorkspace';
import { hydrateDraftEntries } from './canvasDraftStorage';
import { loadCanvasWorkspace } from './loadCanvasWorkspace';
import './standalone.css';

function SavedCanvas({ draft, entries }) {
  const [cards, setCards] = useState(draft.cards);
  const [sourceEntries, setSourceEntries] = useState(entries);
  const remoteRelease = useRef(null);
  useEffect(() => () => remoteRelease.current?.(), []);
  const workspace = useCanvasWorkspace({ entries: sourceEntries, cards, onChange: setCards, resetKey: draft.id, initialDraft: draft, onEntriesChange: (nextEntries) => {
    const hydrated = hydrateDraftEntries(nextEntries);
    remoteRelease.current?.();
    remoteRelease.current = hydrated.release;
    setSourceEntries(hydrated.entries);
  } });
  useEffect(() => {
    if (!workspace.dirty) return;
    const warnUnsaved = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [workspace.dirty]);
  return <main className="canvas-page"><header><a href="/lab/">Cortex / Lab</a><h1>Canvas workspace</h1><p>Saved charts, independent layouts and stimuli edits.</p></header><CanvasEditor entries={sourceEntries} cards={cards} onChange={setCards} workspace={workspace} /></main>;
}

function App() {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, release;
    const query = new URLSearchParams(window.location.search);
    const id = query.get('draft');
    const openRequestId = query.get('openRequestId');
    const controller = new AbortController();
    if (!id) { setError('Open a canvas from Compare → Customize canvas first.'); return; }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cortex-canvas:${id}`) : null;
    if (channel) channel.onmessage = (event) => {
      if (event.data?.type === 'open-failed' && event.data.openRequestId === openRequestId) {
        setError(event.data.message || 'The original page could not save this canvas.');
        controller.abort();
      }
    };
    loadCanvasWorkspace(id, { openRequestId, signal: controller.signal }).then((draft) => {
      if (cancelled) return;
      if (!draft || draft.schemaVersion !== 1) { setError('This saved canvas could not be found in this browser.'); return; }
      const hydrated = hydrateDraftEntries(draft.entries);
      release = hydrated.release;
      setLoaded({ draft, entries: hydrated.entries });
      // The opening token is only needed until the first successful load.
      // Refresh should load the latest saved draft, even after later saves.
      const url = new URL(window.location.href);
      url.searchParams.delete('openRequestId');
      window.history.replaceState(null, '', url);
    }).catch((err) => { if (!cancelled && err?.name !== 'AbortError') setError(err?.message || 'Could not load canvas.'); });
    return () => { cancelled = true; controller.abort(); channel?.close(); release?.(); };
  }, []);
  if (error) return <main className="canvas-page"><h1>Canvas workspace</h1><p role="alert">{error}</p><a href="/lab/">Back to Lab</a></main>;
  if (!loaded) return <main className="canvas-page"><p role="status">Loading saved canvas…</p></main>;
  return <SavedCanvas {...loaded} />;
}

createRoot(document.getElementById('canvas-root')).render(<App />);
