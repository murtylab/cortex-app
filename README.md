# cortex-app

Frontend for the Cortex app.

## Dev setup

```bash
npm run dev
```

For a production check:

```bash
npm run build
npm run preview
```

To override the inference backend locally, set `VITE_SERVER_URL` in `.env.local`.
This is a public endpoint, not a secret. If unset, the deployed default in
`assets/js/services/config.js` is used. The inference API contract is unchanged.

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
