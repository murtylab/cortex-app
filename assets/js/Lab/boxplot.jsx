import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { styleTooltip } from "./barchartstyles";
import { LAB_CHART, LAB_COLORS, styleLabAxis, applyLabAxisTitle } from "./labTheme";

/**
 * @typedef {Object} FileMapping
 * @property {string} [uid]
 * @property {string} [serverKey]
 * @property {string} [label]
 * @property {string} [groupKey]
 * @property {string | null} [blobURL]
 * @property {{ name?: string }} [file]
 */

/**
 * @typedef {Object} BoxPlotProps
 * @property {Record<string, any> | undefined} regionDataMap
 * @property {FileMapping[] | undefined} fileMappings
 * @property {string[] | undefined} regionOrder
 * @property {number | undefined} height
 * @property {boolean | undefined} labChart
 */

const GROUP_ORDER_FALLBACK = ["body", "face", "object", "scene"];
const GROUP_COLORS = [
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
];
const PANEL_PLOT_WIDTH = 340;
const PANEL_AXIS_WIDTH = 56;
const PANEL_WIDTH = PANEL_AXIS_WIDTH + PANEL_PLOT_WIDTH;
const PANEL_GAP = 36;
const MAX_VISIBLE_PANELS = 3;
const LEGEND_COLUMN_WIDTH = 118;
const TOOLTIP_OFFSET = 14;

const positionTooltip = (tooltip, event) => {
  const node = tooltip.node();
  if (!node) return;

  const tooltipWidth = node.offsetWidth || 0;
  const tooltipHeight = node.offsetHeight || 0;

  let left = event.clientX + TOOLTIP_OFFSET;
  let top = event.clientY - tooltipHeight - TOOLTIP_OFFSET;

  if (left + tooltipWidth > window.innerWidth - 12) {
    left = event.clientX - tooltipWidth - TOOLTIP_OFFSET;
  }

  if (left < 12) {
    left = 12;
  }

  if (top < 12) {
    top = event.clientY + TOOLTIP_OFFSET;
  }

  if (top + tooltipHeight > window.innerHeight - 12) {
    top = Math.max(12, window.innerHeight - tooltipHeight - 12);
  }

  tooltip.style("left", `${left}px`).style("top", `${top}px`);
};

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

