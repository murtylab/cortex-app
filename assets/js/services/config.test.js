import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function configuration(values = {}) {
  for (const key of ["VITE_CORTEX_CORE_URL", "VITE_SERVER_URL", "VITE_CORTEX_INFOVIZ_URL", "VITE_CORTEX_WHOLE_BRAIN_URL"]) {
    vi.stubEnv(key, values[key] ?? "");
  }
  return import("./config.js");
}

describe("merged Cortex service configuration", () => {
  it("preserves the IUI same-origin local defaults", async () => {
    const config = await configuration();
    expect(config.SERVER_URL).toBe("/cortex-core");
    expect(config.INFOVIZ_URL).toBe("/infoviz");
    expect(config.SERVER_URL_Whole_Brain).toBe("http://localhost:5557");
  });

  it("supports the upstream inference endpoint variable", async () => {
    const config = await configuration({ VITE_SERVER_URL: "https://core.example///" });
    expect(config.SERVER_URL).toBe("https://core.example");
  });

  it("gives the explicit Cortex Core setting precedence over the upstream alias", async () => {
    const config = await configuration({ VITE_CORTEX_CORE_URL: "/cortex-core/", VITE_SERVER_URL: "https://core.example" });
    expect(config.SERVER_URL).toBe("/cortex-core");
  });

  it("keeps visualization and whole-brain settings independent", async () => {
    const config = await configuration({ VITE_CORTEX_INFOVIZ_URL: "/infoviz/", VITE_CORTEX_WHOLE_BRAIN_URL: "https://whole-brain.example/" });
    expect(config.INFOVIZ_URL).toBe("/infoviz");
    expect(config.SERVER_URL_Whole_Brain).toBe("https://whole-brain.example");
    expect(config.SERVER_URL).toBe("/cortex-core");
  });
});
