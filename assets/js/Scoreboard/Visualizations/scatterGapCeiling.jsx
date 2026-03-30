import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// color/ name map
const roiColors = { ppa: "#1f77b4", ffa: "#ff7f0e", eba: "#2ca02c", overall: "#666" };
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
    svg.attr("width", dimensions.width).attr("height", dimensions.height).style("font-family", "'Lato', sans-serif");
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 60, right: 60, bottom: 60, left: 70 };
    const mainSize = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);
    const centerXOffset = (width - margin.left - margin.right - mainSize) / 2;

    const x = d3.scaleLinear().domain([-0.4, 1.0]).range([0, mainSize]);
    const y = d3.scaleLinear().domain([0, 1.0]).range([mainSize, 0]);


    const activeROIs = (Array.isArray(roi) ? roi : (roi ? [roi] : [])).filter(r => typeof r === 'string');
    const isAllROIInLegend = activeROIs.includes("Across Regions") || activeROIs.length === 0;

    const visibleROIs = Object.entries(roiColors).filter(([k]) => {
      if (k === 'overall') return false;
      return isAllROIInLegend || activeROIs.some(r => r && r.toLowerCase() === k.toLowerCase());
    });

    const rowHeight = 18;
    const legendG = svg.append("g").attr("transform", `translate(20, 20)`);
    visibleROIs.forEach(([k, c], i) => {
      const row = legendG.append("g").attr("transform", `translate(0, ${i * rowHeight})`);
      row.append("circle").attr("r", 5).attr("fill", c);
      row.append("text").attr("x", 12).attr("y", 4).style("font-size", "10px").style("font-weight", "600").text(k.toUpperCase());
    });

    const shapeLegend = legendG.append("g").attr("transform", `translate(0, ${visibleROIs.length * rowHeight + 15})`);
    Object.entries(datasetTypeLabels).forEach(([t, l], i) => {
      const row = shapeLegend.append("g").attr("transform", `translate(0, ${i * rowHeight})`);
      const shapeFn = t === "circle" ? d3.symbolCircle : t === "triangle" ? d3.symbolTriangle : d3.symbolDiamond;
      row.append("path").attr("d", d3.symbol().type(shapeFn).size(40)()).attr("fill", "#666").attr("transform", "translate(0, -1)");
      row.append("text").attr("x", 12).attr("y", 4).style("font-size", "10px").text(l);
    });

    //drawing
    const g = svg.append("g").attr("transform", `translate(${margin.left + centerXOffset},${margin.top})`);
    g.append("g").attr("transform", `translate(0,${mainSize})`).call(d3.axisBottom(x).ticks(6));
    g.append("g").call(d3.axisLeft(y).ticks(6));
    g.append("g").attr("stroke", "#eee").attr("stroke-dasharray", "2,2").call(d3.axisLeft(y).tickSize(-mainSize).tickFormat(""));

    const activeInfo = hoveredData || selectedPoint;
    const hoverLayer = g.append("g").attr("class", "hover-layer");

    g.selectAll(".agg-dot")
      .data(aggregatedPoints)
      .enter()
      .append("path")
      .attr("transform", d => `translate(${x(d.ceiling_mean)},${y(d.gap_mean)})`)
      .attr("d", d => d3.symbol().type(datasetShapes[d.id.split("/")[0]] || d3.symbolCircle).size(120)())
      .attr("fill", d => roiColors[d.id.split("/")[1]] || "#999")
      .attr("stroke", d => d.id === selectedPoint?.id ? "#000" : "#fff")
      .attr("stroke-width", d => d.id === selectedPoint?.id ? 2 : 1)
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
          .attr("stroke", "black")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.9);

        hoverLayer.append("text")
          .attr("x", px).attr("y", i === 0 ? py - 14 : py + 22)
          .attr("text-anchor", "middle")
          .style("font-size", "10px").style("font-weight", "bold")
          .text(`Trained on ${pt.train}`);
      });
    }
  }, [dimensions, aggregatedPoints, roi, hoveredData, selectedPoint]);

  const displayInfo = hoveredData || selectedPoint;

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fafafa", borderRadius: 12, overflow: "hidden" }}>
      <div ref={containerRef} style={{ flex: 1, position: "relative", minWidth: 0 }}></div>
      <div style={{ width: "260px", borderLeft: "1px solid #eee", padding: "20px", backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: "15px" }}>
        <h5 style={{ margin: 0, fontSize: "14px", color: "#333", borderBottom: "2px solid #1890ff", paddingBottom: "8px" }}>ROI/Dataset Insight</h5>
        {displayInfo ? (
          <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
             <div style={{ background: "#f0f7ff", padding: "10px", borderRadius: "6px" }}>
              <div style={{ fontWeight: "bold", color: "#0050b3" }}>{datasetLabelMap[displayInfo.id.split("/")[0]] || displayInfo.id.split("/")[0]}</div>
              <div style={{ color: "#555", textTransform: "uppercase", fontSize: "10px" }}>Region: {displayInfo.id.split("/")[1]}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: "#fafafa", padding: "8px", borderRadius: "4px", textAlign: "center" }}>
                <div style={{ color: "#888", fontSize: "10px" }}>Ceiling</div>
                <div style={{ fontWeight: "bold" }}>{displayInfo.ceiling_mean.toFixed(3)}</div>
              </div>
              <div style={{ background: "#fafafa", padding: "8px", borderRadius: "4px", textAlign: "center" }}>
                <div style={{ color: "#888", fontSize: "10px" }}>Avg Gap</div>
                <div style={{ fontWeight: "bold" }}>{displayInfo.gap_mean.toFixed(3)}</div>
              </div>
            </div>
            <div style={{ marginTop: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "8px", color: "#888" }}>TRAINING SOURCES:</div>
              {displayInfo.points.map((pt, i) => (
                <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between" }}>
                  <span>{pt.train}:</span><span style={{ fontWeight: 600 }}>{pt.gap.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ color: "#999", fontSize: "12px", textAlign: "center", marginTop: "40px", fontStyle: "italic" }}>Hover or click a point</div>
        )}
      </div>
    </div>
  );
};

export default ScatterGapCeiling;