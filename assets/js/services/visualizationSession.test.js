import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({ default: { create: () => http } }));

import {
  BASELINE_COMPARISON_MODELS,
  buildInfoVizSessionUrl,
  canExplorePrediction,
  closeVisualizationTab,
  createVisualizationSession,
  getComparisonModels,
  getComparisonErrorMessage,
  navigateToInfoViz,
  normalizeCapabilities,
  normalizeCreatedSession,
  openVisualizationTab,
  requireSupportedComparisonModels,
} from "./visualizationSession.js";
import { COMPASS_PREPARING_URL } from "./cortexCompassNavigation.js";

function createComparisonBrowser() {
  const origin = "http://localhost:5173";
  const documentObject = {
    title: "Original title",
    write: vi.fn(),
    body: { style: {}, replaceChildren: vi.fn() },
    createElement: vi.fn(),
  };
  const tab = {
    closed: false,
    opener: {},
    document: documentObject,
    location: { href: `${origin}${COMPASS_PREPARING_URL}`, replace: vi.fn() },
    focus: vi.fn(),
    close: vi.fn(),
  };
  const windowObject = {
    open: vi.fn(() => tab),
    dispatchEvent: vi.fn(),
    location: { origin, assign: vi.fn(), replace: vi.fn() },
  };
  return { windowObject, tab, documentObject };
}

beforeEach(() => {
  http.post.mockReset();
  http.get.mockReset();
  let index = 0;
  http.post.mockImplementation(async () => ({ data: {
    schema_version: 1,
    session_id: `model_session_token_${index++}`,
    expires_at: "2026-08-30T12:00:00Z",
  } }));
});

