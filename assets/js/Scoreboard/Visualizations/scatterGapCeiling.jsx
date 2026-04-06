import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// color/ name map — theme-aligned palette
const roiColors = { ppa: "#8966a3", ffa: "#c4708a", eba: "#6a9fa0", overall: "#aaa" };
const datasetShapes = {
  bold_5000: d3.symbolCircle, bonner_2021: d3.symbolCircle, kingbaker_2019: d3.symbolCircle,
  wardle_2020: d3.symbolCircle, bmd_2024: d3.symbolTriangle, nsd_syn: d3.symbolDiamond,
  nsd_1000: d3.symbolCircle, murty185: d3.symbolCircle,
};
const datasetLabelMap = {
  murty185: "Murty185", nsd_1000: "NSD1000", bold_5000: "BOLD5000v2",
  bonner_2021: "Bonner2021", bmd_2024: "BMD2024", kingbaker_2019: "King2019",
  wardle_2020: "Wardle2020", nsd_syn: "NSD synthetic",
};
const datasetTypeLabels = {
  circle: "Natural Dataset", triangle: "Video Dataset (BMD)", diamond: "Synthetic / OOD",
};

const ScatterGapCeiling = ({ murtyData, nsdData, ceilingData, roi, dataset, training }) => {
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredData, setHoveredData] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // data processing
  const aggregatedPoints = useMemo(() => {
    if (!murtyData && !nsdData) return [];
    
    const process = (rawData, sourceLabel) => {
      if (!rawData || typeof rawData !== 'object') return [];
      return Object.entries(rawData).map(([key, stats]) => {
        if (!key || !key.includes("/")) return null;
        const [ds, rName] = key.split("/");
        
        const ceilingObj = ceilingData?.[key] || ceilingData?.[rName]?.[ds];
        const rawCeilingVals = ceilingObj?.correlation_points || [];
        const cMin = rawCeilingVals.length > 0 ? d3.min(rawCeilingVals) : (stats?.ceiling_mean || 0);
        const cMax = rawCeilingVals.length > 0 ? d3.max(rawCeilingVals) : (stats?.ceiling_mean || 0);

        return {
          id: key, 
          dataset: ds, 
          roi: rName.toLowerCase(), 
          train: sourceLabel,
          gap: stats?.normalized_gap ?? 0, 
          ceiling: stats?.ceiling_mean ?? 0, 
          cRange: [cMin, cMax], 
          raw: stats
        };
      }).filter(item => item !== null);
    };

    let all = [];
    if (training === "Murty185") {
      all = process(murtyData, "Murty185");
    } else if (training === "NSD") {
      all = process(nsdData, "NSD1000");
    } else {
      all = [...process(murtyData, "Murty185"), ...process(nsdData, "NSD1000")];
    }

    
    const selectedRegions = (Array.isArray(roi) ? roi : (roi ? [roi] : [])).filter(r => typeof r === 'string');
    const selectedDatasets = (Array.isArray(dataset) ? dataset : (dataset ? [dataset] : [])).filter(ds => typeof ds === 'string');

    const isAllROI = selectedRegions.includes("Across Regions") || selectedRegions.length === 0;
    const isAllDS = selectedDatasets.length === 0;

    const filtered = all.filter(d => {
      const roiMatch = isAllROI || selectedRegions.some(r => r && r.toLowerCase() === d.roi.toLowerCase());
      const dsMatch = isAllDS || selectedDatasets.some(ds => ds && ds.toLowerCase() === d.dataset.toLowerCase());
      return roiMatch && dsMatch;
    });

    return d3.rollups(filtered, v => ({
      ceiling_mean: d3.mean(v, d => d.ceiling) || 0,
      gap_mean: d3.mean(v, d => d.gap) || 0,
      cRange: [d3.min(v, d => d.cRange[0]), d3.max(v, d => d.cRange[1])],
      points: v 
    }), d => `${d.dataset}/${d.roi}`).map(([key, val]) => ({ id: key, ...val }));
  }, [murtyData, nsdData, ceilingData, roi, dataset, training]);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || aggregatedPoints.length === 0) return;

    const container = d3.select(containerRef.current);
    let svg = container.select("svg");
    if (svg.empty()) svg = container.append("svg");
    svg.attr("width", dimensions.width).attr("height", dimensions.height).style("font-family", "'Inter', system-ui, sans-serif");
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const mainSize = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);
    const centerXOffset = (width - margin.left - margin.right - mainSize) / 2;

    const x = d3.scaleLinear().domain([-0.4, 1.0]).range([0, mainSize]);
    const y = d3.scaleLinear().domain([0, 1.0]).range([mainSize, 0]);

    // axis labels
    const g = svg.append("g").attr("transform", `translate(${margin.left + centerXOffset},${margin.top})`);
    // grid lines
    g.append("g")
      .attr("stroke", "#e8e2ee")
      .attr("stroke-dasharray", "3,3")
      .call(d3.axisLeft(y).tickSize(-mainSize).tickFormat(""))
      .call(gg => { gg.select(".domain").remove(); gg.selectAll("line").attr("stroke", "#e8e2ee"); });
    g.append("g")
      .attr("stroke", "#e8e2ee")
      .attr("stroke-dasharray", "3,3")
      .attr("transform", `translate(0,${mainSize})`)
      .call(d3.axisBottom(x).tickSize(-mainSize).tickFormat(""))
      .call(gg => { gg.select(".domain").remove(); gg.selectAll("line").attr("stroke", "#e8e2ee"); });

    // axes
    g.append("g")
      .attr("transform", `translate(0,${mainSize})`)
      .call(d3.axisBottom(x).ticks(6))
      .call(gg => {
        gg.select(".domain").attr("stroke", "#ccc");
        gg.selectAll("line").attr("stroke", "#ccc");
        gg.selectAll("text").attr("fill", "#777").style("font-size", "11px").style("font-family", "'Inter', system-ui, sans-serif");
      });
    g.append("g")
      .call(d3.axisLeft(y).ticks(6))
      .call(gg => {
        gg.select(".domain").attr("stroke", "#ccc");
        gg.selectAll("line").attr("stroke", "#ccc");
        gg.selectAll("text").attr("fill", "#777").style("font-size", "11px").style("font-family", "'Inter', system-ui, sans-serif");
      });

    // axis labels
    g.append("text")
      .attr("x", mainSize / 2)
      .attr("y", mainSize + 48)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-family", "'Inter', system-ui, sans-serif")
      .attr("fill", "#888")
      .text("Ceiling");
    g.append("text")
      .attr("transform", `translate(-52, ${mainSize / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-family", "'Inter', system-ui, sans-serif")
      .attr("fill", "#888")
      .text("Normalized Gap to Ceiling");

    const activeInfo = hoveredData || selectedPoint;
    const hoverLayer = g.append("g").attr("class", "hover-layer");

    g.selectAll(".agg-dot")
      .data(aggregatedPoints)
      .enter()
      .append("path")
      .attr("transform", d => `translate(${x(d.ceiling_mean)},${y(d.gap_mean)})`)
      .attr("d", d => d3.symbol().type(datasetShapes[d.id.split("/")[0]] || d3.symbolCircle).size(120)())
      .attr("fill", d => roiColors[d.id.split("/")[1]] || "#999")
      .attr("stroke", d => d.id === selectedPoint?.id ? "#4a2e6e" : "#fff")
      .attr("stroke-width", d => d.id === selectedPoint?.id ? 2.5 : 1)
      .attr("opacity", d => activeInfo ? (d.id === activeInfo.id ? 0.8 : 0.3) : 1)
      .style("cursor", "pointer")
      .on("mouseover", (e, d) => setHoveredData(d))
      .on("mouseout", () => setHoveredData(null))
      .on("click", (e, d) => setSelectedPoint(d.id === selectedPoint?.id ? null : d));

    if (activeInfo) {
      const color = roiColors[activeInfo.id.split("/")[1]] || "#999";
      const cy = y(activeInfo.gap_mean);

      if (activeInfo.cRange && activeInfo.cRange.length >= 2) {
        hoverLayer.append("line")
          .attr("x1", x(activeInfo.cRange[0]))
          .attr("x2", x(activeInfo.cRange[1]))
          .attr("y1", cy)
          .attr("y2", cy)
          .attr("stroke", color)
          .attr("stroke-width", 6)
          .attr("opacity", 0.7)
          .attr("stroke-linecap", "round");
      }

      activeInfo.points.forEach((pt, i) => {
        const px = x(pt.ceiling);
        const py = y(pt.gap);
        const shapeFn = datasetShapes[pt.dataset] || d3.symbolCircle;

        hoverLayer.append("path")
          .attr("d", d3.symbol().type(shapeFn).size(100)())
          .attr("transform", `translate(${px},${py})`)
          .attr("fill", color)
          .attr("stroke", "rgba(255,255,255,0.8)")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.9);

        hoverLayer.append("text")
          .attr("x", px).attr("y", i === 0 ? py - 14 : py + 22)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("font-weight", "600")
          .style("font-family", "'Inter', system-ui, sans-serif")
          .attr("fill", "#555")
          .text(`Trained on ${pt.train}`);
      });
    }
  }, [dimensions, aggregatedPoints, roi, hoveredData, selectedPoint]);

  const displayInfo = hoveredData || selectedPoint;

  const activeROIs = (Array.isArray(roi) ? roi : (roi ? [roi] : [])).filter(r => typeof r === 'string');
  const isAllROIInLegend = activeROIs.includes("Across Regions") || activeROIs.length === 0;
  const visibleROIs = Object.entries(roiColors).filter(([k]) => {
    if (k === 'overall') return false;
    return isAllROIInLegend || activeROIs.some(r => r && r.toLowerCase() === k.toLowerCase());
  });

  const panelFont = { fontFamily: "'Inter', system-ui, sans-serif" };

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--background-color, #f7f7f4)", borderRadius: 12, overflow: "hidden" }}>
      <div ref={containerRef} style={{ flex: 1, position: "relative", minWidth: 0 }}></div>

      <div style={{ width: "240px", borderLeft: "1px solid #e0ddd8", padding: "20px 18px", backgroundColor: "var(--background-color, #f7f7f4)", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>

        {/* Legend */}
        <div>
          <div style={{ ...panelFont, fontSize: "10px", fontWeight: 600, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Legend</div>
          <div style={{ marginBottom: "8px" }}>
            <div style={{ ...panelFont, fontSize: "10px", color: "#999", marginBottom: "5px", fontWeight: 500 }}>ROI</div>
            {visibleROIs.map(([k, c]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={c} /></svg>
                <span style={{ ...panelFont, fontSize: "11px", color: "#555", fontWeight: 500 }}>{k.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...panelFont, fontSize: "10px", color: "#999", marginBottom: "5px", fontWeight: 500 }}>Dataset Type</div>
            {[
              { label: "Natural Dataset", shape: "circle" },
              { label: "Video (BMD)", shape: "triangle" },
              { label: "Synthetic / OOD", shape: "diamond" },
            ].map(({ label, shape }) => (
              <div key={shape} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                <svg width="12" height="12" viewBox="-6 -6 12 12">
                  {shape === "circle" && <circle cx="0" cy="0" r="4.5" fill="#999" />}
                  {shape === "triangle" && <polygon points="0,-5 4.5,4 -4.5,4" fill="#999" />}
                  {shape === "diamond" && <polygon points="0,-5 5,0 0,5 -5,0" fill="#999" />}
                </svg>
                <span style={{ ...panelFont, fontSize: "11px", color: "#555" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e0ddd8" }} />

        {/* Insight panel */}
        <div>
          <div style={{ ...panelFont, fontSize: "10px", fontWeight: 600, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Point Detail</div>
          {displayInfo ? (
            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "10px", ...panelFont }}>
              <div style={{ background: "rgba(137,102,163,0.08)", padding: "10px", borderRadius: "6px", border: "1px solid #d6cfe0" }}>
                <div style={{ fontWeight: 600, color: "#6b4a8c", fontSize: "13px" }}>{datasetLabelMap[displayInfo.id.split("/")[0]] || displayInfo.id.split("/")[0]}</div>
                <div style={{ color: "#888", textTransform: "uppercase", fontSize: "10px", marginTop: "2px", letterSpacing: "0.06em" }}>
                  Region: <span style={{ color: roiColors[displayInfo.id.split("/")[1]] || "#888", fontWeight: 600 }}>{displayInfo.id.split("/")[1]?.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ background: "rgba(0,0,0,0.03)", padding: "8px", borderRadius: "4px", textAlign: "center", border: "1px solid #e8e2ee" }}>
                  <div style={{ color: "#aaa", fontSize: "10px" }}>Ceiling</div>
                  <div style={{ fontWeight: 600, color: "#444", fontSize: "13px" }}>{displayInfo.ceiling_mean.toFixed(3)}</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.03)", padding: "8px", borderRadius: "4px", textAlign: "center", border: "1px solid #e8e2ee" }}>
                  <div style={{ color: "#aaa", fontSize: "10px" }}>Avg Gap</div>
                  <div style={{ fontWeight: 600, color: "#444", fontSize: "13px" }}>{displayInfo.gap_mean.toFixed(3)}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", color: "#bbb", textTransform: "uppercase", marginBottom: "6px" }}>Training Sources</div>
                {displayInfo.points.map((pt, i) => (
                  <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #eee8f4", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "#666" }}>{pt.train}</span>
                    <span style={{ fontWeight: 600, color: "#555" }}>{pt.gap.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "#bbb", fontSize: "12px", textAlign: "center", marginTop: "20px", fontStyle: "italic", ...panelFont }}>Hover or click a point</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScatterGapCeiling;