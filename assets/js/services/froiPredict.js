import axios from "axios";
import { uploadImages } from "./imageUploader.js";
import { SERVER_URL } from "./config";

const http = axios.create({
  timeout: 120000,
  // Cloudflare tunnels send ACAO:* + credentials=true. Browsers reject
  // credentialed requests against *; keep this uncredentialed.
  withCredentials: false,
});

export function normalizeUploadPaths(raw) {
  const list = Array.isArray(raw) ? raw : raw?.files || raw?.data || [];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.path || item?.name || "";
    })
    .filter(Boolean);
}

export function wrapPredictionResult(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw[0]?.mean || raw[0]?.sem || raw[0]?.rdm || raw[0]?.voxels) {
      return raw;
    }
    const nested = raw[0];
    if (Array.isArray(nested) && (nested[0]?.mean || nested[0]?.sem)) {
      return nested;
    }
    return raw;
  }
  if (raw.mean || raw.sem || raw.rdm || raw.voxels) return [raw];
  if (raw.data) return wrapPredictionResult(raw.data);
  return raw;
}

function toFileData(path, origName) {
  return {
    path,
    orig_name: origName,
    meta: { _type: "gradio.FileData" },
  };
}

export async function runFroiPrediction({
  uploadFiles,
  region,
  dataset,
  model,
}) {
  if (!uploadFiles?.length) {
    throw new Error("No files uploaded. Please upload files first.");
  }
  if (!region || !dataset || !model) {
    throw new Error("ROI, mapping dataset, and model are required.");
  }

  const serverKeys = uploadFiles.map((file) => file.name);
  const paths = normalizeUploadPaths(await uploadImages(uploadFiles));

  if (!paths.length) {
    throw new Error("Image upload did not return file paths from the server.");
  }

  const images = paths.map((path, i) => toFileData(path, serverKeys[i] || path.split("/").pop()));

  const payload = {
    data: [images, region, dataset, model, true, true, true],
  };

  if (import.meta.env.DEV) {
    console.log("fROI /api/predict", `${SERVER_URL}/api/predict`, {
      files: serverKeys,
      roi: region,
      dataset,
      model,
    });
  }

  const result = await http.post(`${SERVER_URL}/api/predict`, payload);
  const resultData = wrapPredictionResult(result?.data?.data ?? result?.data);

  if (!resultData) {
    throw new Error("Predict returned an empty response.");
  }

  return { resultData, serverKeys, paths };
}
