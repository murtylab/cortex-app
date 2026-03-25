import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

const BarChartOverview = ({ data, roi, dataset, ceiling, rank, onModelClick, selectedModel }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;

      setDimensions({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const results = useMemo(() => {
    if (!data || !roi || !data[roi]) return [];

    const roiData = data[roi];
    const models = Object.keys(roiData).filter((m) => m !== "ceiling");

    let arr = models
      .map((model) => ({ model, val: roiData[model]?.[dataset]?.[0] }))
      .filter((d) => d.val !== undefined && d.val !== null);

    if (rank && rank !== "") {
      arr = [...arr].sort((a, b) => d3.descending(a.val, b.val));
    }

    return arr;
  }, [data, roi, dataset, rank]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!data || !roi || !data[roi] || dimensions.width === 0 || results.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 5, right: 5, bottom: 5, left: 5 };

    const xScale = d3.scalePoint()
      .domain(results.map(d => d.model))
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([-0.2, 1.0])
      .range([height - margin.bottom, margin.top]);

    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2 2");

    const lineGenerator = d3.line()
      .x(d => xScale(d.model))
      .y(d => yScale(d.val))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(results)
      .attr("fill", "none")
      .attr("stroke", "#1890ff")
      .attr("stroke-width", 1.5)
      .attr("d", lineGenerator);

    svg.selectAll("circle")
      .data(results)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.model))
      .attr("cy", d => yScale(d.val))
      .attr("r", d => d.model === selectedModel ? 4 : 2)
      .attr("fill", d => d.model === selectedModel ? "#ff4500" : "#1890ff")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        onModelClick?.(d.model === selectedModel ? null : d.model);
      });

    const selectedPoint = results.find(d => d.model === selectedModel);
    if (selectedPoint) {
      const px = xScale(selectedPoint.model);
      const py = yScale(selectedPoint.val);
      const placeLeft = px > width - 120;

      svg.append("text")
        .attr("x", placeLeft ? px - 6 : px + 6)
        .attr("y", py - 6)
        .attr("text-anchor", placeLeft ? "end" : "start")
        .attr("font-size", "10px")
        .attr("fill", "#ff4500")
        .attr("font-weight", 500)
        .text(selectedPoint.model);
    }

    [0, 1].forEach(tick => {
      svg.append("text")
        .attr("x", 5)
        .attr("y", yScale(tick) - 2)
        .attr("font-size", "9px")
        .attr("fill", "#ccc")
        .text(tick);
    });
  }, [data, roi, dataset, rank, dimensions, selectedModel, results, onModelClick]);

  const noData = results.length === 0;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        background: "transparent"
      }}
    >
      <div
        style={{
          width: "50px",
          paddingRight: "10px",
          fontSize: "10px",
          color: "#999",
          textAlign: "right",
          flexShrink: 0,
          lineHeight: "1.1",
          fontWeight: 500
        }}
      >
        <div style={{ color: "#666" }}>{dataset}</div>
        <div style={{ fontWeight: "bold" }}>{roi}</div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: noData ? "flex-start" : "stretch"
        }}
      >
        {noData ? (
          <div
            style={{
              fontSize: "12px",
              color: "#999",
              paddingLeft: "8px",
              fontStyle: "italic"
            }}
          >
             No data available for this region under the selected evaluation dataset.
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            style={{ display: "block" }}
          />
        )}
      </div>
    </div>
  );
};

export default BarChartOverview;