/** @param {BoxPlotProps} props */
const BoxPlot = ({ regionDataMap, fileMappings, regionOrder = [], height = 560, labChart = false }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const regions = useMemo(() => {
    if (Array.isArray(regionOrder) && regionOrder.length > 0) {
      return regionOrder;
    }
    return Object.keys(regionDataMap || {});
  }, [regionOrder, regionDataMap]);

  const fileMap = useMemo(() => {
    const m = new Map();
    (fileMappings || []).forEach((f) => {
      if (f.serverKey) m.set(f.serverKey, f);
      if (f.uid) m.set(f.uid, f);
      if (f.file?.name) m.set(f.file.name, f);
    });
    return m;
  }, [fileMappings]);


  // 更智能的 groupKey 匹配，避免 Ungrouped
  const getMappingForFilename = (filename) => {
    // 1. 直接查 fileMap
    let mapping = fileMap.get(filename);
    if (mapping) return mapping;
    // 2. 尝试用 basename 匹配 label
    const base = filename.split("/").pop();
    for (const f of fileMappings || []) {
      if (f.label === base) return f;
    }
    // 3. 尝试用 serverKey 匹配
    for (const f of fileMappings || []) {
      if (f.serverKey === filename) return f;
    }
    return null;
  };

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

    regions.forEach((region) => {
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

    regions.forEach((region) => {
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
  }, [regionDataMap, fileMap, fileMappings, regions]);

  const hasRenderableData = useMemo(() => {
    return aggregated.groups.length > 0 && aggregated.rows.some((d) => d.points.length > 0);
  }, [aggregated]);

  const visiblePanelCount = Math.max(1, Math.min(MAX_VISIBLE_PANELS, regions.length));

  const margin = {
    top: 48,
    right: 24,
    bottom: 56,
    left: 8,
  };

  const viewportInnerWidth =
    visiblePanelCount * PANEL_WIDTH + (visiblePanelCount - 1) * PANEL_GAP;
  const totalInnerWidth =
    Math.max(1, regions.length) * PANEL_WIDTH +
    Math.max(0, regions.length - 1) * PANEL_GAP;
  const svgWidth = margin.left + margin.right + totalInnerWidth;
  const plotsViewportWidth = margin.left + margin.right + viewportInnerWidth;

  useEffect(() => {
    const { rows, groups } = aggregated;

    if (!hasRenderableData || !rows.length || !groups.length || regions.length === 0) {
      d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const innerHeight = height - margin.top - margin.bottom;

    const x = d3
      .scaleBand()
      .domain(groups)
      .range([0, PANEL_PLOT_WIDTH])
      .paddingInner(0.28)
      .paddingOuter(0.14);

    const groupColor = d3.scaleOrdinal().domain(groups).range(GROUP_COLORS);

    const g = svg
      .attr("width", svgWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    let tooltip = d3.select("body").select(".boxplot-tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip boxplot-tooltip");
    }
    styleTooltip(tooltip);
    tooltip
      .style("position", "fixed")
      .style("max-height", "calc(100vh - 24px)")
      .style("overflow-y", "auto");

    regions.forEach((region, regionIndex) => {
      const panelX = regionIndex * (PANEL_WIDTH + PANEL_GAP);
      const panel = g.append("g").attr("transform", `translate(${panelX},0)`);
      const plot = panel
        .append("g")
        .attr("transform", `translate(${PANEL_AXIS_WIDTH},0)`);

      const regionRows = rows.filter(
        (d) => d.region === region && d.points.length > 0 && d.stats
      );

      const regionValues = regionRows.flatMap((d) => d.points.map((p) => p.value));
      const yMin = d3.min(regionValues);
      const yMax = d3.max(regionValues);
      if (yMin == null || yMax == null) return;

      // Independent y-scale per region (do not share across panels).
      const maxAbs = Math.max(Math.abs(yMin), Math.abs(yMax));
      const safeMaxAbs = maxAbs === 0 ? 1 : maxAbs;
      const y = d3
        .scaleLinear()
        .domain([-safeMaxAbs, safeMaxAbs])
        .nice()
        .range([innerHeight, 0]);

      panel
        .append("text")
        .attr("x", PANEL_AXIS_WIDTH + PANEL_PLOT_WIDTH / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-family", labChart ? LAB_CHART.category.fontFamily : null)
        .style("font-size", labChart ? "11px" : "16px")
        .style("font-weight", labChart ? 400 : 600)
        .style("fill", labChart ? LAB_CHART.category.fill : null)
        .text(region.toUpperCase());

      const yAxisG = panel
        .append("g")
        .attr("transform", `translate(${PANEL_AXIS_WIDTH},0)`)
        .call(d3.axisLeft(y).ticks(6));
      if (labChart) {
        styleLabAxis(yAxisG);
        yAxisG.select(".domain").remove();
      }

      const yTitle = panel
        .append("text")
        .attr("x", -innerHeight / 2)
        .attr("y", 10)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .style("font-size", labChart ? `${LAB_CHART.axisTitle.fontSize}px` : "12px")
        .text(labChart ? "Predicted response" : "Predicted Response");
      if (labChart) applyLabAxisTitle(yTitle);

      plot
        .append("line")
        .attr("x1", 0)
        .attr("x2", PANEL_PLOT_WIDTH)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#999")
        .attr("stroke-width", 1);

      plot
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

      plot
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

      plot
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

      plot
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

      plot
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

      plot
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

          positionTooltip(tooltip, event);
        })
        .on("mousemove", (event) => {
          positionTooltip(tooltip, event);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });

      const xAxisG = plot
        .append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x));
      xAxisG
        .selectAll("text")
        .style("font-family", labChart ? LAB_CHART.tick.fontFamily : null)
        .style("font-size", "11px")
        .style("fill", labChart ? LAB_CHART.tick.fill : null)
        .attr("dy", (_d, i) => (i % 2 === 0 ? "1.2em" : "2.3em"));
      if (labChart) {
        xAxisG.selectAll("path, line")
          .attr("stroke", LAB_COLORS.hairline)
          .attr("stroke-width", 1);
        xAxisG.select(".domain").remove();
      }
    });

    return () => {
      d3.select("body").selectAll(".boxplot-tooltip").remove();
    };
  }, [aggregated, fileMap, hasRenderableData, height, regions.length, svgWidth, totalInnerWidth, margin.left, margin.top, labChart]);

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
        maxWidth: `${LEGEND_COLUMN_WIDTH + plotsViewportWidth}px`,
        height,
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        paddingTop: "10px",
        gap: 0,
      }}
    >
      {/* Group conditions: fixed left column (does not scroll with region panels) */}
      <div
        style={{
          flex: `0 0 ${LEGEND_COLUMN_WIDTH}px`,
          width: LEGEND_COLUMN_WIDTH,
          paddingTop: margin.top + 10,
          paddingRight: 10,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: labChart ? "var(--lab-page-bg, #f7f7f4)" : "#fff",
          zIndex: 2,
        }}
      >
        {aggregated.groups.map((group, i) => {
          const color = GROUP_COLORS[i % GROUP_COLORS.length];
          return (
            <div
              key={group}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontFamily: labChart
                  ? "var(--lab-mono, 'IBM Plex Mono', monospace)"
                  : "inherit",
                fontWeight: 400,
                color: labChart ? LAB_COLORS.text : "#333",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  flex: "0 0 12px",
                  display: "inline-block",
                  borderRadius: 2,
                  background: color,
                  opacity: 0.75,
                }}
              />
              {group}
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          overflowX: "auto",
          height: "100%",
        }}
      >
        <svg
          ref={svgRef}
          style={{
            width: `${svgWidth}px`,
            minWidth: `${svgWidth}px`,
            fontFamily: labChart
              ? "'IBM Plex Mono', ui-monospace, monospace"
              : "'Inter', sans-serif",
          }}
        />
      </div>
    </div>
  );
};

export default BoxPlot;