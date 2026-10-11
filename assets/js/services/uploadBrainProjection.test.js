import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Color, SRGBColorSpace } from "three";
import { displayResponseExtent, dominantUploadVoxel, projectUploadResponses, uploadResponseColor } from "./uploadBrainProjection.js";

const mapping = JSON.parse(readFileSync(new URL("../../brainModel/subject1-prediction-mapping.json", import.meta.url)));
const example = () => ({
  responseCount: 3,
  mappings: {
    lh: { responseIndices: [0, 1, 2, 0], vertexIndices: [1, 1, 3, 4], weights: [0.25, 0.75, 1, 1] },
    rh: { responseIndices: [1], vertexIndices: [0], weights: [1] },
  },
});

test("projects signed raw values with exact sparse source and vertex identities", () => {
  const roi = example();
  const values = [-4, 2, 7];
  const snapshot = structuredClone(roi);
  const projected = projectUploadResponses(roi, "lh", values, 6);
  assert.deepEqual(Array.from(projected.values), [0, 0.5, 0, 7, -4, 0]);
  assert.deepEqual([...projected.contributors.keys()], [1, 3, 4]);
  assert.deepEqual(projected.contributors.get(1), [{ responseIndex: 0, weight: 0.25 }, { responseIndex: 1, weight: 0.75 }]);
  assert.equal(projected.contributors.has(0), false);
  assert.deepEqual(roi, snapshot);
  assert.deepEqual(values, [-4, 2, 7]);
});

for (const [region, roi] of Object.entries(mapping.rois)) {
  test(`projects the published bilateral ${region.toUpperCase()} mapper without reordering raw voxels`, () => {
    const values = Array.from({ length: roi.responseCount }, (_, index) => index % 2 === 0 ? -index - 1 : index + 1);
    const supportedResponses = new Set();
    for (const hemisphere of ["lh", "rh"]) {
      const projected = projectUploadResponses(roi, hemisphere, values, mapping.surface.hemispheres[hemisphere].vertexCount);
      const sparse = roi.mappings[hemisphere];
      const expected = new Map();
      sparse.weights.forEach((weight, index) => {
        const vertex = sparse.vertexIndices[index];
        const responseIndex = sparse.responseIndices[index];
        supportedResponses.add(responseIndex);
        const row = expected.get(vertex) || { sum: 0, weights: 0 };
        row.sum += values[responseIndex] * weight;
        row.weights += weight;
        expected.set(vertex, row);
      });
      assert.equal(projected.contributors.size, expected.size);
      for (const [vertex, row] of expected) {
        assert.ok(Math.abs(projected.values[vertex] - row.sum / row.weights) < 1e-10);
        for (const contribution of projected.contributors.get(vertex)) {
          assert.equal(roi.hemispheres[contribution.responseIndex], hemisphere);
        }
      }
    }
    assert.equal(supportedResponses.size, roi.mappedResponseCount);
    for (const responseIndex of roi.unmappedResponseIndices) assert.equal(supportedResponses.has(responseIndex), false);
  });
}

test("rejects missing, nonfinite, nonnumeric, sparse and wrong-length raw vectors", () => {
  for (const values of [undefined, null, [], [-4, 2], [-4, 2, 7, 9], [-4, NaN, 7], [-4, Infinity, 7], [-4, "2", 7], [-4, null, 7]]) {
    assert.throws(() => projectUploadResponses(example(), "lh", values, 6));
  }
  const values = [-4, 2, 7];
  delete values[1];
  assert.throws(() => projectUploadResponses(example(), "lh", values, 6), /missing or nonnumeric/);
});

test("rejects malformed metadata and invalid sparse vertex, voxel and weight indices", () => {
  const invalid = [
    (roi) => { roi.mappings.lh.weights.pop(); },
    (roi) => { roi.mappings.lh.weights[0] = 0; },
    (roi) => { roi.mappings.lh.weights[0] = NaN; },
    (roi) => { roi.mappings.lh.vertexIndices[0] = 6; },
    (roi) => { roi.mappings.lh.vertexIndices[0] = -1; },
    (roi) => { roi.mappings.lh.vertexIndices[0] = 0.5; },
    (roi) => { roi.mappings.lh.responseIndices[0] = 3; },
    (roi) => { roi.mappings.lh.responseIndices[0] = "0"; },
    (roi) => { roi.mappings.lh = undefined; },
  ];
  for (const change of invalid) {
    const roi = example();
    change(roi);
    assert.throws(() => projectUploadResponses(roi, "lh", [-4, 2, 7], 6));
  }
  assert.throws(() => projectUploadResponses(example(), "lh", [-4, 2, 7], 0));
});

