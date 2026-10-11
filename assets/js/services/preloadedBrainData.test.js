import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildUploadBrainData, getBrainImageLabels, getVoxelWinner } from "./uploadBrainData.js";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const mapping = JSON.parse(readFileSync(new URL("../../brainModel/subject1-prediction-mapping.json", import.meta.url)));

// constants.jsx contains plain JavaScript, not JSX. Load its real exports without
// introducing React/Vite dependencies into these Node-only data-contract tests.
const constantsSource = readFileSync(new URL("../constants.jsx", import.meta.url));
const { PRELOAD_DATASETS } = await import(`data:text/javascript;base64,${constantsSource.toString("base64")}`);

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function preloadFiles(datasetKey, imageFolder) {
  const directory = path.join(projectRoot, imageFolder.replace(/^\//, ""));
  return walkFiles(directory)
    .filter((filename) => /\.(png|jpe?g|webp)$/i.test(filename))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((filename) => {
      const parts = path.relative(directory, filename).split(path.sep);
      const name = parts.at(-1);
      const groupKey = parts.length > 1 ? parts[0] : "Ungrouped";
      const uid = `${datasetKey}__${groupKey}__${name}`;
      return {
        uid,
        serverKey: uid,
        label: name,
        groupKey,
        file: { name },
        blobURL: `/${path.relative(projectRoot, filename).split(path.sep).join("/")}`,
      };
    });
}

const activeSets = Object.entries(PRELOAD_DATASETS).map(([key, descriptor]) => ({
  key,
  descriptor,
  files: preloadFiles(key, descriptor.imageFolder),
}));

// The currently shipped NSD caches are Wardle stimuli; the selectable paper
// datasets have images but no caches and therefore require live inference.
// Read existing data only: never substitute another image's raw response vector.
const cacheEntries = walkFiles(path.join(projectRoot, "assets/preload"))
  .filter((filename) => /\/data\/[^/]+_nsd_1000_[^/]+\.json$/.test(filename.split(path.sep).join("/")))
  .map((filename) => {
    const region = path.basename(filename).match(/_nsd_1000_([^/]+)\.json$/)[1];
    const model = path.basename(filename).slice(0, -`_nsd_1000_${region}.json`.length);
    const datasetKey = path.basename(path.dirname(path.dirname(filename))).replace(/\s+/g, "");
    const imageFolder = `/${path.relative(projectRoot, path.join(path.dirname(path.dirname(filename)), "images")).split(path.sep).join("/")}`;
    const predictionResult = JSON.parse(readFileSync(filename));
    return { filename, datasetKey, region, model, predictionResult, files: preloadFiles(datasetKey, imageFolder) };
  });

const brainData = (cache, files = cache.files) => buildUploadBrainData({
  predictionResult: cache.predictionResult,
  files,
  dataset: "nsd_1000",
  region: cache.region,
  model: cache.model,
  mapping,
});

function rawRange(images) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const image of images) {
    for (const value of image.values) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return [minimum, maximum];
}

test("every selectable paper dataset has real images with unique canonical preload identities", () => {
  assert.deepEqual(activeSets.map(({ key }) => key), ["reza", "brandman", "josephs-e1loc", "kamps2019"]);
  for (const { key, files } of activeSets) {
    assert.ok(files.length > 0, `${key} should have selectable images`);
    assert.equal(new Set(files.map((file) => file.uid)).size, files.length, `${key} identities must be unique`);
    for (const file of files) {
      assert.equal(file.uid, `${key}__${file.groupKey}__${file.file.name}`);
      assert.equal(file.serverKey, file.uid);
      assert.ok(existsSync(path.join(projectRoot, file.blobURL.slice(1))));
    }
  }
});

test("Josephs images with duplicate basenames remain distinct across actual preload groups", () => {
  const { files } = activeSets.find(({ key }) => key === "josephs-e1loc");
  const duplicates = files.filter((file) => file.file.name === "stim01.jpeg");
  assert.ok(duplicates.length > 1);
  assert.equal(new Set(duplicates.map((file) => file.groupKey)).size, duplicates.length);
  assert.equal(new Set(duplicates.map((file) => file.uid)).size, duplicates.length);
  // Existing upload transport appends an extension to the canonical UID; these
  // live server keys also preserve the group, unlike basename-only matching.
  const liveKeys = duplicates.map((file) => `${file.uid}${path.extname(file.file.name)}`);
  assert.equal(new Set(liveKeys).size, duplicates.length);
});

test("synthetic responses verify exact Josephs group identities and reject ambiguous basename-only matches", () => {
  const { files } = activeSets.find(({ key }) => key === "josephs-e1loc");
  const selectedFiles = files.filter((file) => file.file.name === "stim01.jpeg").slice(0, 2);
  assert.equal(selectedFiles.length, 2);
  // These deliberately synthetic rows exercise identity handling only; they
  // are not scientific predictions for the Josephs images.
  const voxels = Object.fromEntries(selectedFiles.map((file, index) => [
    file.uid, { s1: { ffa: Array(mapping.rois.ffa.responseCount).fill(index - 1) } },
  ]));
  const args = { predictionResult: [{ voxels }], files: [...selectedFiles].reverse(), dataset: "nsd_1000", region: "ffa", model: "synthetic-test-only", mapping };
  const data = buildUploadBrainData(args);
  assert.equal(data.status, "ready", data.reason);
  assert.deepEqual(data.images.map((image) => image.id), args.files.map((file) => file.uid));
  assert.deepEqual(data.images.map((image) => image.values[0]), [0, -1]);
  assert.equal(getVoxelWinner(data.images, 0).image.id, selectedFiles[1].uid);

  const basenameOnly = { [selectedFiles[0].file.name]: voxels[selectedFiles[0].uid] };
  assert.equal(buildUploadBrainData({ ...args, predictionResult: [{ voxels: basenameOnly }] }).status, "unavailable");
});

const josephsDuplicates = activeSets.find(({ key }) => key === "josephs-e1loc").files
  .filter((file) => file.file.name === "stim01.jpeg");
const duplicateImages = (files) => files.map((file) => ({ id: file.uid, name: file.file.name }));

test("brain labels disambiguate real Josephs filenames using their canonical groups", () => {
  const images = duplicateImages(josephsDuplicates);
  const labels = getBrainImageLabels(images, josephsDuplicates);
  assert.equal(labels.size, images.length);
  assert.equal(new Set(labels.values()).size, images.length);
  for (const file of josephsDuplicates) assert.equal(labels.get(file.uid), `${file.groupKey} · ${file.file.name}`);
});

test("brain labels look up renamed current groups by UID, not file order or previous group", () => {
  const files = josephsDuplicates.slice(0, 2);
  const images = duplicateImages(files);
  const currentFiles = files.map((file, index) => ({ ...file, groupKey: `Renamed ${index + 1}` })).reverse();
  const labels = getBrainImageLabels(images, currentFiles);
  assert.equal(labels.get(images[0].id), "Renamed 1 · stim01.jpeg");
  assert.equal(labels.get(images[1].id), "Renamed 2 · stim01.jpeg");
});

test("brain labels append image numbers when duplicate filenames share a merged group", () => {
  const files = josephsDuplicates.slice(0, 2).map((file) => ({ ...file, groupKey: "Merged" }));
  const images = duplicateImages(files);
  const labels = getBrainImageLabels(images, files);
  assert.equal(labels.get(images[0].id), "Merged · stim01.jpeg · Image 1");
  assert.equal(labels.get(images[1].id), "Merged · stim01.jpeg · Image 2");
  assert.equal(new Set(labels.values()).size, images.length);
});

test("Ungrouped or missing-file duplicates use image numbers without redundant suffixes", () => {
  const files = josephsDuplicates.slice(0, 2).map((file) => ({ ...file, groupKey: "Ungrouped" }));
  const images = duplicateImages(files);
  for (const currentFiles of [files, []]) {
    const labels = getBrainImageLabels(images, currentFiles);
    assert.equal(labels.get(images[0].id), "Image 1 · stim01.jpeg");
    assert.equal(labels.get(images[1].id), "Image 2 · stim01.jpeg");
  }
});

test("unique brain image names stay unchanged regardless of their group labels", () => {
  const files = activeSets.find(({ key }) => key === "reza").files;
  const images = duplicateImages(files);
  const labels = getBrainImageLabels(images, files);
  for (const image of images) assert.equal(labels.get(image.id), image.name);
  assert.equal(getBrainImageLabels([], files).size, 0);
});

test("brain labels also disambiguate a unique image name matching another proposed group label", () => {
  const files = josephsDuplicates.slice(0, 2);
  const images = duplicateImages(files);
  const collision = `${files[0].groupKey} · ${images[0].name}`;
  images.push({ id: "unique-display-name-test", name: collision });
  const labels = getBrainImageLabels(images, files);
  assert.equal(labels.get(images[0].id), `${collision} · Image 1`);
  assert.equal(labels.get(images[1].id), `${files[1].groupKey} · ${images[1].name}`);
  assert.equal(labels.get(images[2].id), `${collision} · Image 3`);
  assert.equal(new Set(labels.values()).size, images.length);
});

test("brain label suffixes cannot collide with unchanged names or mutate prediction vectors", () => {
  const files = josephsDuplicates.slice(0, 2).map((file) => Object.freeze({ ...file, groupKey: "Merged" }));
  const images = files.map((file) => Object.freeze({ id: file.uid, name: file.file.name, values: Object.freeze([1, -2]) }));
  images.push(Object.freeze({ id: "suffix-display-name-test", name: "Merged · stim01.jpeg · Image 1", values: Object.freeze([3, -4]) }));
  Object.freeze(images);
  Object.freeze(files);
  const before = JSON.stringify({ images, files });
  const labels = getBrainImageLabels(images, files);
  assert.equal(labels.get(images[0].id), "Merged · stim01.jpeg · Image 1 (2)");
  assert.equal(labels.get(images[2].id), images[2].name);
  assert.equal(new Set(labels.values()).size, images.length);
  assert.equal(JSON.stringify({ images, files }), before);
});

test("the saved anatomy contract preserves Subject 1 threshold and response ordering for all NSD ROIs", () => {
  assert.equal(mapping.subjectId, "s1");
  assert.equal(mapping.responseSpace, "nsd_1000_subject1_floc_t7_v1");
  assert.equal(mapping.responseOrdering, "zyx-c-order");
  assert.equal(mapping.fLocThreshold, 7);
  assert.equal(mapping.fLocThresholdOperator, ">");
  const expectedCounts = { eba: 518, fba: 35, ffa: 156, ofa: 13, opa: 64, ppa: 170, rsc: 38, vwfa: 232 };
  for (const [region, count] of Object.entries(expectedCounts)) {
    assert.equal(mapping.rois[region].responseCount, count);
    assert.equal(mapping.rois[region].volumeCoordinatesZyx.length, count);
  }
  assert.ok(cacheEntries.length > 0, "exercise actual saved NSD data, not synthetic vectors");
});

for (const cache of cacheEntries) {
  const label = `${cache.datasetKey}/${cache.model}/${cache.region.toUpperCase()}`;

  test(`${label}: every cached image maps to its exact raw Subject 1 selected-ROI vector`, () => {
    const data = brainData(cache);
    assert.equal(data.status, "ready", data.reason);
    assert.equal(data.images.length, cache.files.length);
    assert.equal(data.roi, mapping.rois[cache.region]);
    for (const [index, file] of cache.files.entries()) {
      assert.equal(data.images[index].id, file.uid);
      assert.equal(data.images[index].url, file.blobURL);
      assert.equal(data.images[index].values, cache.predictionResult[0].voxels[file.uid].s1[cache.region]);
      assert.equal(data.images[index].values.length, mapping.rois[cache.region].responseCount);
    }
    assert.deepEqual(data.range, rawRange(data.images));
  });

  test(`${label}: removed images cannot affect the selected subset's range or voxel winner`, () => {
    const allData = brainData(cache);
    assert.equal(allData.status, "ready", allData.reason);
    const fullWinner = getVoxelWinner(allData.images, 0);
    const selectedFiles = cache.files.filter((file) => file.uid !== fullWinner.image.id).slice(0, 3);
    const data = brainData(cache, selectedFiles);
    assert.equal(data.status, "ready", data.reason);
    assert.deepEqual(data.images.map((image) => image.id), selectedFiles.map((file) => file.uid));
    assert.ok(!data.images.some((image) => image.id === fullWinner.image.id));
    assert.deepEqual(data.range, rawRange(data.images));
    for (let voxel = 0; voxel < mapping.rois[cache.region].responseCount; voxel += 1) {
      const values = data.images.map((image) => image.values[voxel]);
      const maximum = Math.max(...values);
      const winner = getVoxelWinner(data.images, voxel);
      assert.equal(winner.value, maximum);
      assert.equal(winner.image.id, selectedFiles[values.indexOf(maximum)].uid);
    }
  });

  test(`${label}: earlier live server keys fall back to canonical cache UIDs without row-order guessing`, () => {
    const selectedFiles = cache.files.slice(0, 4).reverse().map((file) => ({
      ...file,
      serverKey: `${file.uid}${path.extname(file.file.name)}`,
    }));
    const data = brainData(cache, selectedFiles);
    assert.equal(data.status, "ready", data.reason);
    assert.deepEqual(data.images.map((image) => image.id), selectedFiles.map((file) => file.uid));
    for (const [index, file] of selectedFiles.entries()) {
      assert.equal(data.images[index].values, cache.predictionResult[0].voxels[file.uid].s1[cache.region]);
    }
  });

  test(`${label}: a one-image selection has only that image as every voxel's winner`, () => {
    const selectedFiles = cache.files.slice(-1);
    const data = brainData(cache, selectedFiles);
    assert.equal(data.status, "ready", data.reason);
    assert.equal(data.images.length, 1);
    for (let voxel = 0; voxel < mapping.rois[cache.region].responseCount; voxel += 1) {
      assert.equal(getVoxelWinner(data.images, voxel).image.id, selectedFiles[0].uid);
    }
  });
}
