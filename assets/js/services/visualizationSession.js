import axios from "axios";
import { INFOVIZ_URL, SERVER_URL } from "./config.js";
import { uploadImages } from "./imageUploader.js";
import { normalizeUploadPaths } from "./froiPredict.js";

const http = axios.create({
  timeout: 10 * 60 * 1000,
  withCredentials: false,
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
    !isNonEmptyString(value.session_id) ||
    !isNonEmptyString(value.expires_at)
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
  return "The NSD comparison could not be prepared. Your original result is still available.";
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

export async function createVisualizationSession({ stimuli, model, sourceRequest }) {
  if (!Array.isArray(stimuli) || stimuli.length === 0) {
    throw new Error("No uploaded stimuli are available for comparison.");
  }
  if (!isNonEmptyString(model)) {
    throw new Error("A supported comparison model is required.");
  }

  const response = await http.post(`${SERVER_URL}/comparison-sessions`, {
    stimuli: stimuli.map(({ path, display_name }) => ({ path, display_name })),
    model,
    source_request: {
      model: sourceRequest.model,
      dataset: sourceRequest.dataset,
      roi: sourceRequest.roi,
    },
  });

  return normalizeCreatedSession(response.data);
}

export function buildInfoVizSessionUrl(sessionId) {
  if (!isNonEmptyString(sessionId)) {
    throw new Error("A comparison session token is required.");
  }
  return `${INFOVIZ_URL}/#session=${encodeURIComponent(sessionId)}`;
}

export function navigateToInfoViz(sessionId, locationObject = window.location) {
  locationObject.assign(buildInfoVizSessionUrl(sessionId));
}

export function canExplorePrediction({ showResults, predictionResult, predictionLoading, snapshot }) {
  return Boolean(showResults && predictionResult && snapshot && !predictionLoading);
}