test("requires per-vertex normalization rather than silently accepting different projection methods", () => {
  const roi = example();
  roi.mappings.lh.weights[0] = 0.4;
  assert.throws(() => projectUploadResponses(roi, "lh", [-4, 2, 7], 6), /not normalized/);
  roi.mappings.lh.weights[0] = 0.25000001;
  assert.doesNotThrow(() => projectUploadResponses(roi, "lh", [-4, 2, 7], 6));
});

test("the symmetric display extent preserves signed magnitudes across asymmetric data", () => {
  const range = [-2, 6];
  assert.equal(displayResponseExtent(range), 6);
  assert.equal(displayResponseExtent([-6, 2]), 6);
  assert.equal(displayResponseExtent([0, 0]), 1);
  assert.equal(uploadResponseColor(-6, range).getHexString(), "2a5c9e");
  assert.equal(uploadResponseColor(0, range).getHexString(), "f2efe8");
  assert.equal(uploadResponseColor(6, range).getHexString(), "b4302a");
  assert.notEqual(uploadResponseColor(-2, range).getHexString(), "2a5c9e");
  assert.ok(uploadResponseColor(-2, range).equals(uploadResponseColor(-2, [-6, 2])));
  assert.ok(uploadResponseColor(2, range).equals(uploadResponseColor(2, [-6, 2])));
});

test("interpolates palette channels in sRGB before converting to linear vertex colors", () => {
  const blend = (endpoint, amount) => {
    const neutral = [242, 239, 232];
    const channels = neutral.map((channel, index) => (channel + (endpoint[index] - channel) * amount) / 255);
    return new Color().setRGB(...channels, SRGBColorSpace);
  };
  for (const amount of [0.1, 1 / 3, 0.5, 0.9]) {
    const negative = uploadResponseColor(-6 * amount, [-2, 6]);
    const positive = uploadResponseColor(6 * amount, [-2, 6]);
    const expectedNegative = blend([42, 92, 158], amount);
    const expectedPositive = blend([180, 48, 42], amount);
    for (const channel of ["r", "g", "b"]) {
      assert.ok(Math.abs(negative[channel] - expectedNegative[channel]) < 1e-12);
      assert.ok(Math.abs(positive[channel] - expectedPositive[channel]) < 1e-12);
    }
  }
  const target = new Color();
  assert.equal(uploadResponseColor(0, [-2, 6], target), target);
  assert.equal(target.getHexString(), "f2efe8");
});

test("one-sided and zero-response sets preserve zero and safely clamp values", () => {
  assert.equal(uploadResponseColor(0, [0, 0]).getHexString(), "f2efe8");
  assert.equal(uploadResponseColor(3, [1, 3]).getHexString(), "b4302a");
  assert.equal(uploadResponseColor(-5, [-5, -1]).getHexString(), "2a5c9e");
  assert.equal(uploadResponseColor(300, [-2, 6]).getHexString(), "b4302a");
  assert.equal(uploadResponseColor(-300, [-2, 6]).getHexString(), "2a5c9e");
  for (const range of [undefined, null, [], [1], [1, 2, 3], [5, -1], [NaN, 2], [-1, Infinity], ["-1", 2], new Array(2)]) {
    assert.throws(() => displayResponseExtent(range), /invalid/);
    assert.throws(() => uploadResponseColor(1, range), /invalid/);
  }
  assert.throws(() => uploadResponseColor(NaN, [-2, 6]));
  assert.throws(() => uploadResponseColor(Infinity, [-2, 6]));
});

test("hover uses combined barycentric geometric contributions, not a vertex index", () => {
  const contributors = new Map([
    [10, [{ responseIndex: 2, weight: 1 }]],
    [20, [{ responseIndex: 2, weight: 1 }]],
    [30, [{ responseIndex: 5, weight: 1 }]],
  ]);
  assert.equal(dominantUploadVoxel([10, 20, 30], [0.3, 0.3, 0.4], contributors), 2);
  assert.equal(dominantUploadVoxel([10, 20, 30], [0.1, 0.1, 0.8], contributors), 5);
  assert.equal(dominantUploadVoxel([0, 1, 2], [0.3, 0.3, 0.4], contributors), null);
});

test("hover ownership ties break by raw source index and are invariant across images", () => {
  const roi = example();
  roi.mappings.lh.weights = [0.5, 0.5, 1, 1];
  const first = projectUploadResponses(roi, "lh", [-4000, 2, 7], 6);
  const second = projectUploadResponses(roi, "lh", [0.001, 9000, -7], 6);
  assert.equal(dominantUploadVoxel([1, 3, 4], [1, 0, 0], first.contributors), 0);
  assert.equal(dominantUploadVoxel([1, 3, 4], [1, 0, 0], second.contributors), 0);
  const reverse = new Map([[1, [...first.contributors.get(1)].reverse()]]);
  assert.equal(dominantUploadVoxel([1, 3, 4], [1, 0, 0], reverse), 0);
});
