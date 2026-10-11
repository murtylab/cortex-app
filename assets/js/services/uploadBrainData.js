// NSD-1000 readouts concatenate subjects during training. The prediction API
// already separates them: anatomical rendering must use only the raw s1 ROI.
const SUBJECT1_ROI_COUNTS = Object.freeze({
  eba: 518, fba: 35, ffa: 156, ofa: 13, opa: 64, ppa: 170, rsc: 38, vwfa: 232,
});
const RESPONSE_SPACE = "nsd_1000_subject1_floc_t7_v1";
const SHA256 = /^[a-f0-9]{64}$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const nonempty = (value) => typeof value === "string" && value.length > 0;

function validateMapping(mapping, region) {
  if (
    !mapping || mapping.schemaVersion !== 1 || mapping.subjectId !== "s1" ||
    mapping.responseSpace !== RESPONSE_SPACE || mapping.responseOrdering !== "zyx-c-order" ||
    mapping.fLocThreshold !== 7 || mapping.fLocThresholdOperator !== ">" ||
    mapping.mapper !== "linenn" || mapping.normalizationPolicy !== "per-surface-vertex" ||
    mapping.trainingSelection?.dataset !== "nsd_1000" || mapping.trainingSelection?.subject !== "s1" ||
    mapping.trainingSelection?.coordinateOrdering !== "NumPy boolean indexing, z/y/x C-order" ||
    mapping.trainingSelection?.threshold !== "strict fLoc t > 7" ||
    !SHA256.test(mapping.surface?.sha256 || "") ||
    !Array.isArray(mapping.volumeShapeXyz) || !mapping.volumeShapeXyz.every(Number.isInteger) ||
    mapping.volumeShapeXyz.join(",") !== "83,104,81"
  ) return null;

  const roi = mapping.rois?.[region];
  const count = SUBJECT1_ROI_COUNTS[region];
  if (
    !count || roi?.responseCount !== count || roi.label !== region.toUpperCase() ||
    !SHA256.test(roi.orderedCoordinateSha256 || "") ||
    !Array.isArray(roi.volumeCoordinatesZyx) || roi.volumeCoordinatesZyx.length !== count ||
    !Array.isArray(roi.volumeLinearIndicesXyz) || roi.volumeLinearIndicesXyz.length !== count ||
    !Array.isArray(roi.hemispheres) || roi.hemispheres.length !== count ||
    !Array.isArray(roi.unmappedResponseIndices)
  ) return null;

  const [nx, ny, nz] = mapping.volumeShapeXyz;
  let previous = -1;
  for (let index = 0; index < count; index += 1) {
    const coordinate = roi.volumeCoordinatesZyx[index];
    if (!Array.isArray(coordinate) || coordinate.length !== 3) return null;
    const [z, y, x] = coordinate;
    if (![x, y, z].every(Number.isInteger) || x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) return null;
    const responseOrderIndex = (z * ny + y) * nx + x;
    if (responseOrderIndex <= previous || roi.volumeLinearIndicesXyz[index] !== x * ny * nz + y * nz + z) return null;
    previous = responseOrderIndex;
    if (!["lh", "rh", "unmapped"].includes(roi.hemispheres[index])) return null;
  }

  const mapped = new Set();
  for (const hemi of ["lh", "rh"]) {
    const surface = mapping.surface?.hemispheres?.[hemi];
    const projection = roi.mappings?.[hemi];
    if (
      surface?.sourceVertexOrderPreserved !== true || surface.node !== `base_${hemi}` ||
      !Number.isInteger(surface.vertexCount) || surface.vertexCount <= 0 ||
      !SHA256.test(surface.indicesSha256 || "") ||
      !Number.isFinite(surface.correspondenceMaxErrorMm) || surface.correspondenceMaxErrorMm < 0 ||
      surface.correspondenceMaxErrorMm > 0.001 ||
      !projection || !Array.isArray(projection.responseIndices) ||
      !Array.isArray(projection.vertexIndices) || !Array.isArray(projection.weights) ||
      projection.responseIndices.length !== projection.vertexIndices.length ||
      projection.responseIndices.length !== projection.weights.length
    ) return null;
    const weightSums = new Map();
    for (let edge = 0; edge < projection.weights.length; edge += 1) {
      const response = projection.responseIndices[edge];
      const vertex = projection.vertexIndices[edge];
      const weight = projection.weights[edge];
      if (
        !Number.isInteger(response) || response < 0 || response >= count ||
        !Number.isInteger(vertex) || vertex < 0 || vertex >= surface.vertexCount ||
        !Number.isFinite(weight) || weight <= 0 || weight > 1
      ) return null;
      mapped.add(response);
      weightSums.set(vertex, (weightSums.get(vertex) || 0) + weight);
    }
    for (const sum of weightSums.values()) {
      if (Math.abs(sum - 1) > 0.00001) return null;
    }
  }
  const unmapped = new Set(roi.unmappedResponseIndices);
  if (unmapped.size !== roi.unmappedResponseIndices.length || roi.mappedResponseCount !== mapped.size) return null;
  for (const index of unmapped) {
    if (!Number.isInteger(index) || index < 0 || index >= count || mapped.has(index)) return null;
  }
  for (let index = 0; index < count; index += 1) {
    if (mapped.has(index) === unmapped.has(index) || (roi.hemispheres[index] === "unmapped") !== unmapped.has(index)) return null;
  }
  return roi;
}

