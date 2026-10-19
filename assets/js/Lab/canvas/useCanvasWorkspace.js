import { useEffect, useRef, useState } from 'react';
import { loadCanvasDraft, saveCanvasDraft } from './canvasDraftStorage';
import { canvasWorkspaceUrl } from './loadCanvasWorkspace';

export default function useCanvasWorkspace({ entries, cards, onChange, resetKey, initialDraft = null, onEntriesChange }) {
  const [id, setId] = useState(() => initialDraft?.id || crypto.randomUUID());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const stateRef = useRef(null);
  const current = useRef({ entries, cards, onChange, onEntriesChange });
  current.current = { entries, cards, onChange, onEntriesChange };
  if (stateRef.current?.id !== id) stateRef.current = { id, revision: initialDraft?.revision || 0, savedSignature: initialDraft ? JSON.stringify(initialDraft.cards) : null };
  const channelRef = useRef(null);
  const resetRef = useRef(resetKey);
  const [openingToken, setOpeningToken] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (resetRef.current === resetKey) return;
    resetRef.current = resetKey;
    setId(crypto.randomUUID()); setStatus(''); setHasRemote(false); setSavedUrl('');
  }, [resetKey]);

  const applySaved = (draft) => {
    const validIds = new Set((current.current.onEntriesChange ? draft.entries : current.current.entries).map((entry) => entry.id));
    const next = draft.cards.filter((card) => validIds.has(card.historyId));
    stateRef.current.revision = draft.revision;
    stateRef.current.savedSignature = JSON.stringify(next);
    current.current.onEntriesChange?.(draft.entries);
    current.current.onChange(next);
    setHasRemote(false);
    setStatus('Saved version loaded');
  };

  useEffect(() => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cortex-canvas:${id}`) : null;
    channelRef.current = channel;
    let cancelled = false;
    const checkSaved = async () => {
      try {
        const draft = await loadCanvasDraft(id);
        if (cancelled || !draft || stateRef.current.id !== id || draft.revision <= stateRef.current.revision) return;
        const localEdits = stateRef.current.savedSignature === null ? current.current.cards.length > 0 : JSON.stringify(current.current.cards) !== stateRef.current.savedSignature;
        if (localEdits) {
          setHasRemote(true);
          setStatus('Updated in another page. Load saved to use that version.');
        } else applySaved(draft);
      } catch { /* Explicit Save/Load actions display storage errors. */ }
    };
    if (channel) channel.onmessage = (event) => { if (event.data?.type === 'saved') checkSaved(); };
    const onFocus = () => checkSaved();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; channel?.close(); window.removeEventListener('focus', onFocus); };
  }, [id]);

  const save = async ({ openRequestId } = {}) => {
    if (busy) return null;
    const state = stateRef.current;
    setBusy(true); setStatus('Saving…');
    try {
      const draft = await saveCanvasDraft({ id, ...current.current, expectedRevision: state.revision, openRequestId });
      if (stateRef.current !== state) return null;
      state.revision = draft.revision;
      state.savedSignature = JSON.stringify(draft.cards);
      setHasRemote(false);
      setStatus(`Saved locally · ${new Date(draft.updatedAt).toLocaleTimeString()}`);
      const url = canvasWorkspaceUrl(window.location.origin, id);
      setSavedUrl(url);
      try { channelRef.current?.postMessage({ type: 'saved' }); } catch { /* Focus fallback can pick up committed saves. */ }
      return url;
    } catch (error) {
      if (stateRef.current === state) {
        setStatus(error?.message || 'Could not save canvas.');
        setHasRemote(true);
        if (openRequestId) {
          try { channelRef.current?.postMessage({ type: 'open-failed', openRequestId, message: error?.message || 'Could not save canvas.' }); } catch { /* The new page also reports a timeout. */ }
        }
      }
      return null;
    } finally { setBusy(false); }
  };
  const loadSaved = async () => {
    const requestedId = id;
    try {
      const draft = await loadCanvasDraft(requestedId);
      if (stateRef.current.id !== requestedId) return;
      if (draft) applySaved(draft);
      else setStatus('No saved version yet.');
    } catch (error) { setStatus(error?.message || 'Could not load canvas.'); }
  };
  const openInNewPage = (event) => {
    if (busy) { event.preventDefault(); return; }
    // Let a normal target=_blank link open the actual page immediately.
    // That page waits for this exact transaction rather than an about:blank redirect.
    const token = openingToken;
    void save({ openRequestId: token }).finally(() => { setOpeningToken(crypto.randomUUID()); });
  };
  const dirty = JSON.stringify(cards) !== stateRef.current.savedSignature;
  return { save, loadSaved, openInNewPage, openUrl: canvasWorkspaceUrl(window.location.origin, id, openingToken), status, busy, hasRemote, savedUrl, dirty, standalone: !!initialDraft };
}
