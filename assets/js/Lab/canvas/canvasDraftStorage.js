const DB_NAME = 'cortex-canvas-workspaces';
const STORE = 'drafts';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Canvas storage is busy. Close older canvas pages and try again.'));
  });
}

export function prepareDraftEntries(entries) {
  return entries.map((entry) => ({ ...entry, files: entry.files.map((file) => ({
    ...file, blobURL: file.blobURL?.startsWith('blob:') ? undefined : file.blobURL,
  })) }));
}

export function hydrateDraftEntries(entries) {
  const urls = [];
  const hydrated = entries.map((entry) => ({ ...entry, files: entry.files.map((file) => {
    if (!(file.file instanceof Blob)) return { ...file };
    const blobURL = URL.createObjectURL(file.file);
    urls.push(blobURL);
    return { ...file, blobURL };
  }) }));
  return { entries: hydrated, release: () => urls.forEach((url) => URL.revokeObjectURL(url)) };
}

export async function loadCanvasDraft(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(id);
    transaction.oncomplete = () => { db.close(); resolve(request.result || null); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function saveCanvasDraft({ id, entries, cards, expectedRevision, openRequestId }) {
  // IndexedDB stores Files and large prediction arrays without localStorage's small quota.
  const snapshot = structuredClone({ entries: prepareDraftEntries(entries), cards });
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    let saved, conflict;
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result;
      if ((current?.revision || 0) !== expectedRevision) {
        conflict = new Error('A newer saved version exists. Load saved before editing it further.');
        transaction.abort();
        return;
      }
      saved = { id, schemaVersion: 1, revision: (current?.revision || 0) + 1, openRequestId: openRequestId || current?.openRequestId || null, updatedAt: Date.now(), ...snapshot };
      store.put(saved);
    };
    transaction.oncomplete = () => { db.close(); resolve(saved); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(conflict || transaction.error || new Error('Could not save canvas.')); };
  });
}
