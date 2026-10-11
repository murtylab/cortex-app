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

Model pages:

- Shared template: `model-pages/index.html`
- Model-specific copy and metadata: `assets/data/model-pages.json`
- Pretty URLs like `/model-pages/resnet50/` are generated at build time from that template
- Add or edit a model in the JSON, then rebuild; scores still come from `assets/data/new/`
