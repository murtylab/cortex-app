/** Lab-page-only typography / chart tokens. Do not import from Scoreboard or home. */

export const LAB_COLORS = {
  pageBg: "#f7f7f4",
  panel: "#FBFAF6",
  text: "#211F1C",
  secondary: "#57534A",
  muted: "#8A8378",
  hairline: "#D6D2C6",
  accent: "#4A2E5C",
};

export const LAB_CHART = {
  tick: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 11,
    fontWeight: 400,
    fill: LAB_COLORS.muted,
  },
  axisTitle: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    fill: LAB_COLORS.secondary,
  },
  axisLine: {
    stroke: LAB_COLORS.hairline,
    strokeWidth: 1,
  },
  category: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 11,
    fontWeight: 400,
    fill: LAB_COLORS.muted,
  },
};

/** Apply Lab tick + domain styling to a d3 axis selection (g). */
export function styleLabAxis(axisG) {
  if (!axisG) return;
  axisG.selectAll("text")
    .style("font-family", LAB_CHART.tick.fontFamily)
    .style("font-size", `${LAB_CHART.tick.fontSize}px`)
    .style("font-weight", LAB_CHART.tick.fontWeight)
    .style("fill", LAB_CHART.tick.fill);
  axisG.selectAll("path, line")
    .attr("stroke", LAB_CHART.axisLine.stroke)
    .attr("stroke-width", LAB_CHART.axisLine.strokeWidth);
  // Remove the outer plot-frame domain if present as a box; keep tick marks.
  axisG.select(".domain")
    .attr("stroke", LAB_CHART.axisLine.stroke)
    .attr("stroke-width", LAB_CHART.axisLine.strokeWidth);
}

export function applyLabAxisTitle(selection) {
  if (!selection) return selection;
  return selection
    .style("font-family", LAB_CHART.axisTitle.fontFamily)
    .style("font-size", `${LAB_CHART.axisTitle.fontSize}px`)
    .style("font-weight", LAB_CHART.axisTitle.fontWeight)
    .style("fill", LAB_CHART.axisTitle.fill);
}

export function toSentenceCase(str) {
  if (!str || typeof str !== "string") return str;
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
