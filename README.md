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
fROI prediction, the result panel can create a temporary NSD-1000 comparison
session and navigate to Cortex-Compass using only its opaque token through the
**Open Cortex-Compass** action. The visualization remains in the
`InfoViz-Prototype-Edition` repository; its `/infoviz/` route and existing
`INFOVIZ` environment-variable names are unchanged.

The complete three-service startup, artifact generation, validation, and smoke-test procedure is in
[`docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md`](docs/NSD_STIMULUS_CONTEXT_DEVELOPMENT.md).

Model pages:

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`
