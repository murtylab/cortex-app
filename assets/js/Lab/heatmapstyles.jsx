import * as d3 from 'd3';

export const heatmapStyles = {
  margin: { top: 30, right: 20, bottom: 100, left: 150 },
  colorScheme: d3.interpolateBlues, // Change to your preferred D3 color scheme
  strokeColor: "#fff",
  strokeWidth: 1,
};

export const createColorScale = (maxValue) => 
  d3.scaleSequential(heatmapStyles.colorScheme).domain([0, maxValue]);

export const styleTooltip = (tooltip) => {
  tooltip
    .style("position", "absolute")
    .style("background", "rgba(255, 255, 255, 0.9)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "8px") // Slightly larger rounded corners
    .style("padding", "15px") // Increase padding for a bigger appearance
    .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.3)") // More shadow for emphasis
    .style("pointer-events", "none")
    .style("font-size", "18px") // Bigger font for readability
    .style("line-height", "1.5") // Improve spacing for text
    .style("min-width", "200px") // Ensure a larger tooltip width
    .style("max-width", "400px") // Prevent tooltip from being too wide
    .style("display", "none")
    .style("opacity", "1 !important")
    .style("z-index", "1000") // High z-index to hover over all components
    .style("pointer-events", "none"); // Prevent tooltip from blocking mouse events
};