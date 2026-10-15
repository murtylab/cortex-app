# cortex-app

Frontend for the Cortex app.

## Dev setup

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

For a production check:

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
fROI prediction, the fifth results section, below **3D brain response**, offers
**Open Cortex-Compass**. It opens `/cortex-compass/?preparing=1` in a new browser
tab immediately, showing Virtual Cortex's navigation and the normal comparison
loading view. Once the temporary NSD-1000 comparison is ready, that same tab
loads its session without a separate placeholder page or reference-only preview.
The original Lab tab and all its results remain unchanged, so users
can switch between the two tabs. A blocked popup shows an error in the Lab; failed
or stale preparation closes only its pending tab. No same-tab redirect is used.
The workspace embeds the same-origin `/infoviz/?embedded=1` page without a card
border or duplicate site masthead. Only opaque session tokens cross the
handoff; model settings and image paths are not put in the URL.

Each comparison includes the selected model plus EfficientNet (`efficient_net`),
CLIP RN50 (`clip_rn50`), and VGG16 ImageNet (`vgg16_imagenet1kv1`). Duplicate models
are run only once: three models when one baseline is selected, otherwise four.
All models use the same uploaded images, Murty185 references, and NSD-1000
predictions across FFA, PPA, and EBA. The selected model opens first; the original
Lab result is unchanged. The frontend makes one sequential request per model to
the existing single-model `POST /comparison-sessions` API; it does not send
`additional_models` or require a combined-model backend response. A versioned
`multi-v1` token bundle keeps the selected model first. Cortex-Compass loads and
validates every session, checks that the sanitized image contents and reference
settings match, and remaps independent upload IDs before presenting one workspace.
The effective expiry is the earliest individual session expiry. A failed model
does not open a partial comparison. Cortex Core must support reference data for
every requested model. Changing settings or starting a new inference
while preparing a comparison discards the old handoff rather than opening stale results.
Restoring an inference-history entry also restores Cortex-Compass access for that
run and cancels any comparison still being prepared for the previous result.

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

## Model pages

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`

## Brain visualization

**Lab — ROI Card.** `scripts/export_froi_surface.py` is the baker. It reads NSD subject 1’s FreeSurfer inflated surfaces, sulcal depth, and fLoc labels from a folder outside the repo, cuts one patch per fROI, and writes a GLB with `base_lh` / `base_rh` plus `roi_*` meshes. The site only loads the committed files. `subj01_froi.glb` is that script at t > 3.3. `subj01_froi_t7.glb` is the same script at t > 7. This view shows those baked patches, not model predictions. All / Selected only toggles which `roi_*` meshes are visible.

**Lab — Run Inference — 3D brain response.** It does not build a surface. It reuses the base meshes in `subj01_froi_t7.glb`. `scripts/build_subject1_prediction_mapping.py` only builds `subject1-prediction-mapping.json`: which prediction voxel lands on which vertex. The pycortex mapper, masks, and source GIFTI files stay outside the repo. The script checks that the GLB still matches those surfaces. It does not write new geometry.

The panel appears after Run Inference and only for NSD-1000 readouts, not Murty-185. It draws the selected image’s raw Subject 1 vector for the chosen fROI. Models may be trained jointly across subjects; only the API’s separated `s1` vector is shown. Voxel order is the training selection: cortical mask in z/y/x C-order, strict fLoc t > 7, then ROI-local indexing. Colors are a blue / cream / red scale fixed across the current image set and centered at zero. Gray cortex has no prediction here. A voxel is painted only when the linenn mapper gives it a positive weight on at least one surface vertex; the script does not snap it to a nearby vertex. Unmapped voxels are omitted: EBA 3/518, OFA 1/13, VWFA 6/232. FFA, FBA, PPA, OPA, and RSC map completely. Hover reports the dominant source voxel and its raw response, in native zero-based x/y/z. Changing the view does not change the predictions.

```bash
node --test assets/js/services/uploadBrainData.test.js
node --test assets/js/services/preloadedBrainData.test.js
node --test assets/js/services/uploadBrainProjection.test.js
python -B scripts/test_subject1_prediction_mapping.py -v
```

**Whole Brain.** There is no surface baker here. The current page inserts the HTML the backend returns; that code is not in this repo. Each image is scored into a voxel vector. A contrast is an ordinary two-sample t-test at every voxel: all images in group A against all images in group B. Voxel values are placed on the HCP inflated cortical surface with `hcp_utils`. nilearn’s `view_surf` draws them on `hcp.mesh.inflated`, with sulcal depth as the background, and returns a self-contained HTML widget. Changing the t threshold redraws that HTML. It does not rerun the model.
