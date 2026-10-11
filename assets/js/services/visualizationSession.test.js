import { describe, expect, it } from "vitest";
import {
  buildInfoVizSessionUrl,
  canExplorePrediction,
  getComparisonErrorMessage,
  navigateToInfoViz,
  normalizeCapabilities,
  normalizeCreatedSession,
} from "./visualizationSession.js";

describe("visualization session contract", () => {
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
      session_id: "opaque-token",
      expires_at: "2026-08-30T12:00:00Z",
    })).toEqual({
      schema_version: 1,
      session_id: "opaque-token",
      expires_at: "2026-08-30T12:00:00Z",
    });
    expect(() => normalizeCreatedSession({ schema_version: 1 })).toThrow(/invalid/i);
  });

  it("puts only the encoded token in the Cortex-Compass handoff fragment", () => {
    const url = buildInfoVizSessionUrl("opaque token/with?chars");
    expect(url).toBe("/infoviz/#session=opaque%20token%2Fwith%3Fchars");
    expect(url).not.toContain("path=");
  });

  it("falls back to the internal Cortex page when no mounted workspace handles the token", () => {
    const calls = [];
    navigateToInfoViz("opaque-token", { assign: (url) => calls.push(url) });
    expect(calls).toEqual(["/cortex-compass/#session=opaque-token"]);
  });

  it("opens the mounted workspace without unloading the original Lab result", () => {
    const calls = [];
    const events = [];
    class TestCustomEvent extends Event {
      constructor(type, options) {
        super(type, options);
        this.detail = options.detail;
      }
    }
    const windowObject = {
      CustomEvent: TestCustomEvent,
      dispatchEvent: (event) => {
        events.push(event);
        event.preventDefault();
        return !event.defaultPrevented;
      },
    };
    navigateToInfoViz("opaque-token", { assign: (url) => calls.push(url) }, windowObject);
    expect(calls).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("cortex:open-compass");
    expect(events[0].cancelable).toBe(true);
    expect(events[0].detail).toEqual({ sessionId: "opaque-token" });
  });

  it("still navigates if the mounted workspace does not accept the handoff", () => {
    const calls = [];
    class TestCustomEvent extends Event {
      constructor(type, options) {
        super(type, options);
        this.detail = options.detail;
      }
    }
    navigateToInfoViz("opaque-token", { assign: (url) => calls.push(url) }, {
      CustomEvent: TestCustomEvent,
      dispatchEvent: () => true,
    });
    expect(calls).toEqual(["/cortex-compass/#session=opaque-token"]);
  });

  it("does not dispatch or navigate without a token", () => {
    const calls = [];
    const windowObject = { dispatchEvent: () => calls.push("event") };
    expect(() => navigateToInfoViz("", { assign: (url) => calls.push(url) }, windowObject)).toThrow(/token/i);
    expect(calls).toEqual([]);
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
