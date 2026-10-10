import { Color, MathUtils } from "three";

const NEGATIVE = new Color("#766096");
const NEUTRAL = new Color("#f4f0e6");
const POSITIVE = new Color("#c36e39");

/** The scale is fixed across uploads, with zero between its two color arms. */
export function uploadResponseColor(value, range, target = new Color()) {
  if (!Number.isFinite(value) || !Array.isArray(range) || range.length !== 2
    || !range.every(Number.isFinite) || range[0] > range[1]) {
    throw new Error("The predicted-response color range is invalid.");
  }
  const extent = (value < 0 ? Math.abs(Math.min(range[0], 0)) : Math.max(range[1], 0)) || 1;
  const normalized = MathUtils.clamp(value / extent, -1, 1);
  return target.copy(NEUTRAL).lerp(normalized < 0 ? NEGATIVE : POSITIVE, Math.abs(normalized));
}

/** Project signed raw responses; vertex identities are never approximated. */
export function projectUploadResponses(roi, hemisphere, values, vertexCount) {
  if (!Number.isInteger(vertexCount) || vertexCount <= 0
    || !Number.isInteger(roi?.responseCount) || roi.responseCount <= 0
    || !Array.isArray(values) || values.length !== roi.responseCount) {
    throw new Error("The Subject 1 response vector does not match the selected region.");
  }
  // Array.every skips holes: check every raw index explicitly instead.
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new Error("The Subject 1 response vector contains a missing or nonnumeric value.");
    }
  }
  const sparse = roi.mappings?.[hemisphere];
  if (!sparse || !Array.isArray(sparse.responseIndices)
    || !Array.isArray(sparse.vertexIndices) || !Array.isArray(sparse.weights)
    || sparse.responseIndices.length !== sparse.vertexIndices.length
    || sparse.weights.length !== sparse.vertexIndices.length) {
    throw new Error("The cortical projection metadata is incomplete.");
  }
  const sums = new Float64Array(vertexCount);
  const weightSums = new Float64Array(vertexCount);
  const contributors = new Map();
  for (let i = 0; i < sparse.weights.length; i += 1) {
    const vertex = sparse.vertexIndices[i];
    const responseIndex = sparse.responseIndices[i];
    const weight = sparse.weights[i];
    if (!Number.isInteger(vertex) || vertex < 0 || vertex >= vertexCount
      || !Number.isInteger(responseIndex) || responseIndex < 0 || responseIndex >= values.length
      || !Number.isFinite(weight) || weight <= 0) {
      throw new Error("The cortical projection contains an invalid vertex or voxel index.");
    }
    sums[vertex] += values[responseIndex] * weight;
    weightSums[vertex] += weight;
    const list = contributors.get(vertex) || [];
    list.push({ responseIndex, weight });
    contributors.set(vertex, list);
  }
  for (const vertex of contributors.keys()) {
    if (Math.abs(weightSums[vertex] - 1) > 0.00001) {
      throw new Error("The cortical projection weights are not normalized per vertex.");
    }
    sums[vertex] /= weightSums[vertex];
  }
  return { values: sums, contributors };
}

/**
 * Pick the raw source with the largest interpolated geometric weight. Ownership
 * does not depend on response magnitude and remains stable across image changes.
 */
export function dominantUploadVoxel(vertices, barycentricWeights, contributors) {
  if (vertices.length !== 3 || barycentricWeights.length !== 3
    || !barycentricWeights.every(Number.isFinite)) return null;
  const weights = new Map();
  vertices.forEach((vertex, index) => {
    for (const entry of contributors.get(vertex) || []) {
      const contribution = entry.weight * Math.max(0, barycentricWeights[index]);
      weights.set(entry.responseIndex, (weights.get(entry.responseIndex) || 0) + contribution);
    }
  });
  let winner = null;
  let strongestWeight = 0;
  for (const [responseIndex, weight] of weights) {
    if (weight > strongestWeight || (weight === strongestWeight && weight > 0
      && (winner === null || responseIndex < winner))) {
      winner = responseIndex;
      strongestWeight = weight;
    }
  }
  return winner;
}
