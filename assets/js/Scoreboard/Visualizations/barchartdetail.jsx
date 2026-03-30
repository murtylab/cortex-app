import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

const BarChartDetail = ({
  data,
  roi,
  dataset,
  ceiling,
  rank,
  yLabel,
  selectedModel,
  onModelClick,
}) => {
  const ceilingRef = useRef();
  const barsRef = useRef();
  const scrollContainerRef = useRef(null);

  const [stats, setStats] = useState({ max: null, mean: null });
  const [scaleY, setScaleY] = useState(null);

  const processed = useMemo(() => {
    if (!data || !roi || !data[roi]) return null;
    if (!ceiling || !ceiling[roi] || !ceiling[roi][dataset]) return null;

    const roiData = data[roi];
    const models = Object.keys(roiData).filter((m) => m !== "ceiling");

    let results = models
      .map((model) => ({
        model,
        val: roiData[model]?.[dataset]?.[0],
      }))
      .filter((d) => d.val !== undefined && d.val !== null);

    if (rank && rank !== "") {
      results = [...results].sort((a, b) => d3.descending(a.val, b.val));
    }

    const ceilingMean = ceiling[roi][dataset]?.ceiling_mean ?? null;
    const ceilingMax = ceiling[roi][dataset]?.ceiling_max ?? null;

    const barWidth = 20;
    const margin = { top: 30, right: 20, bottom: 180, left: 60 };
    const height = 350;
    const width = results.length * (barWidth + 10) + margin.right;

    return {
      results,
      ceilingMean,
      ceilingMax,
      barWidth,
      margin,
      height,
      width,
    };
  }, [data, roi, dataset, ceiling, rank]);

  const noData = !processed || processed.results.length === 0;

  useEffect(() => {
    const ceilingSvg = d3.select(ceilingRef.current);
    const barsSvg = d3.select(barsRef.current);
    ceilingSvg.selectAll("*").remove();
    barsSvg.selectAll("*").remove();

    if (!processed || processed.results.length === 0) {
      setStats({ max: null, mean: null });
      setScaleY(null);
      return;
    }

    const {
      results,
      ceilingMean,
      ceilingMax,
      barWidth,
      margin,
      height,
      width,
    } = processed;

    setStats({ max: ceilingMax, mean: ceilingMean });

    const y = d3
      .scaleLinear()
      .domain([-0.3, 1])
      .range([height - margin.bottom, margin.top]);

    setScaleY(() => y);

    const ceilingWidth = margin.left + 50;
    ceilingSvg.attr("width", ceilingWidth).attr("height", height);

    if (ceilingMax != null) {
      ceilingSvg
        .append("line")
        .attr("x1", margin.left + 15 + barWidth / 2)
        .attr("x2", margin.left + 15 + barWidth / 2)
        .attr("y1", y(0.9))
        .attr("y2", y(-0.3))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "3 3")
        .attr("stroke-width", 1);
    }

    if (ceilingMean != null) {
      const rect = ceilingSvg
        .append("rect")
        .attr("x", margin.left + 15)
        .attr("y", Math.min(y(0), y(ceilingMean)))
        .attr("width", barWidth)
        .attr("height", Math.abs(y(0) - y(ceilingMean)))
        .attr("fill", "#d3d3d3")
        .attr("stroke", "black");

      if (roi !== "Overall") {
        rect
          .on("mouseover", (event) => {
            d3.select("#roi-tooltip")
              .style("opacity", 1)
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 20 + "px")
              .html("Pairwise Subjects Correlations");
          })
          .on("mousemove", (event) => {
            d3.select("#roi-tooltip")
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", () => {
            d3.select("#roi-tooltip").style("opacity", 0);
          });
      }

      ceilingSvg
        .append("text")
        .attr("x", margin.left + 15 + barWidth / 2)
        .attr("y", y(0.95))
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "black")
        .text(ceilingMean.toFixed(2));

      const points = ceiling[roi][dataset]?.correlation_points || [];
      if (points.length > 0) {
        const jitter = d3
          .scaleLinear()
          .domain([0, points.length - 1])
          .range([-barWidth / 4, barWidth / 4]);

        ceilingSvg
          .append("g")
          .selectAll("circle")
          .data(points)
          .enter()
          .append("circle")
          .attr("cx", (_, i) => margin.left + 15 + barWidth / 2 + jitter(i))
          .attr("cy", (d) => y(d))
          .attr("r", 5)
          .attr("fill", "#74C5F7")
          .attr("stroke", "black")
          .attr("stroke-width", 0.6);
      }
    }

    ceilingSvg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((g) => {
        g.select(".domain").attr("stroke", "black");
        g.selectAll("line").remove();
        g.selectAll("text").attr("fill", "black");
      });

    const centerY = (height - margin.bottom) / 2;
    ceilingSvg
      .append("text")
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .attr("fill", "black")
      .attr(
        "transform",
        `translate(${margin.left - 45}, ${centerY}) rotate(-90)`
      )
      .text(yLabel);

    ceilingSvg
      .append("text")
      .attr("x", margin.left + barWidth / 2 + 15)
      .attr("y", height - margin.bottom + 10)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", "black")
      .attr(
        "transform",
        `rotate(60, ${margin.left + barWidth / 2 + 15}, ${
          height - margin.bottom
        })`
      )
      .text("Ceiling");

    barsSvg.attr("width", width).attr("height", height);

    const x = d3
      .scaleBand()
      .domain(results.map((d) => d.model))
      .range([10, width - margin.right])
      .padding(0.2);

    barsSvg
      .append("g")
      .selectAll("line.value-dash")
      .data(results)
      .enter()
      .append("line")
      .attr("x1", (d) => x(d.model) + x.bandwidth() / 2)
      .attr("x2", (d) => x(d.model) + x.bandwidth() / 2)
      .attr("y1", y(0.9))
      .attr("y2", y(-0.3))
      .attr("stroke", "gray")
      .attr("stroke-dasharray", "3 3")
      .attr("stroke-width", 1);

    barsSvg
      .append("g")
      .selectAll("rect.model-bar")
      .data(results)
      .enter()
      .append("rect")
      .attr("class", "model-bar")
      .attr("x", (d) => x(d.model))
      .attr("y", (d) => Math.min(y(0), y(d.val)))
      .attr("height", (d) => Math.abs(y(0) - y(d.val)))
      .attr("width", x.bandwidth())
      .attr("fill", (d) => (d.model === selectedModel ? "#ff7a45" : "#d3d3d3"))
      .attr("stroke", (d) => (d.model === selectedModel ? "#d4380d" : "black"))
      .attr("stroke-width", (d) => (d.model === selectedModel ? 2 : 1))
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const newSelection = selectedModel === d.model ? null : d.model;
        onModelClick?.(newSelection);
      });

    barsSvg
      .append("g")
      .selectAll("text.value-label")
      .data(results)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.model) + x.bandwidth() / 2)
      .attr("y", y(0.95))
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", (d) => (d.model === selectedModel ? "#d4380d" : "black"))
      .attr("font-weight", (d) => (d.model === selectedModel ? "700" : "400"))
      .text((d) => d.val.toFixed(2));

    barsSvg
      .append("g")
      .selectAll("text.model-label")
      .data(results)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.model) + x.bandwidth() / 2)
      .attr("y", height - margin.bottom + 10)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", (d) => (d.model === selectedModel ? "#d4380d" : "black"))
      .attr("font-weight", (d) => (d.model === selectedModel ? "700" : "400"))
      .attr(
        "transform",
        (d) =>
          `rotate(60, ${x(d.model) + x.bandwidth() / 2}, ${
            height - margin.bottom
          })`
      )
      .text((d) => d.model)
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        const newSelection = selectedModel === d.model ? null : d.model;
        onModelClick?.(newSelection);
      });

    function drawLine(svg, value, color, svgWidth, offsetX = 0) {
      if (value == null) return;
      const [yMin, yMax] = y.domain();
      const safeVal = Math.min(Math.max(value, yMin), yMax);
      svg
        .append("line")
        .attr("x1", offsetX)
        .attr("x2", svgWidth)
        .attr("y1", y(safeVal))
        .attr("y2", y(safeVal))
        .attr("stroke", color)
        .attr("stroke-dasharray", "4 2")
        .attr("stroke-width", 1);
    }

    drawLine(ceilingSvg, ceilingMax, "red", ceilingWidth, margin.left);
    drawLine(ceilingSvg, ceilingMean, "blue", ceilingWidth, margin.left);
    drawLine(barsSvg, ceilingMax, "red", width, 0);
    drawLine(barsSvg, ceilingMean, "blue", width, 0);
  }, [processed, ceiling, roi, dataset, yLabel, selectedModel, onModelClick]);

  useEffect(() => {
    if (!processed || processed.results.length === 0 || !selectedModel || !scrollContainerRef.current) return;

    const { results, margin, width } = processed;

    const x = d3
      .scaleBand()
      .domain(results.map((d) => d.model))
      .range([10, width - margin.right])
      .padding(0.2);

    const selectedX = x(selectedModel);
    if (selectedX == null) return;

    const modelCenter = selectedX + x.bandwidth() / 2;
    const container = scrollContainerRef.current;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const targetScrollLeft = Math.min(
      Math.max(0, modelCenter - container.clientWidth / 2),
      maxScrollLeft
    );

    container.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth",
    });
  }, [processed, selectedModel]);

  if (noData) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "14px",
          fontStyle: "italic",
          background: "transparent",
        }}
      >
         No data available for this region under the selected evaluation dataset.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", position: "relative" }}>
      <div>
        <svg ref={ceilingRef} style={{ fontFamily: "'Lato', sans-serif" }}></svg>
      </div>

      <div
        ref={scrollContainerRef}
        style={{ overflowX: "auto", scrollBehavior: "smooth" }}
      >
        <svg ref={barsRef} style={{ fontFamily: "'Lato', sans-serif" }}></svg>
      </div>

      {scaleY && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "150px",
            pointerEvents: "none",
          }}
        >
          {stats.max !== null && (
            <div
              style={{
                position: "absolute",
                top: scaleY(stats.max) - 17,
                right: 0,
                color: "red",
                fontSize: "12px",
              }}
            >
              Ceiling Max: {stats.max.toFixed(2)}
            </div>
          )}
          {stats.mean !== null && (
            <div
              style={{
                position: "absolute",
                top: scaleY(stats.mean),
                right: 0,
                color: "blue",
                fontSize: "12px",
              }}
            >
              Ceiling Mean: {stats.mean.toFixed(2)}
            </div>
          )}
        </div>
      )}

      <div
        id="roi-tooltip"
        style={{
          position: "fixed",
          pointerEvents: "none",
          background: "white",
          border: "1px solid black",
          padding: "4px 6px",
          fontSize: "12px",
          borderRadius: "4px",
          opacity: 0,
        }}
      />
    </div>
  );
};

export default BarChartDetail;