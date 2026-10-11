# cortex-app

fontend for the cortex app

Dev setup:

1. Create `.env.local` in the repo root with:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

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

To override the inference backend locally, set `VITE_SERVER_URL` in `.env.local`.
This is a public endpoint, not a secret. If unset, the deployed default in
`assets/js/services/config.js` is used. The inference API contract is unchanged.

### Stimulus brain response

After Run Inference, a fourth result panel displays the selected image's
raw NSD Subject 1 predictions for the chosen ROI on the existing cortical surface.
It supports uploads and the built-in Reza2011, Brandman2016, Josephs2020 and Kamps2019
stimulus sets, using the chosen model's cached predictions when available or live
inference otherwise. The image picker and voxel hover comparison use only the
currently loaded images from that run (including any edits to a predefined set). Hover
previews do not change which image colors the brain. Colors share a fixed response
scale across the run; gray cortex has no predictions in this view.

The inline map uses a shared inflated-surface view, a display-controls sidebar,
and a searchable image picker. The top thumbnail identifies the image shown on
the brain; a voxel-hover card compares it with the highest-response image at
that voxel without changing the brain. Search narrows only the picker, not the
voxel comparison. Blue/cream/red colors use one symmetric, zero-centered scale
fixed across the current image set. View and hemisphere controls do not change
predictions or the comparison set.

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
node --test assets/js/services/uploadBrainProjection.test.js assets/js/services/uploadBrainInterface.test.js
python -B scripts/test_subject1_prediction_mapping.py -v
npm run build
```

Model pages:

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`
