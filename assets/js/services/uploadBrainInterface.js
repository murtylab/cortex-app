/** Search the current image set's displayed labels without mixing in other sets. */
export function filterBrainImages(images, labelsMap, search) {
  const query = (search || "").trim().toLocaleLowerCase();
  return query ? images.filter((image) =>
    (labelsMap.get(image.id) || image.name || image.id).toLocaleLowerCase().includes(query)) : images;
}

/** Navigate the visible image list, stopping at its first and last images. */
export function brainImageNeighbors(filteredImages, currentId) {
  const index = filteredImages.findIndex((image) => image.id === currentId);
  return {
    previous: index > 0 ? filteredImages[index - 1] : undefined,
    next: index < filteredImages.length - 1 ? filteredImages[index + 1] : undefined,
  };
}

/** Flip away from canvas edges and keep the measured tooltip within its stage. */
export function brainTooltipPosition({ canvasX, canvasY, stageWidth, stageHeight, tooltipWidth, tooltipHeight }) {
  const gap = 12;
  const padding = 8;
  function coordinate(pointer, extent, size) {
    const inset = Math.min(padding, Math.max(0, (extent - size) / 2));
    const maximum = Math.max(inset, extent - size - inset);
    const preferred = pointer + gap;
    const flipped = preferred > maximum ? pointer - size - gap : preferred;
    return Math.max(inset, Math.min(maximum, flipped));
  }
  return {
    left: coordinate(canvasX, stageWidth, tooltipWidth),
    top: coordinate(canvasY, stageHeight, tooltipHeight),
  };
}
