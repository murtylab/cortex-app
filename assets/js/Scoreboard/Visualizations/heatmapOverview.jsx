
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const HeatmapOverview = ({
  data,
  roi,
  dataset,
  rank,
  onModelClick,
  selectedModel,
  visibleRange,
  sharedColWidth = 6,
}) => {
  const chartRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!chartRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(chartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!data || dimensions.height === 0) return;

    const container = d3.select(chartRef.current);
    container.select("svg").remove();

    let cellData = [];
    let modelsSet = new Set();
    let xLabelsSet = new Set();

    if (roi && data[roi] && !dataset) {
      // 模式 A: 固定 ROI，对比不同 Dataset
      const rawModels = Object.keys(data[roi]).filter((m) => m !== "ceiling");
      rawModels.forEach((model) => {
        Object.entries(data[roi][model] || {}).forEach(([x, vals]) => {
          if (vals && !["murty185", "nsd_1000"].includes(x)) {
            cellData.push({ model, x, raw: vals[0], norm: vals[1] });
            modelsSet.add(model);
            xLabelsSet.add(x);
          }
        });
      });
    } else if (dataset) {
      // 模式 B: 固定 Dataset，对比不同 ROI
      const rois = Object.keys(data).filter(
        (r) => r !== "overall" && r !== "Across Regions"
      );

      rois.forEach((r) => {
        const modelNames = Object.keys(data[r] || {}).filter((m) => m !== "ceiling");
        modelNames.forEach((model) => {
          const vals = data[r][model]?.[dataset];
          if (vals) {
            cellData.push({ model, x: r, raw: vals[0], norm: vals[1] });
            modelsSet.add(model);
            xLabelsSet.add(r);
          }
        });
      });
    }

    if (!cellData.length) return;

    let xLabels = Array.from(xLabelsSet);
    let models = Array.from(modelsSet);

    if (rank === "rank") {
      const avg = {};
      models.forEach((m) => {
        const vals = cellData.filter((d) => d.model === m).map((d) => d.raw);
        avg[m] = d3.mean(vals);
      });
      models.sort((a, b) => (avg[b] || 0) - (avg[a] || 0));
    } else {
      models.sort();
    }

    const totalHeight = dimensions.height;
    const colGap = 1;
    const colWidth = sharedColWidth;
    const rowHeight = totalHeight / models.length;
    const totalWidth = xLabels.length * colWidth;

    const colorScale = d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(["#ede9d8", "#c4b4cc", "#8966a3"]);

    const svg = container
      .append("svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .style("background", "transparent")
      .style("display", "block")
      .style("font-family", "'Inter', sans-serif");

    svg
      .selectAll("rect.cell")
      .data(cellData)
      .enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", (d) => xLabels.indexOf(d.x) * colWidth)
      .attr("y", (d) => models.indexOf(d.model) * rowHeight)
      .attr("width", colWidth)
      .attr("height", rowHeight)
      .attr("fill", (d) => colorScale(d.norm ?? 0))
      .attr("stroke", "none")
      .style("opacity", (d) => selectedModel ? (d.model === selectedModel ? 1 : 0.25) : 1)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        onModelClick?.(d.model === selectedModel ? null : d.model);
      });

    if (visibleRange && models.length > 0) {
      const { start, end } = visibleRange;
      const boxY = start * rowHeight;
      const boxHeight = (end - start) * rowHeight;

      if (boxHeight > 0) {
        svg
          .append("rect")
          .attr("class", "visible-range-rect")
          .attr("x", 0)
          .attr("y", boxY)
          .attr("width", totalWidth)
          .attr("height", boxHeight)
          .attr("fill", "rgba(137, 102, 163, 0.15)")
          .attr("stroke", "#7050a0")
          .attr("stroke-width", 1.5)
          .style("pointer-events", "none");
      }
    }
  }, [
    data,
    roi,
    dataset,
    rank,
    dimensions,
    onModelClick,
    selectedModel,
    visibleRange,
    sharedColWidth,
  ]);

  return (
    <div
      ref={chartRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "transparent",
        marginBottom: "10px",
      }}
    />
  );
};

export default HeatmapOverview;