describe("visualization session contract", () => {
  const sourceRequest = { model: "resnet50", dataset: "murty185", roi: "ffa" };
  const stimuli = [{ path: "uploads/image.png", display_name: "My image.png" }];

  it("keeps the selected model first and includes all three fixed comparison models", () => {
    expect(getComparisonModels("resnet50")).toEqual([
      "resnet50", "efficient_net", "clip_rn50", "vgg16_imagenet1kv1",
    ]);
  });

  it.each(BASELINE_COMPARISON_MODELS)("does not run %s twice when it is the selected model", (model) => {
    const models = getComparisonModels(model);
    expect(models[0]).toBe(model);
    expect(models).toHaveLength(3);
    expect(new Set(models)).toEqual(new Set(BASELINE_COMPARISON_MODELS));
  });

  it("requires reference data for every requested model rather than silently omitting a baseline", () => {
    expect(() => requireSupportedComparisonModels("resnet50", ["resnet50", "clip_rn50"]))
      .toThrow(/efficient_net, vgg16_imagenet1kv1/);
    expect(requireSupportedComparisonModels("clip_rn50", BASELINE_COMPARISON_MODELS))
      .toEqual(getComparisonModels("clip_rn50"));
  });

  it("requests each model separately using the original single-model contract and unchanged inputs", async () => {
    const result = await createVisualizationSession({ model: "resnet50", sourceRequest, stimuli });
    const models = getComparisonModels("resnet50");
    expect(http.post).toHaveBeenCalledTimes(4);
    models.forEach((model, index) => {
      expect(http.post).toHaveBeenNthCalledWith(index + 1, "/cortex-core/comparison-sessions", {
        model,
        source_request: sourceRequest,
        stimuli,
      });
    });
    expect(result.session_id).toBe("multi-v1.model_session_token_0.model_session_token_1.model_session_token_2.model_session_token_3");
    expect(sourceRequest).toEqual({ model: "resnet50", dataset: "murty185", roi: "ffa" });
    expect(stimuli).toEqual([{ path: "uploads/image.png", display_name: "My image.png" }]);
  });

  it("deduplicates companion models without running the primary model twice", async () => {
    await createVisualizationSession({
      model: "clip_rn50", sourceRequest, stimuli,
      additionalModels: ["clip_rn50", "efficient_net", "efficient_net", "vgg16_imagenet1kv1"],
    });
    expect(http.post.mock.calls.map(([, body]) => body.model))
      .toEqual(["clip_rn50", "efficient_net", "vgg16_imagenet1kv1"]);
    expect(http.post.mock.calls.every(([, body]) => !("additional_models" in body))).toBe(true);
  });

  it("allows an explicit single-model API request for backwards-compatible callers", async () => {
    const result = await createVisualizationSession({ model: "resnet50", sourceRequest, stimuli, additionalModels: [] });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("additional_models");
    expect(result.session_id).toBe("model_session_token_0");
  });

  it("waits for each model request before starting the next one", async () => {
    let finishFirst;
    http.post.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    const pending = createVisualizationSession({ model: "resnet50", sourceRequest, stimuli });
    expect(http.post).toHaveBeenCalledTimes(1);
    finishFirst({ data: {
      schema_version: 1, session_id: "first_model_session_token", expires_at: "2026-08-30T12:00:00Z",
    } });
    await pending;
    expect(http.post).toHaveBeenCalledTimes(4);
  });

  it("snapshots image paths and Lab settings before awaiting any model", async () => {
    const mutableStimuli = stimuli.map((stimulus) => ({ ...stimulus }));
    const mutableSource = { ...sourceRequest };
    let finishFirst;
    http.post.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    const pending = createVisualizationSession({ model: "resnet50", sourceRequest: mutableSource, stimuli: mutableStimuli });
    mutableStimuli[0].path = "uploads/different.png";
    mutableStimuli[0].display_name = "Changed image.png";
    mutableSource.model = "alexnet";
    mutableSource.roi = "ppa";
    finishFirst({ data: {
      schema_version: 1, session_id: "first_model_session_token", expires_at: "2026-08-30T12:00:00Z",
    } });
    await pending;
    for (const [, body] of http.post.mock.calls) {
      expect(body.stimuli).toEqual(stimuli);
      expect(body.source_request).toEqual(sourceRequest);
    }
  });

  it("does not return a partial comparison when a companion fails", async () => {
    http.post.mockResolvedValueOnce({ data: {
      schema_version: 1, session_id: "first_model_session_token", expires_at: "2026-08-30T12:00:00Z",
    } }).mockRejectedValueOnce({ response: { data: { detail: "Reference data unavailable." } } });
    await expect(createVisualizationSession({ model: "resnet50", sourceRequest, stimuli }))
      .rejects.toThrow("Comparison for efficient_net failed: Reference data unavailable.");
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it("uses the earliest individual session expiry for the combined handoff", async () => {
    http.post.mockResolvedValueOnce({ data: {
      schema_version: 1, session_id: "first_model_session_token", expires_at: "2026-08-30T12:00:00Z",
    } }).mockResolvedValueOnce({ data: {
      schema_version: 1, session_id: "second_model_session_token", expires_at: "2026-08-30T11:00:00Z",
    } });
    const result = await createVisualizationSession({ model: "resnet50", sourceRequest, stimuli, additionalModels: ["clip_rn50"] });
    expect(result.expires_at).toBe("2026-08-30T11:00:00Z");
  });

  it("rejects duplicate server tokens instead of presenting incomplete model results", async () => {
    http.post.mockResolvedValue({ data: {
      schema_version: 1, session_id: "duplicate_model_session_token", expires_at: "2026-08-30T12:00:00Z",
    } });
    await expect(createVisualizationSession({ model: "resnet50", sourceRequest, stimuli }))
      .rejects.toThrow(/duplicate comparison session tokens/);
  });

  it("rejects invalid or more than three additional models before making a request", async () => {
    await expect(createVisualizationSession({ model: "resnet50", sourceRequest, stimuli, additionalModels: [""] }))
      .rejects.toThrow(/valid model identifiers/);
    await expect(createVisualizationSession({ model: "resnet50", sourceRequest, stimuli, additionalModels: ["a", "b", "c", "d"] }))
      .rejects.toThrow(/at most three/);
    await expect(createVisualizationSession({ model: "resnet50", sourceRequest, stimuli, additionalModels: [" efficient_net"] }))
      .rejects.toThrow(/valid model identifiers/);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("normalizes comparison capabilities without changing model identifiers", () => {
    const value = normalizeCapabilities({
      schema_version: 1,
      comparison_dataset: "nsd_1000",
      rois: ["ffa", "ppa", "eba"],
      supported_models: ["clip_rn50"],
      available: true,
      reference_version: "reference-version",
      reference_count: 185,
    });

    expect(value.supported_models).toEqual(["clip_rn50"]);
  });

  it("accepts the legacy dataset alias while normalizing it to comparison_dataset", () => {
    const value = normalizeCapabilities({
      schema_version: 1,
      dataset: "nsd_1000",
      rois: ["ffa", "ppa", "eba"],
      supported_models: [],
      available: false,
      reason: "Artifacts are not configured.",
    });

    expect(value.comparison_dataset).toBe("nsd_1000");
    expect(value.available).toBe(false);
  });

  it("rejects incompatible capabilities", () => {
    expect(() => normalizeCapabilities({
      schema_version: 1,
      comparison_dataset: "murty185",
      rois: ["eba"],
      supported_models: ["clip_rn50"],
    })).toThrow(/incompatible/i);
  });

  it("requires an opaque session id and expiry", () => {
    expect(normalizeCreatedSession({
      schema_version: 1,
      session_id: "opaque_session_token_0123456789",
      expires_at: "2026-08-30T12:00:00Z",
    })).toEqual({
      schema_version: 1,
      session_id: "opaque_session_token_0123456789",
      expires_at: "2026-08-30T12:00:00Z",
    });
    expect(() => normalizeCreatedSession({ schema_version: 1 })).toThrow(/invalid/i);
    expect(() => normalizeCreatedSession({
      schema_version: 1, session_id: "opaque_session_token_0123456789", expires_at: "not-a-date",
    })).toThrow(/invalid/i);
    expect(() => normalizeCreatedSession({
      schema_version: 1, session_id: "opaque-token", expires_at: "2026-08-30T12:00:00Z",
    })).toThrow(/invalid/i);
  });

  it("puts only the encoded token in the Cortex-Compass handoff fragment", () => {
    const url = buildInfoVizSessionUrl("opaque token/with?chars");
    expect(url).toBe("/infoviz/#session=opaque%20token%2Fwith%3Fchars");
    expect(url).not.toContain("path=");
  });

  it("reserves a new tab synchronously and removes opener access", () => {
    const { windowObject, tab } = createComparisonBrowser();
    expect(openVisualizationTab(windowObject)).toBe(tab);
    expect(windowObject.open).toHaveBeenCalledExactlyOnceWith(COMPASS_PREPARING_URL, "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });

  it("opens the normal Cortex host page without writing an inline placeholder", () => {
    const { windowObject, documentObject } = createComparisonBrowser();
    openVisualizationTab(windowObject);
    expect(documentObject.title).toBe("Original title");
    expect(documentObject.body.style).toEqual({});
    expect(documentObject.createElement).not.toHaveBeenCalled();
    expect(documentObject.body.replaceChildren).not.toHaveBeenCalled();
    expect(documentObject.write).not.toHaveBeenCalled();
    expect(windowObject.open).toHaveBeenCalledWith("/cortex-compass/?preparing=1", "_blank");
  });

  it("navigates the reserved tab without dispatching or unloading the original Lab result", () => {
    const { windowObject, tab } = createComparisonBrowser();
    const reservedTab = openVisualizationTab(windowObject);
    expect(navigateToInfoViz("opaque-token", reservedTab, windowObject)).toBe(tab);
    expect(windowObject.open).toHaveBeenCalledTimes(1);
    expect(tab.location.replace).toHaveBeenCalledExactlyOnceWith("/cortex-compass/#session=opaque-token");
    expect(tab.focus).toHaveBeenCalledTimes(1);
    expect(windowObject.dispatchEvent).not.toHaveBeenCalled();
    expect(windowObject.location.assign).not.toHaveBeenCalled();
    expect(windowObject.location.replace).not.toHaveBeenCalled();
  });

  it("can synchronously open a tab for an already prepared single-model token", () => {
    const { windowObject, tab } = createComparisonBrowser();
    navigateToInfoViz("opaque_session_token_0123456789", undefined, windowObject);
    expect(windowObject.open).toHaveBeenCalledTimes(1);
    expect(tab.opener).toBeNull();
    expect(tab.location.replace).toHaveBeenCalledWith("/cortex-compass/#session=opaque_session_token_0123456789");
  });

  it("keeps bundled model sessions together in the internal route", () => {
    const { windowObject, tab } = createComparisonBrowser();
    const token = "multi-v1.first_model_session_token.second_model_session_token";
    navigateToInfoViz(token, tab, windowObject);
    expect(tab.location.replace).toHaveBeenCalledWith(`/cortex-compass/#session=${token}`);
    expect(windowObject.open).not.toHaveBeenCalled();
  });

  it("keeps token contents encoded in a fixed internal path", () => {
    const { windowObject, tab } = createComparisonBrowser();
    navigateToInfoViz("token/with?chars#fragment", tab, windowObject);
    expect(tab.location.replace).toHaveBeenCalledWith("/cortex-compass/#session=token%2Fwith%3Fchars%23fragment");
  });

  it("does not open, dispatch, or navigate without a token", () => {
    const { windowObject, tab } = createComparisonBrowser();
    expect(() => navigateToInfoViz("", undefined, windowObject)).toThrow(/token/i);
    expect(windowObject.open).not.toHaveBeenCalled();
    expect(windowObject.dispatchEvent).not.toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(windowObject.location.assign).not.toHaveBeenCalled();
  });

  it("reports blocked pop-ups instead of navigating the original tab", () => {
    const { windowObject } = createComparisonBrowser();
    windowObject.open.mockReturnValue(null);
    expect(() => openVisualizationTab(windowObject)).toThrow(/allow pop-ups/i);
    expect(windowObject.location.assign).not.toHaveBeenCalled();
    expect(windowObject.dispatchEvent).not.toHaveBeenCalled();
  });

  it("reports a browser opening error as actionable pop-up guidance", () => {
    const { windowObject } = createComparisonBrowser();
    windowObject.open.mockImplementation(() => { throw new Error("Browser exception"); });
    expect(() => openVisualizationTab(windowObject)).toThrow(/allow pop-ups/i);
  });

  it("does not reopen a tab closed while comparison data were prepared", () => {
    const { windowObject, tab } = createComparisonBrowser();
    tab.closed = true;
    expect(() => navigateToInfoViz("opaque-token", tab, windowObject)).toThrow(/tab was closed/i);
    expect(windowObject.open).not.toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(windowObject.location.assign).not.toHaveBeenCalled();
  });

  it("closes a tab if opener access cannot be removed", () => {
    const { windowObject, tab } = createComparisonBrowser();
    Object.defineProperty(tab, "opener", { set() { throw new Error("Cannot isolate opener"); } });
    expect(() => openVisualizationTab(windowObject)).toThrow(/secure comparison tab/i);
    expect(tab.close).toHaveBeenCalledTimes(1);
  });

  it("does not access the new tab's document", () => {
    const { windowObject, tab } = createComparisonBrowser();
    const readDocument = vi.fn(() => { throw new Error("Document must not be accessed"); });
    Object.defineProperty(tab, "document", { get: readDocument });
    expect(openVisualizationTab(windowObject)).toBe(tab);
    expect(tab.opener).toBeNull();
    navigateToInfoViz("opaque-token", tab, windowObject);
    expect(tab.location.replace).toHaveBeenCalledWith("/cortex-compass/#session=opaque-token");
    expect(readDocument).not.toHaveBeenCalled();
  });

  it("does not treat browser focus preferences as a failed navigation", () => {
    const { windowObject, tab } = createComparisonBrowser();
    tab.focus.mockImplementation(() => { throw new Error("Focus denied"); });
    expect(() => navigateToInfoViz("opaque-token", tab, windowObject)).not.toThrow();
    expect(tab.location.replace).toHaveBeenCalledTimes(1);
  });

  it("safely closes caller-owned pending tabs without replacing the underlying error", () => {
    const { windowObject, tab } = createComparisonBrowser();
    openVisualizationTab(windowObject);
    closeVisualizationTab(tab);
    expect(tab.close).toHaveBeenCalledTimes(1);
    tab.closed = true;
    closeVisualizationTab(tab);
    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(() => closeVisualizationTab(null)).not.toThrow();
    tab.closed = false;
    tab.close.mockImplementation(() => { throw new Error("Already detached"); });
    expect(() => closeVisualizationTab(tab)).not.toThrow();
  });

  it("allows handoff while the just-opened host page is still loading from about:blank", () => {
    const { windowObject, tab } = createComparisonBrowser();
    tab.location.href = "about:blank";
    openVisualizationTab(windowObject);
    navigateToInfoViz("opaque-token", tab, windowObject);
    expect(tab.location.replace).toHaveBeenCalledWith("/cortex-compass/#session=opaque-token");
  });

  it("does not close an unreserved tab", () => {
    const { tab } = createComparisonBrowser();
    closeVisualizationTab(tab);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost:5173/lab/",
    "http://localhost:5173/cortex-compass/",
    "http://localhost:5173/cortex-compass/?preparing=1#session=another_session_token",
    "http://localhost:5173/cortex-compass/?preparing=1&extra=1",
    "https://another-site.example/cortex-compass/?preparing=1",
  ])("preserves user navigation to %s instead of handing off or closing it", (url) => {
    const { windowObject, tab } = createComparisonBrowser();
    openVisualizationTab(windowObject);
    tab.location.href = url;
    expect(() => navigateToInfoViz("opaque-token", tab, windowObject)).toThrow(/navigated away/i);
    closeVisualizationTab(tab);
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(tab.close).not.toHaveBeenCalled();
    expect(windowObject.open).toHaveBeenCalledTimes(1);
  });

  it("leaves inaccessible cross-origin pages alone after navigation away", () => {
    const { windowObject, tab } = createComparisonBrowser();
    openVisualizationTab(windowObject);
    Object.defineProperty(tab.location, "href", { get() { throw new Error("Cross-origin access denied"); } });
    expect(() => navigateToInfoViz("opaque-token", tab, windowObject)).toThrow(/navigated away/i);
    expect(() => closeVisualizationTab(tab)).not.toThrow();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("does not close completed comparison tabs during later stale-request cleanup", () => {
    const { windowObject, tab } = createComparisonBrowser();
    openVisualizationTab(windowObject);
    navigateToInfoViz("opaque-token", tab, windowObject);
    closeVisualizationTab(tab);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("shows Open Cortex-Compass only for a completed prediction with a request snapshot", () => {
    const complete = {
      showResults: true,
      predictionResult: [{ mean: { image: 1 } }],
      predictionLoading: false,
      snapshot: { model: "clip_rn50" },
    };
    expect(canExplorePrediction(complete)).toBe(true);
    expect(canExplorePrediction({ ...complete, predictionLoading: true })).toBe(false);
    expect(canExplorePrediction({ ...complete, predictionResult: null })).toBe(false);
    expect(canExplorePrediction({ ...complete, snapshot: null })).toBe(false);
  });

  it("prefers a structured Core error without exposing response internals", () => {
    expect(getComparisonErrorMessage({
      response: { data: { detail: { code: "unsupported_model", message: "No historical evidence." } } },
    })).toBe("No historical evidence.");
  });

  it("names Cortex-Compass in the fallback error and preserves the original result", () => {
    expect(getComparisonErrorMessage({})).toBe(
      "Cortex-Compass could not be opened. Your original result is still available.",
    );
  });
});
