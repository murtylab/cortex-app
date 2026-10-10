import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildUploadBrainData, getInferenceContextKey, getVoxelWinner } from "./uploadBrainData.js";

const mapping = JSON.parse(readFileSync(new URL("../../brainModel/subject1-prediction-mapping.json", import.meta.url)));
const makeFile = (uid = "one", name = `${uid}.png`) => ({ uid, serverKey: `${uid}-server.png`, label: name, blobURL: `blob:${uid}`, file: { name } });
const row = (value = 1, region = "ffa") => ({ s1: { [region]: Array(mapping.rois[region].responseCount).fill(value) }, s2: { [region]: [99999] } });
const inputs = (overrides = {}) => {
  const files = [makeFile("one"), makeFile("two")];
  return {
    predictionResult: [{ voxels: { [files[0].serverKey]: row(-2), [files[1].serverKey]: row(3) }, mean: { one: 10000, two: -10000 } }],
    files, dataset: "nsd_1000", region: "ffa", model: "clip_rn50", mapping, ...overrides,
  };
};

test("uses exact Subject 1 raw vectors, never pooled summaries or other subjects", () => {
  const args = inputs();
  const data = buildUploadBrainData(args);
  assert.equal(data.status, "ready");
  assert.deepEqual(data.images.map(({ id, name, url, values }) => ({ id, name, url, value: values[0] })), [
    { id: "one", name: "one.png", url: "blob:one", value: -2 },
    { id: "two", name: "two.png", url: "blob:two", value: 3 },
  ]);
  assert.equal(data.roi, mapping.rois.ffa);
  assert.deepEqual(data.range, [-2, 3]);
  assert.equal(data.images[0].values, args.predictionResult[0].voxels[args.files[0].serverKey].s1.ffa);
});

for (const region of Object.keys(mapping.rois)) {
  test(`accepts the verified ${region.toUpperCase()} mapping and exact training response length`, () => {
    const file = makeFile();
    const data = buildUploadBrainData(inputs({ region: region.toUpperCase(), files: [file], predictionResult: [{ voxels: { [file.serverKey]: row(0.25, region) } }] }));
    assert.equal(data.status, "ready");
    assert.equal(data.region, region);
    assert.equal(data.images.length, 1);
    assert.deepEqual(data.range, [0.25, 0.25]);
    assert.equal(data.images[0].values.length, mapping.rois[region].responseCount);
  });
}

test("rejects Murty-185, unknown datasets and unknown regions even with plausible Subject 1 data", () => {
  for (const dataset of ["murty185", "unknown", undefined]) assert.equal(buildUploadBrainData(inputs({ dataset })).status, "unavailable");
  assert.equal(buildUploadBrainData(inputs({ region: "unknown" })).status, "unavailable");
});

test("fails closed if any currently loaded image lacks a valid Subject 1 selected-ROI row", () => {
  const invalidRows = [undefined, { s2: { ffa: Array(156).fill(1) } }, { s1: { ppa: Array(170).fill(1) } }, { s1: { ffa: Array(155).fill(1) } }, { s1: { ffa: Array(157).fill(1) } }];
  for (const invalid of invalidRows) {
    const args = inputs();
    args.predictionResult[0].voxels[args.files[1].serverKey] = invalid;
    const data = buildUploadBrainData(args);
    assert.equal(data.status, "unavailable");
    assert.deepEqual(data.images, []);
  }
});

test("rejects all nonfinite and nonnumeric response values, including numeric strings", () => {
  for (const value of [NaN, Infinity, -Infinity, null, undefined, "1"]) {
    const args = inputs();
    args.predictionResult[0].voxels[args.files[0].serverKey].s1.ffa[100] = value;
    assert.equal(buildUploadBrainData(args).status, "unavailable");
  }
  const sparse = inputs();
  delete sparse.predictionResult[0].voxels[sparse.files[0].serverKey].s1.ffa[100];
  assert.equal(buildUploadBrainData(sparse).status, "unavailable");
});

