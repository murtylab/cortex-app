import axios from "axios";
import { INFOVIZ_URL, SERVER_URL } from "./config.js";
import { uploadImages } from "./imageUploader.js";
import { normalizeUploadPaths } from "./froiPredict.js";
import { buildCompassSessionToken, buildCortexCompassSessionUrl, COMPASS_PREPARING_URL } from "./cortexCompassNavigation.js";

const http = axios.create({
  timeout: 10 * 60 * 1000,
  withCredentials: false,
});

export const BASELINE_COMPARISON_MODELS = Object.freeze([
  "efficient_net",
  "clip_rn50",
  "vgg16_imagenet1kv1",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAdditionalModels(model, additionalModels) {
  if (!Array.isArray(additionalModels) || !additionalModels.every((value) => isNonEmptyString(value) && value === value.trim())) {
    throw new Error("Additional comparison models must be valid model identifiers.");
  }
  const models = [...new Set(additionalModels)].filter((value) => value !== model);
  if (models.length > 3) {
    throw new Error("A comparison can include at most three additional models.");
  }
  return models;
}

export function getComparisonModels(model) {
  if (!isNonEmptyString(model)) {
    throw new Error("A supported comparison model is required.");
  }
  return [model, ...normalizeAdditionalModels(model, BASELINE_COMPARISON_MODELS)];
}

export function requireSupportedComparisonModels(model, supportedModels) {
  const models = getComparisonModels(model);
  const missing = models.filter((value) => !supportedModels?.includes(value));
  if (missing.length) {
    throw new Error(`Cortex Core does not have reference data for: ${missing.join(", ")}.`);
  }
  return models;
}

export function normalizeCapabilities(raw) {
  const value = raw?.data ?? raw;
  const comparisonDataset = value?.comparison_dataset ?? value?.dataset;
  const canonicalRois = ["ffa", "ppa", "eba"];
  const hasCanonicalRois = Array.isArray(value?.rois)
    && value.rois.length === canonicalRois.length
    && new Set(value.rois).size === canonicalRois.length
    && canonicalRois.every((roi) => value.rois.includes(roi));
  const hasAvailableReference = value?.available !== true || (
    isNonEmptyString(value.reference_version) && value.reference_count === 185
  );
  if (
    value?.schema_version !== 1 ||
    (value.available !== undefined && typeof value.available !== "boolean") ||
    !Array.isArray(value.supported_models) ||
    !value.supported_models.every(isNonEmptyString) ||
    new Set(value.supported_models).size !== value.supported_models.length ||
    comparisonDataset !== "nsd_1000" ||
    !hasCanonicalRois ||
    !hasAvailableReference
  ) {
    throw new Error("Cortex Core returned an incompatible comparison manifest.");
  }

  return {
    ...value,
    comparison_dataset: comparisonDataset,
    supported_models: [...value.supported_models],
    rois: [...value.rois],
  };
}

export function normalizeCreatedSession(raw) {
  const value = raw?.data ?? raw;
  if (
    value?.schema_version !== 1 ||
    typeof value.session_id !== "string" ||
    !/^[A-Za-z0-9_-]{16,256}$/.test(value.session_id) ||
    !isNonEmptyString(value.expires_at) ||
    !Number.isFinite(Date.parse(value.expires_at))
  ) {
    throw new Error("Cortex Core returned an invalid comparison session.");
  }

  return {
    schema_version: 1,
    session_id: value.session_id,
    expires_at: value.expires_at,
  };
}

export function getComparisonErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof detail?.message === "string" && detail.message.trim()) return detail.message;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return "Cortex-Compass could not be opened. Your original result is still available.";
}

export async function getComparisonCapabilities() {
  const response = await http.get(`${SERVER_URL}/comparison/capabilities`);
  return normalizeCapabilities(response.data);
}

export async function uploadComparisonStimuli(files, displayNames = []) {
  const paths = normalizeUploadPaths(await uploadImages(files));
  if (paths.length !== files.length) {
    throw new Error("Not all stimuli could be uploaded for the comparison.");
  }

  return paths.map((path, index) => ({
    path,
    display_name: displayNames[index] || files[index]?.name || `stimulus-${index + 1}`,
  }));
}

