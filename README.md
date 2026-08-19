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

To update backend url, change the url here: [`assets/js/services/config.js`](https://github.com/murtylab/cortex-app/blob/demo/assets/js/services/config.js)

Model pages:

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`