test("missing results, input images, model or previews have a clear unavailable state", () => {
  for (const overrides of [{ predictionResult: null }, { predictionResult: [{}] }, { files: [] }, { files: [null] }, { model: "" }, { files: [{ ...makeFile(), blobURL: "" }] }]) {
    const data = buildUploadBrainData(inputs(overrides));
    assert.equal(data.status, "unavailable");
    assert.ok(data.reason.length > 0);
    assert.deepEqual(data.images, []);
  }
});

test("matches by explicit server key before UID and unique original name, not dictionary order", () => {
  const first = makeFile("one");
  const second = makeFile("two");
  const predictionResult = [{ voxels: { [second.serverKey]: row(2), [first.uid]: row(20), [first.file.name]: row(30), [first.serverKey]: row(1) } }];
  const data = buildUploadBrainData(inputs({ files: [first, second], predictionResult }));
  assert.deepEqual(data.images.map((image) => image.values[0]), [1, 2]);
  const reversed = buildUploadBrainData(inputs({ files: [second, first], predictionResult }));
  assert.deepEqual(reversed.images.map((image) => image.values[0]), [2, 1]);
});

test("supports exact UID and unique file-name fallbacks without guessing", () => {
  const first = makeFile("one");
  const second = makeFile("two");
  const data = buildUploadBrainData(inputs({ files: [first, second], predictionResult: { voxels: { [first.uid]: row(1), [second.file.name]: row(2) } } }));
  assert.equal(data.status, "ready");
  assert.deepEqual(data.images.map((image) => image.values[0]), [1, 2]);
});

test("duplicate original filenames are safe with distinct server identities, ambiguous fallbacks are rejected", () => {
  const files = [makeFile("one", "same.png"), makeFile("two", "same.png")];
  assert.equal(buildUploadBrainData(inputs({ files })).status, "ready");
  assert.equal(buildUploadBrainData(inputs({ files, predictionResult: [{ voxels: { "same.png": row(7) } }] })).status, "unavailable");
  assert.equal(buildUploadBrainData(inputs({ files: [files[0], { ...files[1], serverKey: files[0].serverKey }] })).status, "unavailable");
  assert.equal(buildUploadBrainData(inputs({ files: [files[0], { ...files[1], uid: files[0].uid }] })).status, "unavailable");
});

test("uses only current loaded images, excluding old predictions and extra rows", () => {
  const args = inputs();
  args.predictionResult[0].voxels.unrelated = row(999999);
  args.files = [args.files[0]];
  const data = buildUploadBrainData(args);
  assert.equal(data.status, "ready");
  assert.deepEqual(data.images.map((image) => image.id), ["one"]);
  assert.deepEqual(data.range, [-2, -2]);
  assert.equal(getVoxelWinner(data.images, 0).image.id, "one");
});

