import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { styleTooltip } from "./barchartstyles";
import { Box } from "@mui/material";

const REGION_ORDER = ["ffa", "eba", "ppa"];
const GROUP_ORDER_FALLBACK = ["body", "face", "object", "scene"];

const computeBoxStats = (values) => {
  if (!values || values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);

  const q1 = d3.quantileSorted(sorted, 0.25);
  const median = d3.quantileSorted(sorted, 0.5);
  const q3 = d3.quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const inliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  return {
    q1,
    median,
    q3,
    iqr,
    lowerWhisker: d3.min(inliers),
    upperWhisker: d3.max(inliers),
    outliers,
    min: d3.min(sorted),
    max: d3.max(sorted),
  };
};

const stableJitter = (key, amplitude) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const normalized = (hash % 1000) / 999;
  return (normalized - 0.5) * amplitude;
};

const BoxPlot = ({ regionDataMap, fileMappings, height = 560 }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const fileMap = useMemo(() => {
    const m = new Map();
    (fileMappings || []).forEach((f) => {
      if (f.serverKey) m.set(f.serverKey, f);
      if (f.uid) m.set(f.uid, f);
      if (f.file?.name) m.set(f.file.name, f);
    });
    return m;
  }, [fileMappings]);

  const getMappingForFilename = (filename) => fileMap.get(filename) || null;

  const getFileInfo = (filename) => {
    const mapping = getMappingForFilename(filename);
    if (!mapping) {
      return {
        blobURL: null,
        group: "Ungrouped",
        label: filename,
      };
    }

    return {
      blobURL: mapping.blobURL || null,
      group: mapping.groupKey || "Ungrouped",
      label: mapping.label || filename,
    };
  };

  const getGroupForFilename = (filename) => {
    const mapping = getMappingForFilename(filename);
    return mapping?.groupKey || "Ungrouped";
  };

  const aggregated = useMemo(() => {
    const rows = [];
    const allGroupsSet = new Set();

    REGION_ORDER.forEach((region) => {
      const regionResult = regionDataMap?.[region];
      const data = regionResult?.[0];
      if (!data?.mean) return;

      Object.keys(data.mean).forEach((filename) => {
        allGroupsSet.add(getGroupForFilename(filename));
      });
    });

    const groups = Array.from(allGroupsSet).sort((a, b) => {
      const ia = GROUP_ORDER_FALLBACK.indexOf(a);
      const ib = GROUP_ORDER_FALLBACK.indexOf(b);

      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;

      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    REGION_ORDER.forEach((region) => {
      const regionResult = regionDataMap?.[region];
      const data = regionResult?.[0];

      groups.forEach((group) => {
        if (!data?.mean) {
          rows.push({
            region,
            group,
            points: [],
            stats: null,
          });
          return;
        }

        const entries = Object.keys(data.mean)
          .map((filename) => ({
            filename,
            value: +data.mean[filename],
            sem: data.sem?.[filename] != null ? +data.sem[filename] : null,
          }))
          .filter((d) => getGroupForFilename(d.filename) === group);

        const stats =
          entries.length > 0
            ? computeBoxStats(entries.map((d) => d.value))
            : null;

        rows.push({
          region,
          group,
          points: entries,
          stats,
        });
      });
    });

    return { rows, groups };
  }, [regionDataMap, fileMap]);

  const hasRenderableData = useMemo(() => {
    return aggregated.groups.length > 0 && aggregated.rows.some((d) => d.points.length > 0);
  }, [aggregated]);

  useEffect(() => {
    if (!containerRef.current || !hasRenderableData) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [hasRenderableData]);

  useEffect(() => {
    const { rows, groups } = aggregated;

    if (!hasRenderableData || !rows.length || !groups.length || !containerWidth) {
      d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = {
      top: 80,
      right: 30,
      bottom: 90,
      left: 80,
    };

    const width = containerWidth;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allValues = rows.flatMap((d) => d.points.map((p) => p.value));
    const yMin = d3.min(allValues);
    const yMax = d3.max(allValues);

    if (yMin == null || yMax == null) return;

    const domainMin = yMin === yMax ? yMin - 1 : Math.min(0, yMin);
    const domainMax = yMin === yMax ? yMax + 1 : yMax;

    const y = d3
      .scaleLinear()
      .domain([domainMin, domainMax])
      .nice()
      .range([innerHeight, 0]);

    const panelGap = 30;
    const panelWidth = (innerWidth - panelGap * (REGION_ORDER.length - 1)) / REGION_ORDER.length;

    const x = d3
      .scaleBand()
      .domain(groups)
      .range([0, panelWidth])
      .paddingInner(0.28)
      .paddingOuter(0.14);

    const groupColor = d3
      .scaleOrdinal()
      .domain(groups)
      .range([
        "#8ecae6",
        "#f4a261",
        "#90be6d",
        "#c77dff",
        "#f28482",
        "#84a59d",
        "#e9c46a",
        "#6d597a",
        "#43aa8b",
        "#577590",
      ]);

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    let tooltip = d3.select(containerRef.current).select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select(containerRef.current)
        .append("div")
        .attr("class", "tooltip");
    }
    styleTooltip(tooltip);

    REGION_ORDER.forEach((region, regionIndex) => {
      const panelX = regionIndex * (panelWidth + panelGap);

      const panel = g.append("g").attr("transform", `translate(${panelX},0)`);

      const regionRows = rows.filter(
        (d) => d.region === region && d.points.length > 0 && d.stats
      );

      panel
        .append("text")
        .attr("x", panelWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "600")
        .text(region.toUpperCase());

      panel
        .append("line")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#999")
        .attr("stroke-width", 1);

      panel
        .selectAll(".whisker-line")
        .data(regionRows)
        .enter()
        .append("line")
        .attr("class", "whisker-line")
        .attr("x1", (d) => x(d.group) + x.bandwidth() / 2)
        .attr("x2", (d) => x(d.group) + x.bandwidth() / 2)
        .attr("y1", (d) => y(d.stats.lowerWhisker))
        .attr("y2", (d) => y(d.stats.upperWhisker))
        .attr("stroke", "#666")
        .attr("stroke-width", 1.4);

      panel
        .selectAll(".whisker-cap-top")
        .data(regionRows)
        .enter()
        .append("line")
        .attr("class", "whisker-cap-top")
        .attr("x1", (d) => x(d.group) + x.bandwidth() * 0.25)
        .attr("x2", (d) => x(d.group) + x.bandwidth() * 0.75)
        .attr("y1", (d) => y(d.stats.upperWhisker))
        .attr("y2", (d) => y(d.stats.upperWhisker))
        .attr("stroke", "#666")
        .attr("stroke-width", 1.4);

      panel
        .selectAll(".whisker-cap-bottom")
        .data(regionRows)
        .enter()
        .append("line")
        .attr("class", "whisker-cap-bottom")
        .attr("x1", (d) => x(d.group) + x.bandwidth() * 0.25)
        .attr("x2", (d) => x(d.group) + x.bandwidth() * 0.75)
        .attr("y1", (d) => y(d.stats.lowerWhisker))
        .attr("y2", (d) => y(d.stats.lowerWhisker))
        .attr("stroke", "#666")
        .attr("stroke-width", 1.4);

      panel
        .selectAll(".box")
        .data(regionRows)
        .enter()
        .append("rect")
        .attr("class", "box")
        .attr("x", (d) => x(d.group))
        .attr("y", (d) => y(d.stats.q3))
        .attr("width", x.bandwidth())
        .attr("height", (d) => Math.max(1, y(d.stats.q1) - y(d.stats.q3)))
        .attr("fill", (d) => groupColor(d.group))
        .attr("opacity", 0.28)
        .attr("stroke", (d) => groupColor(d.group))
        .attr("stroke-width", 1.6);

      panel
        .selectAll(".median-line")
        .data(regionRows)
        .enter()
        .append("line")
        .attr("class", "median-line")
        .attr("x1", (d) => x(d.group))
        .attr("x2", (d) => x(d.group) + x.bandwidth())
        .attr("y1", (d) => y(d.stats.median))
        .attr("y2", (d) => y(d.stats.median))
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

      panel
        .selectAll(".dot")
        .data(
          regionRows.flatMap((row) =>
            row.points.map((p) => ({
              group: row.group,
              region: row.region,
              filename: p.filename,
              value: p.value,
              sem: p.sem,
              stats: row.stats,
            }))
          )
        )
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", (d) => {
          const base = x(d.group) + x.bandwidth() / 2;
          const jitter = stableJitter(
            `${d.group}-${d.region}-${d.filename}`,
            x.bandwidth() * 0.8
          );
          return base + jitter;
        })
        .attr("cy", (d) => y(d.value))
        .attr("r", 4.3)
        .attr("fill", (d) => d3.color(groupColor(d.group)).darker(0.9))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.1)
        .attr("opacity", 0.95)
        .on("mouseover", (event, d) => {
          const { blobURL, label } = getFileInfo(d.filename);

          tooltip
            .html(`
              <div>
                <p style="margin: 0 0 6px 0;"><strong>Region:</strong> ${d.region.toUpperCase()}</p>
                <p style="margin: 0 0 6px 0;"><strong>Group:</strong> ${d.group}</p>
                <p style="margin: 0 0 10px 0;"><strong>Stimulus:</strong> ${label}</p>

                <div
                  style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    column-gap: 16px;
                    row-gap: 6px;
                    margin-bottom: 10px;
                  "
                >
                  <div><strong>Value:</strong> ${Number(d.value).toFixed(4)}</div>
                  ${
                    d.sem != null
                      ? `<div><strong>SEM:</strong> ${Number(d.sem).toFixed(4)}</div>`
                      : `<div></div>`
                  }
                  ${
                    d.stats
                      ? `
                        <div><strong>Median:</strong> ${Number(d.stats.median).toFixed(4)}</div>
                        <div><strong>Q1:</strong> ${Number(d.stats.q1).toFixed(4)}</div>
                        <div><strong>Q3:</strong> ${Number(d.stats.q3).toFixed(4)}</div>
                        <div></div>
                      `
                      : ""
                  }
                </div>

                ${
                  blobURL
                    ? `<img
                        src="${blobURL}"
                        alt="Thumbnail"
                        style="width: 140px; height: 140px; object-fit: cover; margin-top: 4px; border: 1px solid #ccc;"
                      />`
                    : ""
                }
              </div>
            `)
            .style("display", "block")
            .style("opacity", 1);
        })
        .on("mousemove", (event) => {
          const containerRect = containerRef.current.getBoundingClientRect();
          tooltip
            .style("left", `${event.clientX - containerRect.left + 10}px`)
            .style("top", `${event.clientY - containerRect.top - 40}px`);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });

      if (regionIndex === 0) {
        panel.append("g").call(d3.axisLeft(y));
      }

      panel
        .append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("font-size", "11px");
    });

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 70)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Stimulus Groups");

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -55)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .text("Predicted Response Distribution");

    const legend = g
      .append("g")
      .attr("transform", `translate(${Math.max(0, innerWidth - 80 - aggregated.groups.length * 90)}, -60)`);

    aggregated.groups.forEach((group, i) => {
      const row = legend.append("g").attr("transform", `translate(${i * 90},0)`);

      row
        .append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", groupColor(group))
        .attr("opacity", 0.5);

      row
        .append("text")
        .attr("x", 20)
        .attr("y", 11)
        .style("font-size", "12px")
        .text(group);
    });

    return () => {
      d3.select(containerRef.current).select(".tooltip").remove();
    };
  }, [aggregated, containerWidth, height, fileMap, hasRenderableData]);

  if (!hasRenderableData) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          padding: "20px 0",
          textAlign: "center",
          color: "#888",
          fontStyle: "italic",
        }}
      >
        No cross-region insight data available yet.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height,
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "10px",
      }}
    >
      <svg ref={svgRef} style={{ marginTop: "10px", width: "100%" }} />
    </div>
  );
};

export default BoxPlot;