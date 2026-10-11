import fs from "node:fs";
import path from "node:path";

export function rewriteCortexCompassRequest(url) {
  if (typeof url !== "string") return null;
  const queryIndex = url.indexOf("?");
  const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex);
  if (!/^\/cortex-compass(?:\/|\/index\.html)?$/.test(pathname)) return null;
  return `/lab/index.html${queryIndex < 0 ? "" : url.slice(queryIndex)}`;
}

function applyCompassRewrites(server) {
  server.middlewares.use((request, _response, next) => {
    const rewritten = rewriteCortexCompassRequest(request.url);
    if (rewritten) request.url = rewritten;
    next();
  });
}

// Both pages share the actual Lab entry, preserving its React root and shell.
// Production receives an alias of the compiled HTML, never untransformed TSX.
export default function cortexCompassPlugin() {
  let outDir;
  let isBuild = false;
  return {
    name: "cortex-compass-page",
    configResolved(config) {
      isBuild = config.command === "build";
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer: applyCompassRewrites,
    configurePreviewServer: applyCompassRewrites,
    closeBundle() {
      if (!isBuild) return;
      const target = path.join(outDir, "cortex-compass", "index.html");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(outDir, "lab", "index.html"), target);
    },
  };
}
