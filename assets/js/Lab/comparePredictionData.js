// Namespace filenames by run so predictions from different models never share mappings.
export function buildComparisonData(entries, historyEntries = entries) {
  const regionDataMap = {};
  const fileMappings = [];
  const regionOrder = [];
  const regionLabels = {};

  for (const entry of entries) {
    const runKey = `run-${entry.id}`;
    const data = entry.result?.[0];
    if (!data?.mean) continue;
    const keyFor = (filename) => `${runKey}/${filename}`;
    regionOrder.push(runKey);
    const displayNumber = historyEntries.findIndex((item) => item.id === entry.id) + 1;
    regionLabels[runKey] = `#${displayNumber} · ${entry.settings.region.toUpperCase()} · ${entry.settings.dataset} · ${entry.settings.model}`;
    regionDataMap[runKey] = [{
      ...data,
      mean: Object.fromEntries(Object.entries(data.mean).map(([key, value]) => [keyFor(key), value])),
      sem: Object.fromEntries(Object.entries(data.sem || {}).map(([key, value]) => [keyFor(key), value])),
    }];
    for (const filename of Object.keys(data.mean)) {
      const mapping = entry.files.find((file) => file.serverKey === filename || file.uid === filename || file.file?.name === filename)
        || entry.files.find((file) => file.label === filename.split('/').pop());
      fileMappings.push({
        ...mapping,
        uid: keyFor(filename),
        serverKey: keyFor(filename),
        label: mapping?.label || filename,
        groupKey: mapping?.groupKey || 'Ungrouped',
      });
    }
  }
  return { regionDataMap, fileMappings, regionOrder, regionLabels };
}