/** Keep result ownership independent of grouping, image previews, and server keys. */
export function getInferenceContextKey(settings, files) {
  return JSON.stringify([
    settings?.dataset || "", settings?.model || "", (settings?.region || "").toLowerCase(),
    settings?.voxelOption || '', settings?.voxelNumber || '', settings?.paper || '',
    settings?.participantName || '', settings?.prestoreDataset || '',
    Array.isArray(files) ? files.map((file) => file.uid) : [],
  ]);
}

/** Build a strictly validated map from only the currently loaded input images. */
export function buildUploadBrainData({ predictionResult, files, dataset, region, model, mapping }) {
  const selectedRegion = typeof region === "string" ? region.toLowerCase() : "";
  const unavailable = (reason) => ({ status: "unavailable", reason, images: [], region: selectedRegion, model });
  if (dataset !== "nsd_1000") {
    return unavailable("The Subject 1 brain map requires NSD-1000 mapping. Other mapping datasets do not share this anatomy.");
  }
  const roi = validateMapping(mapping, selectedRegion);
  if (!roi) return unavailable("The Subject 1 voxel mapping could not be verified for this region.");
  if (!nonempty(model) || !Array.isArray(files) || files.length === 0) {
    return unavailable("Run inference on your loaded images to view their brain predictions.");
  }
  const result = Array.isArray(predictionResult) ? predictionResult[0] : predictionResult;
  const voxels = result?.voxels;
  if (!voxels || typeof voxels !== "object" || Array.isArray(voxels)) {
    return unavailable("Raw Subject 1 voxel predictions are unavailable. Run inference again.");
  }

  const ids = new Set();
  const aliases = new Map();
  for (const file of files) {
    if (!file || !nonempty(file.uid) || ids.has(file.uid)) return unavailable("Loaded image identities are not unique; run inference again.");
    ids.add(file.uid);
    for (const alias of new Set([file.serverKey, file.uid, file.file?.name].filter(nonempty))) {
      if (!aliases.has(alias)) aliases.set(alias, new Set());
      aliases.get(alias).add(file.uid);
    }
  }

  const images = [];
  const usedKeys = new Set();
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const file of files) {
    const candidates = [...new Set([file.serverKey, file.uid, file.file?.name].filter(nonempty))];
    const key = candidates.find((candidate) => own(voxels, candidate));
    if (!key || aliases.get(key)?.size !== 1 || usedKeys.has(key)) {
      return unavailable("Predictions could not be matched uniquely to every loaded image. Run inference again.");
    }
    usedKeys.add(key);
    const values = voxels[key]?.s1?.[selectedRegion];
    if (
      !Array.isArray(values) || values.length !== roi.responseCount || !nonempty(file.blobURL)
    ) return unavailable("Complete raw Subject 1 predictions and previews are required for every loaded image. Run inference again.");
    for (const value of values) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return unavailable("Complete raw Subject 1 predictions and previews are required for every loaded image. Run inference again.");
      }
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    images.push({ id: file.uid, name: file.label || file.file?.name || file.uid, url: file.blobURL, values });
  }
  return { status: "ready", images, roi, region: selectedRegion, model, range: [minimum, maximum] };
}

/** Highest signed raw response, with ties resolved by current input order. */
export function getVoxelWinner(images, responseIndex) {
  if (!Array.isArray(images) || !Number.isInteger(responseIndex) || responseIndex < 0) return null;
  let winner = null;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const value = image?.values?.[responseIndex];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (!winner || value > winner.value) winner = { image, index, value };
  }
  return winner;
}

/** Disambiguate previews using current groups without changing prediction IDs. */
export function getBrainImageLabels(images, files) {
  const currentImages = Array.isArray(images) ? images : [];
  const filesById = new Map((Array.isArray(files) ? files : []).map((file) => [file.uid, file]));
  const nameCounts = new Map();
  for (const image of currentImages) nameCounts.set(image.name, (nameCounts.get(image.name) || 0) + 1);

  const proposed = currentImages.map((image, index) => {
    if (nameCounts.get(image.name) === 1) return image.name;
    const group = filesById.get(image.id)?.groupKey;
    return `${group && group !== "Ungrouped" ? group : `Image ${index + 1}`} · ${image.name}`;
  });
  const labelCounts = new Map();
  for (const label of proposed) labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  const reserved = new Set(proposed);
  const used = new Set();
  const labels = new Map();
  for (const [index, image] of currentImages.entries()) {
    const proposal = proposed[index];
    let label = proposal;
    if (labelCounts.get(proposal) > 1) {
      const suffix = `${proposal} · Image ${index + 1}`;
      label = suffix;
      let collision = 2;
      while (reserved.has(label) || used.has(label)) {
        label = `${suffix} (${collision})`;
        collision += 1;
      }
    }
    used.add(label);
    labels.set(image.id, label);
  }
  return labels;
}
