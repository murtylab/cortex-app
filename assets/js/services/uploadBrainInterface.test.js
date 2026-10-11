import test from "node:test";
import assert from "node:assert/strict";
import { brainImageNeighbors, brainTooltipPosition, filterBrainImages } from "./uploadBrainInterface.js";

const images = [
  { id: "josephs__Faces__stim01.jpeg", name: "stim01.jpeg" },
  { id: "josephs__Bodies__stim01.jpeg", name: "stim01.jpeg" },
  { id: "josephs__Scenes__stim02.jpeg", name: "stim02.jpeg" },
];
const labels = new Map([
  [images[0].id, "Faces · stim01.jpeg"],
  [images[1].id, "Bodies · stim01.jpeg"],
  [images[2].id, "stim02.jpeg"],
  ["reza__stim01.jpeg", "Reza · stim01.jpeg"],
]);

test("searches only the current selected image set without adding cross-set matches", () => {
  assert.deepEqual(filterBrainImages(images, labels, "stim01"), images.slice(0, 2));
  assert.deepEqual(filterBrainImages(images, labels, "Reza"), []);
  assert.equal(filterBrainImages(images, labels, ""), images);
  assert.equal(filterBrainImages(images, labels, "  "), images);
  assert.deepEqual(filterBrainImages([], labels, "stim01"), []);
});

test("searches disambiguated duplicate names by group with trimmed case-insensitive text", () => {
  assert.deepEqual(filterBrainImages(images, labels, "  fAcEs  "), [images[0]]);
  assert.deepEqual(filterBrainImages(images, labels, "bodies"), [images[1]]);
  assert.deepEqual(filterBrainImages(images, labels, "stim02"), [images[2]]);
  assert.deepEqual(filterBrainImages(images, labels, "missing"), []);
  assert.deepEqual(filterBrainImages(images, new Map(), "stim01"), images.slice(0, 2));
  assert.deepEqual(images.map((image) => image.name), ["stim01.jpeg", "stim01.jpeg", "stim02.jpeg"]);
});

test("image neighbors use the filtered order and stop at both ends", () => {
  assert.deepEqual(brainImageNeighbors(images, images[1].id), { previous: images[0], next: images[2] });
  assert.deepEqual(brainImageNeighbors(images, images[0].id), { previous: undefined, next: images[1] });
  assert.deepEqual(brainImageNeighbors(images, images[2].id), { previous: images[1], next: undefined });
  const filtered = [images[2], images[0]];
  assert.deepEqual(brainImageNeighbors(filtered, images[2].id), { previous: undefined, next: images[0] });
});

test("a missing current image can advance into visible results without inventing a previous image", () => {
  assert.deepEqual(brainImageNeighbors(images, "not-in-set"), { previous: undefined, next: images[0] });
  assert.deepEqual(brainImageNeighbors(images, undefined), { previous: undefined, next: images[0] });
  assert.deepEqual(brainImageNeighbors([images[0]], images[0].id), { previous: undefined, next: undefined });
  assert.deepEqual(brainImageNeighbors([], images[0].id), { previous: undefined, next: undefined });
});

test("tooltip placement adds a small gap when there is room and flips near edges", () => {
  const dimensions = { stageWidth: 400, stageHeight: 300, tooltipWidth: 235, tooltipHeight: 150 };
  assert.deepEqual(brainTooltipPosition({ ...dimensions, canvasX: 50, canvasY: 20 }), { left: 62, top: 32 });
  assert.deepEqual(brainTooltipPosition({ ...dimensions, canvasX: 388, canvasY: 290 }), { left: 141, top: 128 });
  assert.deepEqual(brainTooltipPosition({ ...dimensions, canvasX: -4, canvasY: -4 }), { left: 8, top: 8 });
});

test("narrow-stage tooltip placement respects measured dimensions and padding", () => {
  const dimensions = { stageWidth: 260, stageHeight: 280, tooltipWidth: 244, tooltipHeight: 264 };
  for (const [canvasX, canvasY] of [[0, 0], [130, 140], [259, 279], [-4, -4], [270, 290]]) {
    const position = brainTooltipPosition({ ...dimensions, canvasX, canvasY });
    assert.deepEqual(position, { left: 8, top: 8 });
    assert.ok(position.left + dimensions.tooltipWidth <= dimensions.stageWidth - 8);
    assert.ok(position.top + dimensions.tooltipHeight <= dimensions.stageHeight - 8);
  }
});

test("tooltip placement remains nonnegative when the stage is smaller than the tooltip", () => {
  assert.deepEqual(brainTooltipPosition({ canvasX: 0, canvasY: 0, stageWidth: 100, stageHeight: 90, tooltipWidth: 235, tooltipHeight: 150 }), { left: 0, top: 0 });
  assert.deepEqual(brainTooltipPosition({ canvasX: 1000, canvasY: -100, stageWidth: 0, stageHeight: 0, tooltipWidth: 235, tooltipHeight: 150 }), { left: 0, top: 0 });
  assert.deepEqual(brainTooltipPosition({ canvasX: 0, canvasY: 0, stageWidth: 250, stageHeight: 160, tooltipWidth: 244, tooltipHeight: 154 }), { left: 3, top: 3 });
});
