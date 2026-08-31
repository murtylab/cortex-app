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

  it("puts only the encoded token in the InfoViz fragment", () => {
    const url = buildInfoVizSessionUrl("opaque token/with?chars");
    expect(url).toMatch(/\/#session=opaque%20token%2Fwith%3Fchars$/);
    expect(url).not.toContain("path=");
  });

  it("navigates only after receiving a token", () => {
    const calls = [];
    navigateToInfoViz("opaque-token", { assign: (url) => calls.push(url) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/#session=opaque-token$/);
  });

  it("shows Explore only for a completed prediction with a request snapshot", () => {
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
});
