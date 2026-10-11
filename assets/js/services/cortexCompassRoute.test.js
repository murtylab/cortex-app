import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import cortexCompassPlugin, { rewriteCortexCompassRequest } from "../../../scripts/vite-plugin-cortex-compass.js";

const temporaryDirectories = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

describe("Cortex-Compass page route", () => {
  it.each(["/cortex-compass", "/cortex-compass/", "/cortex-compass/index.html"])(
    "reuses the Lab shell for %s",
    (url) => expect(rewriteCortexCompassRequest(url)).toBe("/lab/index.html"),
  );

  it("preserves the complete query without widening the route match", () => {
    expect(rewriteCortexCompassRequest("/cortex-compass/?view=brain&other=with%3Fchars"))
      .toBe("/lab/index.html?view=brain&other=with%3Fchars");
    expect(rewriteCortexCompassRequest("/cortex-compass/index.html?"))
      .toBe("/lab/index.html?");
  });

  it.each(["/lab/", "/cortex-compass-old/", "/cortex-compass/assets/file.js", "/cortex-compass//", "/prefix/cortex-compass/", undefined])(
    "does not rewrite unrelated requests: %s",
    (url) => expect(rewriteCortexCompassRequest(url)).toBeNull(),
  );

  it.each(["configureServer", "configurePreviewServer"])(
    "installs the same internal route for %s without redirecting the browser",
    (hook) => {
      let middleware;
      const plugin = cortexCompassPlugin();
      plugin[hook]({ middlewares: { use: (value) => { middleware = value; } } });
      const request = { url: "/cortex-compass/?view=brain" };
      let continued = false;
      middleware(request, {}, () => { continued = true; });
      expect(request.url).toBe("/lab/index.html?view=brain");
      expect(continued).toBe(true);
    },
  );

  it("continues requests with no URL", () => {
    let middleware;
    cortexCompassPlugin().configureServer({ middlewares: { use: (value) => { middleware = value; } } });
    const request = {};
    let continued = false;
    middleware(request, {}, () => { continued = true; });
    expect(request).toEqual({});
    expect(continued).toBe(true);
  });

  it("publishes the exact compiled Lab shell at the refreshable production route", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-compass-route-test-"));
    temporaryDirectories.push(directory);
    const labDirectory = path.join(directory, "dist", "lab");
    fs.mkdirSync(labDirectory, { recursive: true });
    const compiledHtml = '<!doctype html><title>Virtual Cortex</title><script type="module" src="/assets/lab-compiled.js"></script>';
    fs.writeFileSync(path.join(labDirectory, "index.html"), compiledHtml);
    const plugin = cortexCompassPlugin();
    plugin.configResolved({ command: "build", root: directory, build: { outDir: "dist" } });
    plugin.closeBundle();
    expect(fs.readFileSync(path.join(directory, "dist", "cortex-compass", "index.html"), "utf8"))
      .toBe(compiledHtml);
  });

  it("does not write production files when the development server closes", () => {
    const plugin = cortexCompassPlugin();
    plugin.configResolved({ command: "serve", root: "/unused", build: { outDir: "dist" } });
    expect(() => plugin.closeBundle()).not.toThrow();
  });
});