test("rejects unverifiable mapping identity, threshold, ordering and surface topology", () => {
  const mutations = [
    (m) => { m.schemaVersion = 2; }, (m) => { m.subjectId = "s2"; },
    (m) => { m.responseSpace = "other"; }, (m) => { m.responseOrdering = "xyz"; },
    (m) => { m.fLocThreshold = 3.3; }, (m) => { m.fLocThresholdOperator = ">="; },
    (m) => { m.mapper = "nearest"; }, (m) => { m.normalizationPolicy = "none"; },
    (m) => { m.trainingSelection.dataset = "murty185"; }, (m) => { m.trainingSelection.subject = "s2"; },
    (m) => { m.trainingSelection.coordinateOrdering = "x/y/z"; }, (m) => { m.trainingSelection.threshold = "t >= 7"; },
    (m) => { m.surface.sha256 = "invalid"; }, (m) => { m.surface.hemispheres.lh.sourceVertexOrderPreserved = false; },
    (m) => { m.surface.hemispheres.rh.node = "wrong"; }, (m) => { m.surface.hemispheres.rh.correspondenceMaxErrorMm = 1; },
    (m) => { m.volumeShapeXyz = [83, 81, 104]; }, (m) => { m.volumeShapeXyz = ["83", "104", "81"]; },
    (m) => { m.surface.hemispheres.lh.correspondenceMaxErrorMm = -1; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(mapping);
    mutate(invalid);
    assert.equal(buildUploadBrainData(inputs({ mapping: invalid })).status, "unavailable");
  }
});

test("rejects inconsistent coordinates, response counts, projection edges and normalized weights", () => {
  const mutations = [
    (r) => { r.responseCount += 1; }, (r) => { r.orderedCoordinateSha256 = "invalid"; },
    (r) => { r.volumeCoordinatesZyx.pop(); }, (r) => { r.volumeCoordinatesZyx[0][0] = -1; },
    (r) => { [r.volumeCoordinatesZyx[0], r.volumeCoordinatesZyx[1]] = [r.volumeCoordinatesZyx[1], r.volumeCoordinatesZyx[0]]; },
    (r) => { r.volumeLinearIndicesXyz[0] += 1; }, (r) => { r.hemispheres[0] = "unmapped"; },
    (r) => { r.mappedResponseCount -= 1; }, (r) => { r.unmappedResponseIndices.push(0); },
    (r) => { r.mappings.lh.responseIndices[0] = r.responseCount; },
    (r) => { r.mappings.lh.vertexIndices[0] = mapping.surface.hemispheres.lh.vertexCount; },
    (r) => { r.mappings.lh.weights[0] = NaN; }, (r) => { r.mappings.lh.weights[0] = -1; },
    (r) => { r.mappings.lh.weights[0] = 0.1; }, (r) => { r.mappings.lh.weights.pop(); },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(mapping);
    mutate(invalid.rois.ffa);
    assert.equal(buildUploadBrainData(inputs({ mapping: invalid })).status, "unavailable");
  }
});

test("winner compares signed raw values and deterministically retains the first tied image", () => {
  const images = [{ id: "negative", values: [-100, 4, -3] }, { id: "less-negative", values: [-2, 4, -4] }];
  assert.deepEqual(getVoxelWinner(images, 0), { image: images[1], index: 1, value: -2 });
  assert.deepEqual(getVoxelWinner(images, 1), { image: images[0], index: 0, value: 4 });
  assert.equal(getVoxelWinner(images, 2).image.id, "negative");
});

test("winner fails closed on an invalid index or an incomplete/nonfinite image row", () => {
  for (const index of [-1, 0.1, NaN, Infinity, "0"]) assert.equal(getVoxelWinner([{ values: [1] }], index), null);
  assert.equal(getVoxelWinner([], 0), null);
  assert.equal(getVoxelWinner([{ values: [2] }, { values: [NaN] }], 0), null);
  assert.equal(getVoxelWinner([{ values: [2] }, { values: [] }], 0), null);
  assert.equal(getVoxelWinner([{ values: [2] }], 1), null);
});

test("inference context tracks current settings and image order but ignores presentation/server-key changes", () => {
  const files = [makeFile("one"), makeFile("two")];
  const settings = { dataset: "nsd_1000", model: "clip_rn50", region: "ffa" };
  const key = getInferenceContextKey(settings, files);
  assert.equal(getInferenceContextKey({ ...settings, region: "FFA" }, files.map((file) => ({ ...file, groupKey: "new", serverKey: "changed", label: "renamed" }))), key);
  for (const change of [{ dataset: "murty185" }, { model: "resnet50" }, { region: "ppa" },
    { voxelOption: "custom" }, { voxelNumber: "5" }, { paper: "other" },
    { participantName: "s2" }, { prestoreDataset: "preloaded" }]) assert.notEqual(getInferenceContextKey({ ...settings, ...change }, files), key);
  assert.notEqual(getInferenceContextKey(settings, [...files].reverse()), key);
  assert.notEqual(getInferenceContextKey(settings, files.slice(1)), key);
});
