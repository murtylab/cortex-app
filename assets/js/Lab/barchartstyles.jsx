import * as d3 from 'd3';

export const barchartStyles = {
  margin: { top: 20, right: 30, bottom: 50, left: 50 },
  barColor: "steelblue", // Default bar color
  barHoverColor: "orange", // Bar color on hover
  axisColor: "#000", // Axis stroke color
  strokeWidth: 1, // Axis stroke width
};

export const createYScale = (maxValue, innerHeight) => 
  d3.scaleLinear().domain([0, maxValue]).range([innerHeight, 0]);

export const createXScale = (categories, innerWidth) => 
  d3.scaleBand().domain(categories).range([0, innerWidth]).padding(0.1);

export const styleTooltip = (tooltip) => {
  tooltip
    .style("position", "absolute")
    .style("background", "#ffffff")
    .style("border", "1px solid rgba(60, 55, 48, 0.18)")
    .style("border-radius", "8px")
    .style("padding", "12px 14px")
    .style("box-shadow", "0 4px 14px rgba(0, 0, 0, 0.12)")
    .style("pointer-events", "none")
    .style("font-family", "var(--mono-font, 'IBM Plex Mono', ui-monospace, monospace)")
    .style("font-size", "13px")
    .style("line-height", "1.5") // Improve spacing for text
    .style("min-width", "200px") // Ensure a larger tooltip width
    .style("max-width", "400px") // Prevent tooltip from being too wide
    .style("display", "none")
    .style("opacity", "1 !important")
    .style("z-index", "1000") // High z-index to hover over all components
    .style("pointer-events", "none"); // Prevent tooltip from blocking mouse events
};
