/** Lab-page-only typography / chart tokens. Do not import from Scoreboard or home. */

function isDarkTheme() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("theme-dark");
}

export const LAB_COLORS = {
  get pageBg() {
    return isDarkTheme() ? "#0a0a0a" : "#ffffff";
  },
  get panel() {
    return isDarkTheme() ? "#1a1a1a" : "#ffffff";
  },
  get text() {
    return isDarkTheme() ? "#f6f3ee" : "#211F1C";
  },
  get secondary() {
    return isDarkTheme() ? "#e4ddd3" : "#57534A";
  },
  get muted() {
    return isDarkTheme() ? "#d2cbc0" : "#8A8378";
  },
  get hairline() {
    return isDarkTheme() ? "#5a564e" : "#D6D2C6";
  },
  get accent() {
    return isDarkTheme() ? "#5ED6FF" : "#4A2E5C";
  },
};

export const LAB_CHART = {
  tick: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 11,
    fontWeight: 400,
    get fill() {
      return LAB_COLORS.muted;
    },
  },
  axisTitle: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    get fill() {
      return LAB_COLORS.secondary;
    },
  },
  axisLine: {
    get stroke() {
      return LAB_COLORS.hairline;
    },
    strokeWidth: 1,
  },
  category: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 11,
    fontWeight: 400,
    get fill() {
      return LAB_COLORS.muted;
    },
  },
};

/** Apply Lab tick + domain styling to a d3 axis selection (g). */
export function styleLabAxis(axisG) {
  if (!axisG) return;
  axisG.selectAll("text")
    .style("font-family", LAB_CHART.tick.fontFamily)
    .style("font-size", `${LAB_CHART.tick.fontSize}px`)
    .style("font-weight", LAB_CHART.tick.fontWeight)
    .style("fill", LAB_COLORS.muted);
  axisG.selectAll("path, line")
    .attr("stroke", LAB_COLORS.hairline)
    .attr("stroke-width", LAB_CHART.axisLine.strokeWidth);
  axisG.select(".domain")
    .attr("stroke", LAB_COLORS.hairline)
    .attr("stroke-width", LAB_CHART.axisLine.strokeWidth);
}

export function applyLabAxisTitle(selection) {
  if (!selection) return selection;
  return selection
    .style("font-family", LAB_CHART.axisTitle.fontFamily)
    .style("font-size", `${LAB_CHART.axisTitle.fontSize}px`)
    .style("font-weight", LAB_CHART.axisTitle.fontWeight)
    .style("fill", LAB_COLORS.secondary);
}

export function toSentenceCase(str) {
  if (!str || typeof str !== "string") return str;
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
