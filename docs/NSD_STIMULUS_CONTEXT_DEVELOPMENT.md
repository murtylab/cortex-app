# NSD stimulus-context development runbook

This runbook starts Cortex App, its linked Cortex-Compass frontend, and the existing
Core backend for local development. It does not deploy or modify production.

## Prerequisites and reference bundle

Start in the parent directory containing `cortex-app` and `cortex-core`.
Cortex-Compass source is the `cortex-app/apps/cortex-compass` submodule:

```bash
export VC_WORKSPACE="$(pwd)"
git -C "$VC_WORKSPACE/cortex-app" submodule update --init --recursive
npm --prefix "$VC_WORKSPACE/cortex-app" ci
npm --prefix "$VC_WORKSPACE/cortex-app/apps/cortex-compass" ci
mkdir -p "$VC_WORKSPACE/.runtime/gradio" \
  "$VC_WORKSPACE/.runtime/core-cache" \
  "$VC_WORKSPACE/.runtime/comparison-sessions"
```

Use the verified 126-model reference release already installed in the
private artifact installation. Its browser assets are tracked in the linked
visualization repo, but the matching
server-only `artifacts/reference/` bundle is not. For another machine, follow
the visualization README's **Moving the standardized release to another
machine** instructions. Do not run the legacy 26-model artifact builder over
the current expanded release. No reference generation is needed for shell/UI
changes.

The existing local workspace keeps its private reference bundle in the original
independent `InfoViz-Prototype-Edition/artifacts/reference` checkout. That directory
is not moved, linked into the frontend build, or published. On another machine,
install the audited bundle separately and configure `CORTEX_REFERENCE_ARTIFACT_DIR`.

## Terminal 1: Cortex Core (port 5556)

```bash
cd "$VC_WORKSPACE/cortex-core"
conda activate cortex-core

export CORTEX_REFERENCE_ARTIFACT_DIR="$VC_WORKSPACE/InfoViz-Prototype-Edition/artifacts/reference"
export CORTEX_COMPARISON_SESSION_DIR="$VC_WORKSPACE/.runtime/comparison-sessions"
export CORTEX_COMPARISON_SESSION_TTL_SECONDS=3600
export CORTEX_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
export CORTEX_APP_CACHE_DIR="$VC_WORKSPACE/.runtime/core-cache"
export GRADIO_TEMP_DIR="$VC_WORKSPACE/.runtime/gradio"
export CORTEX_CHECKPOINT_DIR="/research/cortex-paper/cortex_best_checkpoints"
export CORTEX_BACKBONE_DIR="/research/cortex-paper/backbones"
export CUDA_VISIBLE_DEVICES=1

python app.py
```

Verify the service in another terminal:

```bash
curl --fail http://localhost:5556/healthz
curl --fail http://localhost:5556/comparison/capabilities
```

The session janitor removes expired JSON and copied PNG assets. The default TTL is 3,600 seconds. DreamSim MMD resources are loaded lazily and are not required for startup or comparison sessions.

## Terminal 2: Cortex-Compass (port 5174)

```bash
cd "$VC_WORKSPACE/cortex-app"
npm run dev:compass
```

A direct visit to `http://localhost:5174` is standalone static mode. Session mode is entered only through a `#session=<opaque-token>` handoff.

## Terminal 3: Virtual Cortex App (port 5173)

```bash
cd "$VC_WORKSPACE/cortex-app"
npm run dev
```

Open `http://localhost:5173/lab/` for the fROI workflow. The whole-brain URL is independent of the NSD comparison service.

After inference, **Open Cortex-Compass** immediately opens a new browser tab at
`/cortex-compass/?preparing=1`, showing the normal Cortex shell and comparison
loading view. Once the comparison is ready, that same tab loads its session,
hosting `/infoviz/?embedded=1`. There is no separate placeholder screen or
reference-only visualization during preparation. The original Lab tab keeps
its results so users can switch between the two. Allow pop-ups if the browser
blocks the new tab. Failed or stale preparation closes only the pending tab.
Opening `/cortex-compass/` directly starts reference-only mode.
The opaque comparison token is retained in the comparison tab's history state for
refresh, not in a query string or browser storage. Refreshing the Lab itself
still resets its in-memory inference results.