export async function createVisualizationSession({ stimuli, model, sourceRequest, additionalModels = BASELINE_COMPARISON_MODELS }) {
  if (!Array.isArray(stimuli) || stimuli.length === 0) {
    throw new Error("No uploaded stimuli are available for comparison.");
  }
  if (!isNonEmptyString(model)) {
    throw new Error("A supported comparison model is required.");
  }
  const additionalModelsForSession = normalizeAdditionalModels(model, additionalModels);

  const models = [model, ...additionalModelsForSession];
  const requestStimuli = stimuli.map(({ path, display_name }) => ({ path, display_name }));
  const requestSource = {
    model: sourceRequest.model,
    dataset: sourceRequest.dataset,
    roi: sourceRequest.roi,
  };
  const sessions = [];
  // Use the existing single-model contract. Serial requests keep GPU loading
  // bounded and all models receive the exact same uploaded paths and settings.
  for (const comparisonModel of models) {
    try {
      const response = await http.post(`${SERVER_URL}/comparison-sessions`, {
        stimuli: requestStimuli,
        model: comparisonModel,
        source_request: requestSource,
      });
      sessions.push(normalizeCreatedSession(response.data));
    } catch (error) {
      throw new Error(`Comparison for ${comparisonModel} failed: ${getComparisonErrorMessage(error)}`);
    }
  }

  const earliestExpiry = sessions.reduce((earliest, session) => (
    Date.parse(session.expires_at) < Date.parse(earliest) ? session.expires_at : earliest
  ), sessions[0].expires_at);
  return {
    schema_version: 1,
    session_id: buildCompassSessionToken(sessions.map((session) => session.session_id)),
    expires_at: earliestExpiry,
  };
}

export function buildInfoVizSessionUrl(sessionId) {
  if (!isNonEmptyString(sessionId)) {
    throw new Error("A comparison session token is required.");
  }
  return `${INFOVIZ_URL}/#session=${encodeURIComponent(sessionId)}`;
}

const pendingVisualizationTabs = new WeakMap();

function isPendingVisualizationTab(comparisonTab, expectedOrigin) {
  try {
    const href = comparisonTab.location.href;
    if (href === "about:blank") return true;
    const location = new URL(href);
    return location.pathname + location.search === COMPASS_PREPARING_URL
      && !location.hash
      && (!expectedOrigin || location.origin === expectedOrigin);
  } catch {
    // A tab navigated to another origin is no longer ours to modify.
    return false;
  }
}

export function closeVisualizationTab(comparisonTab) {
  try {
    if (comparisonTab && !comparisonTab.closed && pendingVisualizationTabs.has(comparisonTab)
      && isPendingVisualizationTab(comparisonTab, pendingVisualizationTabs.get(comparisonTab))) {
      comparisonTab.close();
    }
  } catch {
    // Closing a caller-owned pending tab must not hide the original error.
  }
}

/** Reserve the tab directly from a click, before comparison requests are awaited. */
export function openVisualizationTab(windowObject = globalThis.window) {
  const blockedMessage = "Please allow pop-ups for this site, then open Cortex-Compass again.";
  let comparisonTab;
  try {
    comparisonTab = windowObject?.open(COMPASS_PREPARING_URL, "_blank");
  } catch {
    throw new Error(blockedMessage);
  }
  if (!comparisonTab || comparisonTab.closed) throw new Error(blockedMessage);
  pendingVisualizationTabs.set(comparisonTab, windowObject?.location?.origin);
  try {
    // Keep the tab reference for the asynchronous handoff, but deny opener access.
    comparisonTab.opener = null;
  } catch {
    closeVisualizationTab(comparisonTab);
    throw new Error("Cortex-Compass could not open a secure comparison tab. Please try again.");
  }
  return comparisonTab;
}

export function navigateToInfoViz(
  sessionId,
  comparisonTab,
  windowObject = globalThis.window,
) {
  // Validate before reserving a tab so malformed requests cannot leave pending tabs.
  const hostUrl = buildCortexCompassSessionUrl(sessionId);
  const targetTab = comparisonTab ?? openVisualizationTab(windowObject);
  if (targetTab.closed) {
    throw new Error("The Cortex-Compass tab was closed. Open Cortex-Compass again to continue.");
  }
  if (!isPendingVisualizationTab(targetTab,
    pendingVisualizationTabs.get(targetTab) ?? windowObject?.location?.origin)) {
    throw new Error("The Cortex-Compass tab was navigated away from. Open Cortex-Compass again to continue.");
  }
  targetTab.location.replace(hostUrl);
  pendingVisualizationTabs.delete(targetTab);
  try {
    targetTab.focus?.();
  } catch {
    // Browser focus preferences do not affect a successful comparison handoff.
  }
  return targetTab;
}

export function canExplorePrediction({ showResults, predictionResult, predictionLoading, snapshot }) {
  return Boolean(showResults && predictionResult && snapshot && !predictionLoading);
}
