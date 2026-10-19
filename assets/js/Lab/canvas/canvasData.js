// These functions create per-chart views; saved history and source files stay immutable.
export function getCanvasStimuli(entry) {
  return Object.keys(entry?.result?.[0]?.mean || {}).map((filename, originalIndex) => {
    const files = entry.files || [];
    const mapping = files.find((file) => file.serverKey === filename || file.uid === filename || file.file?.name === filename)
      || files.find((file) => file.label === filename.split('/').pop());
    return { ...mapping, filename, originalIndex, serverKey: filename, label: mapping?.label || filename, groupKey: mapping?.groupKey || 'Ungrouped' };
  });
}

export function buildCanvasChartData(entry, card) {
  const source = entry?.result?.[0] || {};
  const allStimuli = getCanvasStimuli(entry);
  const excluded = new Set(card.excludedFilenames || []);
  const groups = card.groupFilter == null ? null : new Set(card.groupFilter);
  const visible = allStimuli.filter((stimulus) => !excluded.has(stimulus.filename) && (!groups || groups.has(stimulus.groupKey)));
  const filenames = visible.map((stimulus) => stimulus.filename);
  const highlighted = new Set(card.highlightedFilenames || []);
  const bars = visible.map(({ filename }) => ({ filename, mean: Number(source.mean[filename]), sem: Number(source.sem?.[filename] || 0) }));
  // Index the ORIGINAL matrix, not a filtered/reordered matrix; apply the same subset to both axes.
  const heatmap = visible.flatMap((x) => visible.flatMap((y) => {
    const value = source.rdm?.[x.originalIndex]?.[y.originalIndex];
    return Number.isFinite(value) ? [{ x: x.filename, y: y.filename, value }] : [];
  }));
  const sortedFilenames = [...visible].sort((a, b) => card.order === 'ranking'
    ? Number(source.mean[b.filename]) - Number(source.mean[a.filename])
    : a.groupKey.localeCompare(b.groupKey, undefined, { numeric: true }) || a.label.localeCompare(b.label, undefined, { numeric: true })
  ).map((stimulus) => stimulus.filename);
  return { bars, heatmap, filenames, sortedFilenames, fileMappings: visible, highlightedFilenames: filenames.filter((filename) => highlighted.has(filename)), totalCount: allStimuli.length };
}
