import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const RoiBarChart = ({ data, roi, dataset, ceiling, rank, yLabel, onModelClick }) => {
  const ceilingRef = useRef();
  const barsRef = useRef();
  const [selectedModel, setSelectedModel] = useState(null);
  const [stats, setStats] = useState({ max: null, mean: null });
  const [scaleY, setScaleY] = useState(null);

   useEffect(() => {
      setSelectedModel(null);
      if (onModelClick) onModelClick(null); 
    }, [data, roi, dataset]);

  useEffect(() => {
    console.log("🔍 RoiBarChart props:", { roi, dataset, ceiling, data });

    if (!data || !roi || !data[roi]) return;
    if (!ceiling || !ceiling[roi] || !ceiling[roi][dataset]) return;

    const roiData = data[roi];

    // ==== 数据处理 ====
    const models = Object.keys(roiData).filter((m) => m !== "ceiling");
    let results = models
      .map((model) => {
        const val = roiData[model]?.[dataset]?.[0];
        return { model, val };
      })
      .filter((d) => d.val !== undefined);

    if (rank && rank !== "") {
      results = [...results].sort((a, b) => d3.descending(a.val, b.val));
    }

    const ceilingMean = ceiling[roi][dataset]?.ceiling_mean ?? null;
    const ceilingMax = ceiling[roi][dataset]?.ceiling_max ?? null;

    setStats({ max: ceilingMax, mean: ceilingMean });

    // ==== 尺寸 ====
    const barWidth = 30;
    const margin = { top: 40, right: 20, bottom: 180, left: 60 };
    const height = 400;

    const y = d3
      .scaleLinear()
      .domain([-0.3, 1])
      .range([height - margin.bottom, margin.top]);

    setScaleY(() => y);

    // ================= 左边 ceiling SVG =================
    const ceilingSvg = d3.select(ceilingRef.current);
    ceilingSvg.selectAll("*").remove();
    const ceilingWidth = margin.left + 50;

    ceilingSvg.attr("width", ceilingWidth).attr("height", height);

    // 灰色虚线
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

    // ceiling bar
    if (ceilingMean != null) {
      const rect = ceilingSvg
        .append("rect")
        .attr("x", margin.left + 15)
        .attr("y", Math.min(y(0), y(ceilingMean)))
        .attr("width", barWidth)
        .attr("height", Math.abs(y(0) - y(ceilingMean)))
        .attr("fill", "#d3d3d3")
        .attr("stroke", "black");

      // 👉 hover tooltip when roi !== "Overall"
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

      // ceiling label 固定在 0.9
      ceilingSvg
        .append("text")
        .attr("x", margin.left + 15 + barWidth / 2)
        .attr("y", y(0.95))
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "black")
        .text(ceilingMean.toFixed(2));

      // correlation_points
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

    // y 轴
    ceilingSvg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((g) => {
        g.select(".domain").attr("stroke", "black");
        g.selectAll("line").remove();
        g.selectAll("text").attr("fill", "black");
      });

    // y 轴 label
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

    // x label for ceiling
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

    // ================= 右边 bars SVG =================
    const barsSvg = d3.select(barsRef.current);
    barsSvg.selectAll("*").remove();

    const width = results.length * (barWidth + 10) + margin.right;
    barsSvg.attr("width", width).attr("height", height);

    const x = d3
      .scaleBand()
      .domain(results.map((d) => d.model))
      .range([10, width - margin.right])
      .padding(0.2);

    // 灰色虚线 (在 bar 下层)
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

    // bars
    barsSvg
      .append("g")
      .selectAll("rect")
      .data(results)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.model))
      .attr("y", (d) => Math.min(y(0), y(d.val)))
      .attr("height", (d) => Math.abs(y(0) - y(d.val)))
      .attr("width", x.bandwidth())
      .attr("fill", "#d3d3d3")
      .attr("stroke", "black");

    // bar 数值 label
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
      .attr("fill", "black")
      .text((d) => d.val.toFixed(2));

    // X labels
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
      .attr("fill", "black")
      .attr(
        "transform",
        (d) =>
          `rotate(60, ${x(d.model) + x.bandwidth() / 2}, ${
            height - margin.bottom
          })`
      )

      .text((d) => d.model)
      .style("cursor", "pointer") // ✅ 可以链式写
      .on("click", (event, d) => {
        const newSelection = selectedModel === d.model ? null : d.model; // 🚀 再点一次取消
        setSelectedModel(newSelection);
        if (onModelClick) {
          onModelClick(newSelection); // ✅ 父组件也知道
        }
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

    // 画 ceiling mean/max
    drawLine(ceilingSvg, ceilingMax, "red", ceilingWidth, margin.left);
    drawLine(ceilingSvg, ceilingMean, "blue", ceilingWidth, margin.left);
    drawLine(barsSvg, ceilingMax, "red", width, 0);
    drawLine(barsSvg, ceilingMean, "blue", width, 0);
  }, [data, roi, dataset, ceiling, rank, yLabel, onModelClick]);

  return (
    <div style={{ display: "flex", flexDirection: "row", position: "relative" }}>
      {/* 左边 ceiling + y 轴 */}
      <div>
        <svg ref={ceilingRef}></svg>
      </div>

      {/* 右边模型 bars */}
      <div style={{ overflowX: "auto" }}>
        <svg ref={barsRef}></svg>
      </div>

      {/* 固定在右边的 label */}
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

      {/* Tooltip 容器 */}
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

export default RoiBarChart;
