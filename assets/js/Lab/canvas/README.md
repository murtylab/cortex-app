# Canvas editor

Independent editor module for chart layouts and per-chart stimuli views.

```jsx
import CanvasEditor from './canvas/CanvasEditor.jsx';

<CanvasEditor entries={inferenceHistory} cards={cards} onChange={setCards} />
```

The caller owns `cards` so layouts, filters and highlights survive closing the editor.
Clear cards when changing the stimulus set. The current Lab integration also removes
cards whose history entries have been evicted.

- `CanvasEditor.jsx`: layout, selection, properties, undo and redo.
- `CanvasChart.jsx`: chart rendering using a derived, per-card data view.
- `StimuliPanel.jsx`: group filters, per-image visibility, search and highlights.
- `canvasData.js`: pure transforms; always indexes the original RDM on both axes.
- `canvasGeometry.js`: movement, snapping and size limits.
- `types.ts`: persisted `CanvasCard` model.
- `CanvasEditor.css`: editor UI styles.

`groupFilter: undefined` means all groups; `[]` means no groups.
`excludedFilenames` and `highlightedFilenames` use original prediction filenames.
Hidden highlights stay saved, but only visible highlights are passed to charts.
Highlighting changes emphasis, never statistical inputs. RDM highlights mark the
selected images' rows and columns. Box statistics use all currently visible images.
Changing the source history of a card resets that card's stimulus edits.
The source history, files and predictions are never mutated or rerun.

Run data checks with `node --test assets/js/Lab/canvas/canvasData.test.js`.

## Standalone workspace and saving

The Lab page owns a `useCanvasWorkspace` bridge for the active stimulus set.
Pass its return value as the editor's `workspace` prop to enable **Save canvas**
and **Open in new page**. The standalone route is `/lab/canvas/index.html?draft=<id>`.
Opening uses a normal new-tab link, with a per-open transaction token. The new
page waits for that exact save to commit and removes the token after loading.
This avoids blank-page redirects and loading a previous snapshot while a save
is still pending. Opening failures and timeouts are displayed in the new page.

Drafts live in this browser's IndexedDB, including prediction snapshots and image
Files. Transient blob URLs are regenerated when loading a draft so saved images
still work after the original Lab tab closes. Saving completes only when its
storage transaction commits. Save again after editing; unsaved standalone edits
trigger the browser's leave-page prompt.

BroadcastChannel and a focus fallback synchronize saved layouts to other pages
of the same workspace. Unsaved local edits are kept until the user chooses
**Load saved**. Revision checks prevent a stale page from overwriting a newer
saved draft. The original Lab history still resets with its stimulus set;
explicitly saved workspaces remain available at their saved URLs after refresh.
Draft URLs refer to local browser data and do not share or publish a canvas.

## Export

**Export canvas** downloads PNG (normally 2× resolution) or vector SVG, on both
the embedded editor and standalone page. It composes chart SVGs and visible titles
at their logical canvas positions, with resolved styles, chart backgrounds,
filters, highlights and scale visibility. Toolbars, handles, selection borders and
the editor grid are excluded. PNG output is capped at 16,000 pixels per dimension
and approximately 32 million pixels for large canvases. Export does not change the
saved workspace. Reopen the saved workspace URL to continue editing.

Run all canvas data/storage checks with `node --test assets/js/Lab/canvas/*.test.js`.