For VS Code Remote SSH, forward only port 5173. Cortex App proxies `/infoviz/`
to the machine-local Cortex-Compass server and both apps proxy Core requests to the
machine-local port 5556. For direct network access without port forwarding, use
the university-machine hostname in browser-facing URLs and include the resulting
origin in `CORTEX_ALLOWED_ORIGINS`.

These two frontend commands use the checked-out submodule and the host's local
backend routing. Environment variables remain available when Core or Cortex-Compass runs on a
different host or port. Restart both Vite servers after changing any `VITE_*`
variable.

## Combined release layout

The frontend repos keep separate histories, with the exact InfoViz revision
pinned at `apps/cortex-compass`. Initialize it with
`git submodule update --init --recursive`. `npm run build` emits the host's
`/cortex-compass/` entry and builds the linked frontend directly into
`dist/infoviz/` with base `/infoviz/`. Publish that combined `dist` and configure
the Core backend route separately. `npm run preview` serves the built visualization,
not the development `/infoviz` proxy. A private child repo is supported when the
builder has read access and recursively checks out the submodule.

Do not copy `node_modules`, private `artifacts/reference`, upload sessions, or
trained checkpoints into the frontend output. Upload comparison support also
requires the matching Core code and audited private reference release; a fresh
frontend clone is not sufficient. Consult the visualization README's release
transfer instructions before deployment. The local IUI workspace changes do
not change the separate VSS worktree or deploy either app.

## Automated checks

```bash
cd "$VC_WORKSPACE/cortex-app/apps/cortex-compass"
conda run -n cortex-core python -m unittest discover -s tests -v
npm test
npm run build

cd "$VC_WORKSPACE/cortex-core"
conda run -n cortex-core python -m pytest -q tests/test_rdm.py tests/test_comparison_*.py tests/test_visual_features.py

cd "$VC_WORKSPACE/cortex-app"
npm test
npx tsc --noEmit --pretty false
npm run build
```

## Manual smoke matrix

For each supported case, first confirm that the existing Cortex result and download action still work. Then choose **Open Cortex-Compass** and verify that Cortex-Compass labels the original request separately from the NSD-1000 comparison.

| Primary request | Uploads | Expected session behavior |
| --- | ---: | --- |
| NSD-1000 / FFA / supported model | 1 | Same comparison model; FFA, PPA, and EBA present |
| Murty185 / EBA / supported model | 1 | Original remains Murty185/EBA; comparison is NSD-1000/all ROIs |
| Murty185 / PPA / supported model | 2+ | Every upload has reference percentile and combined rank in all ROIs |
| Any dataset/ROI / unsupported model | 1 | No substitution; the user must explicitly select a supported comparison model or cancel |
| Any valid session after TTL | any | Safe expired-session page and return link to Cortex |

In Cortex-Compass, also verify:

- the URL fragment disappears after a successful session load;
- uploaded markers appear in rankings, the fixed-domain distribution, voxel PCA, and the 77-feature visual PCA without moving historical points;
- K-means uses saved centroids; hierarchical correlation-distance views use the
  session's joint reference-plus-upload fit, while legacy sessions without a
  joint tree remain reference-only;
- heatmap scores/ranks remain unchanged and uploads never become model rows;
- DreamSim upload placement is explicitly unavailable because the archived 1,792-dimensional references do not match the current 768-dimensional runtime encoder;
- measured ground-truth fMRI views never show an uploaded stimulus.

For the integrated workspace, also verify that the new tab opens immediately,
Virtual Cortex's navigation stays visible, and the duplicate visualization
masthead is absent. Switch back to the original Lab tab and confirm its results
and selected image remain unchanged. Repeat with a second comparison session
and confirm each opens in its own tab. Open the standalone visualization separately to
confirm its original masthead and navigation are unchanged.
