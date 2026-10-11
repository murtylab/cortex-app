# cortex-app

fontend for the cortex app

Dev setup:

1. Optional: create `.env.local` in the repo root to override the built-in
service-routing defaults or configure analytics:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CORTEX_CORE_URL=/cortex-core
CORTEX_CORE_PROXY_TARGET=http://127.0.0.1:5556
VITE_CORTEX_INFOVIZ_URL=/infoviz
INFOVIZ_PROXY_TARGET=http://127.0.0.1:5174
```

The relative Core and Cortex-Compass defaults use Vite development proxies, so Virtual Cortex and
Cortex-Compass both work when port 5173 is opened through VS Code Remote
SSH. Ports 5556 and 5174 do not need separate browser forwarding. Cortex-Compass's
development base defaults to `/infoviz/` as shown in the runbook.

2. Run the app:

```bash
npm run dev
```

3. For a production check:

```bash
npm run build
npm run preview
```

Analytics setup:

- GA4 is integrated in the root Vite app, not in `cortex-web-app`
- The measurement ID is read from `VITE_GA_MEASUREMENT_ID`
- Do not commit real GA keys; keep them in `.env.local`

The fROI backend and Cortex-Compass handoff URLs are configured through `.env.local`.
Do not put temporary tunnel URLs or secrets in source control. After a successful
fROI prediction, **Open Cortex-Compass** creates a temporary NSD-1000 comparison
and opens `/cortex-compass/` inside Virtual Cortex's navigation. The Lab remains
mounted, so **Back to the Lab** restores its results without another inference.
The workspace embeds the same-origin `/infoviz/?embedded=1` page without a card
border or duplicate site masthead. Only the opaque session token crosses the
handoff; model settings and image paths are not put in the URL.

The visualization source remains in the sibling `InfoViz-Prototype-Edition`
repository. Its standalone `/infoviz/` route and existing `INFOVIZ` environment
names are unchanged; no source-folder move is needed. `npm run build` produces
the host's `/cortex-compass/` HTML entry, but does not bundle the sibling app.
A combined release must also serve Cortex-Compass's compiled output at
`/infoviz/` and route `/cortex-core/` to the matching backend. Development proxies
are not a production deployment configuration. The embedded URL must remain
same-origin (normally `VITE_CORTEX_INFOVIZ_URL=/infoviz`), rather than pointing
directly at another site's visualization URL.

The complete three-service startup, artifact generation, validation, and smoke-test procedure is in
[`docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md`](docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md).

The fROI inference backend uses `VITE_CORTEX_CORE_URL` first, then the optional
`VITE_SERVER_URL` alias; if neither is set, it uses `/cortex-core`. These are
public endpoint settings, not secrets. The inference API contract is unchanged.
The whole-brain service is configured separately with `VITE_CORTEX_WHOLE_BRAIN_URL`
and defaults to `http://localhost:5557`.

### Stimulus brain response

After Run Inference, a fourth result panel displays the selected image's
raw NSD Subject 1 predictions for the chosen ROI on the existing cortical surface.
It supports uploads and the built-in Reza2011, Brandman2016, Josephs2020 and Kamps2019
stimulus sets, using the chosen model's cached predictions when available or live
inference otherwise. The image picker and voxel hover comparison use only the
currently loaded images from that run (including any edits to a predefined set). Hover
previews do not change which image colors the brain. Colors share a fixed response
scale across the run; gray cortex has no predictions in this view.

The inline map retains the compact image picker, below-map view controls, and
two persistent image previews. Both inflated hemispheres share one camera and
the visualization-style lighting and surface appearance. The previews distinguish
the image coloring the brain from the highest-response image at the last inspected
voxel. Blue/cream/red colors use one symmetric, zero-centered scale fixed across
the current image set. Changing the view does not change predictions or the
comparison set.

The map requires NSD-1000 readouts (not Murty-185 mapping or fabricated demo results).
It uses the training voxel selection and order: cortical mask in z/y/x C-order,
strict fLoc t > 7, then ROI-local response indexing. Models may be trained jointly
across subjects, but only the API's separated `s1` vector is shown. Surface colors
are weighted interpolations; hover reports the dominant source voxel and its raw
response, with native zero-based x/y/z volume indices. No reference dataset is loaded.

All eight Lab ROIs are supported. Unmapped voxels are explicitly omitted:
EBA 3/518, OFA 1/13, VWFA 6/232; the other ROIs have full surface support.
`scripts/build_subject1_prediction_mapping.py --help` describes rebuilding the
small lookup from training masks/t-values and a pycortex mapper. The builder
verifies the existing GLB's exact source vertex correspondence and face ordering;
it does not export MRI or new geometry. Dependencies: NumPy and SciPy.

Checks:

```bash
node --test assets/js/services/uploadBrainData.test.js
node --test assets/js/services/preloadedBrainData.test.js
node --test assets/js/services/uploadBrainProjection.test.js
python -B scripts/test_subject1_prediction_mapping.py -v
npm run build
```

Model pages:

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`
