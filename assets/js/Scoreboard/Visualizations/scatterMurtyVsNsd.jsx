import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
const uniIcon = '/assets/img/scatterplot/uni.webp';
const multiIcon = '/assets/img/scatterplot/multi.webp';

const ScatterMurtyVsNsd = ({ murtyData, nsdData, roi, dataset, chartType, showOverlay, onModelClick }) => {
  const containerRef = useRef();
  const [selectedModel, setSelectedModel] = useState(null);

  // for hover interaction
  const [hoveredData, setHoveredData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  
  const datasetArray = Array.isArray(dataset) ? dataset : (dataset ? [dataset] : []);

  // data processing
  const points = React.useMemo(() => {
    if (!murtyData || !nsdData || !murtyData[roi]) return [];
    
    const pts = [];
    Object.keys(murtyData[roi]).forEach((model) => {
      if (model === "ceiling") return;
      const murtyVals = murtyData[roi][model];
      const nsdVals = nsdData[roi][model];
      if (!murtyVals || !nsdVals) return;

      Object.keys(murtyVals).forEach((ds) => {
        if (datasetArray.length > 0 && !datasetArray.includes(ds)) return;
        if (["murty185", "nsd_1000", "ceiling"].includes(ds)) return;
        const x = murtyVals[ds]?.[0];
        const y = nsdVals[ds]?.[0];
        if (x != null && y != null) pts.push({ model, dataset: ds, x, y });
      });
    });
    return pts;
  }, [murtyData, nsdData, roi, datasetArray]); 

  //for global usage
  const color_map = {
      bold_5000: "#1f78b4",
      bonner_2021: "#4dd0e1",
      bmd_2024: "#60bd68",
      kingbaker_2019: "#9e75d6",
      wardle_2020: "#e377c2",
      nsd_syn: "#ffdd57",
    };

    const datasetLabelMap = {
      murty185: "Murty185",
      nsd_1000: "NSD1000",
      bold_5000: "BOLD5000v2",
      bonner_2021: "Bonner2021",
      bmd_2024: "BMD2024",
      kingbaker_2019: "King2019",
      wardle_2020: "Wardle2020",
      nsd_syn: "NSD synthetic",
    };

  // auto modified for sizing
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

  useEffect(() => {
    setSelectedModel(null);
    if (onModelClick) onModelClick(null);
  }, [murtyData, nsdData, roi, dataset]);

  useEffect(() => {
    if (!murtyData || !nsdData || dimensions.width === 0 || dimensions.height === 0) return;

    const container = d3.select(containerRef.current);
    container.select("svg").remove();
    container.select(".scatter-tooltip").remove();

    const { width, height } = dimensions;
    
    // margin calculation 
    const margin = { 
      top: height * 0.12, 
      right: width * 0.12, 
      bottom: 50, 
      left: 70 
    };

    const availableWidth = width; 
    const plotAreaWidth = availableWidth - margin.left - margin.right;
    const plotAreaHeight = height - margin.top - margin.bottom;
    const mainSize = Math.min(plotAreaWidth, plotAreaHeight);
    // const plotAreaWidth = width - margin.left - margin.right;
    // const plotAreaHeight = height - margin.top - margin.bottom;
    // const mainSize = Math.min(plotAreaWidth, plotAreaHeight);
    const totalContentWidth = mainSize + margin.left + margin.right;
    const centerXOffset = Math.max(0, (width - totalContentWidth) / 2);

    

    const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height);
      



    // =====  Scale =====
    let allVals = [];
    Object.keys(murtyData || {}).forEach(r => {
      Object.keys(murtyData[r] || {}).forEach(m => {
        if (m === "ceiling") return;
        ["murty_uni", "nsd_uni"].forEach(key => { /* for all values*/ });
        const mv = murtyData[r][m];
        const nv = nsdData[r][m];
        if(mv && nv) {
           Object.keys(mv).forEach(ds => {
             if (!["murty185", "nsd_1000", "ceiling"].includes(ds)) {
               if(mv[ds]) allVals.push(mv[ds][0]);
               if(nv[ds]) allVals.push(nv[ds][0]);
             }
           });
        }
      });
    });

    const minVal = (d3.min(allVals) || 0) - 0.05;
    const maxVal = (d3.max(allVals) || 1) + 0.05;

    // const xScale = d3.scaleLinear().domain([minVal, maxVal]).range([margin.left, margin.left + mainSize]);
    // const yScale = d3.scaleLinear().domain([minVal, maxVal]).range([margin.top + mainSize, margin.top]);
    const xScale = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([margin.left + centerXOffset, margin.left + centerXOffset + mainSize]);
    
    const yScale = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([margin.top + mainSize, margin.top]);

  
    svg.append("g")
      .attr("transform", `translate(0,${margin.top + mainSize})`)
      .call(d3.axisBottom(xScale).ticks(6));
    

    svg.append("g")
      .attr("transform", `translate(${margin.left + centerXOffset},0)`)
      .call(d3.axisLeft(yScale).ticks(6));

    // Y=X 
    svg.append("line")
      .attr("x1", xScale(minVal)).attr("y1", yScale(minVal))
      .attr("x2", xScale(maxVal)).attr("y2", yScale(maxVal))
      .attr("stroke", "#999").attr("stroke-dasharray", "4 2").attr("opacity", 0.6);

    // axis label
   svg.append("text")
      .attr("x", margin.left + centerXOffset + mainSize/2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text("Murty185 Performance (Pearson r)");
    
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + mainSize/2))
      .attr("y", centerXOffset + 25) // ✨ Y 位置由于旋转也要调整
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text("NSD1000 Performance (Pearson r)");

    const dots = svg.selectAll("circle.dot")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      //  bigger radius for selected dot
      .attr("r", d => d.model === selectedModel ? 7 : 5) 
      .attr("fill", d => color_map[d.dataset])
      // style for selected dot
      .attr("opacity", d => (d.model === selectedModel || d.model === hoveredData?.model) ? 1 : 0.5)
      .attr("stroke", d => d.model === selectedModel ? "#000" : "#fff") 
      .attr("stroke-width", d => d.model === selectedModel ? 2.5 : 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const newSelection = selectedModel === d.model ? null : d.model;
        setSelectedModel(newSelection);
        if (onModelClick) onModelClick(newSelection);
      })
      // tooltip design: setHoveredData
      .on("mouseover", (event, d) => {
        setHoveredData({ ...d, label: datasetLabelMap[d.dataset] });
        d3.select(event.currentTarget).raise();
      })
      .on("mouseout", () => {
        setHoveredData(null);
      });
    dots.filter(d => d.model === selectedModel).raise();

    // == old tooltip design
    // const tooltip = container
    //   .append("div")
    //   .attr("class", "scatter-tooltip")
    //   .style("position", "absolute")
    //   .style("visibility", "hidden")
    //   .style("background", "rgba(255,255,255,0.98)")
    //   .style("border", "1px solid #ccc")
    //   .style("box-shadow", "0 2px 10px rgba(0,0,0,0.1)")
    //   .style("padding", "10px")
    //   .style("pointer-events", "none")
    //   .style("z-index", "2000")
    //   .style("font-size", "13px")
    //   .style("border-radius", "4px");

    // dots.on("mouseover", (event, d) => {
    //   tooltip.style("visibility", "visible")
    //     .html(`
    //       <div style="font-weight:bold; color:#333; margin-bottom:5px;">${d.model}</div>
    //       <div style="color:#666;">Dataset: ${datasetLabelMap[d.dataset]}</div>
    //       <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
    //       <div>Murty: <span style="font-weight:500;">${d.x.toFixed(3)}</span></div>
    //       <div>NSD: <span style="font-weight:500;">${d.y.toFixed(3)}</span></div>
    //     `);
    // })
    // .on("mousemove", (event) => {

    //   const tooltipWidth = 180;
    //   let leftPos = event.pageX + 15;
    //   if (leftPos + tooltipWidth > window.innerWidth - 50) {
    //     leftPos = event.pageX - tooltipWidth - 15;
    //   }
    //   tooltip.style("top", `${event.pageY - 40}px`).style("left", `${leftPos}px`);
    // })
    // .on("mouseout", () => tooltip.style("visibility", "hidden"));

    // ===== KDE histograph=====
    const legendData = Array.from(new Set(points.map(d => d.dataset)));
    
    // histograph scale
    const histMaxHeight = margin.top - 50;
    const histMaxWidth = margin.right - 50;

    // KDE 
    function kernelDensityEstimator(xGrid, sample, bandwidth) {
      const kernel = v => Math.exp(-0.5 * v * v) / Math.sqrt(2 * Math.PI);
      return xGrid.map(x => [x, d3.mean(sample, v => kernel((x - v) / bandwidth)) / bandwidth]);
    }

    const dVec = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];
    const d_orth = [1 / Math.sqrt(2), -1 / Math.sqrt(2)];
    // KDE center
    const kdeCenter = [0 , 0];

    legendData.forEach(ds => {
      const dsPts = points.filter(p => p.dataset === ds);
      if (dsPts.length === 0) return;

      // --- Histograph ---
      // const xHist = d3.histogram().domain(xScale.domain()).thresholds(xScale.ticks(20))(dsPts.map(p => p.x));
      // const yHist = d3.histogram().domain(yScale.domain()).thresholds(yScale.ticks(20))(dsPts.map(p => p.y));

      // svg.append("g").selectAll(".h-rect")
      //   .data(xHist).enter().append("rect")
      //   .attr("x", d => xScale(d.x0)).attr("y", d => margin.top - 10 - (d.length * 5))
      //   .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
      //   .attr("height", d => d.length * 5).attr("fill", color_map[ds]).attr("opacity", 0.4);

      // svg.append("g").selectAll(".v-rect")
      //   .data(yHist).enter().append("rect")
      //   .attr("y", d => yScale(d.x1)).attr("x", margin.left + mainSize + 10)
      //   .attr("height", d => Math.max(0, yScale(d.x0) - yScale(d.x1) - 1))
      //   .attr("width", d => d.length * 5).attr("fill", color_map[ds]).attr("opacity", 0.4);
      
      const xHist = d3.histogram().domain(xScale.domain()).thresholds(xScale.ticks(20))(dsPts.map(p => p.x));
      const yHist = d3.histogram().domain(yScale.domain()).thresholds(yScale.ticks(20))(dsPts.map(p => p.y));

      // for histograph scaling
      const maxCount = d3.max([...xHist, ...yHist], d => d.length) || 1;
      const histScale = d3.scaleLinear().domain([0, maxCount]).range([0, margin.top - 40]);

      svg.append("g").selectAll(".h-rect")
          .data(xHist).enter().append("rect")
          .attr("x", d => xScale(d.x0))
          .attr("y", d => margin.top - 10 - histScale(d.length)) 
          .attr("width", d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
          .attr("height", d => histScale(d.length)) 
          .attr("fill", color_map[ds]).attr("opacity", 0.4);

      // 右侧直方图 (✨ 修改 x 坐标)
      svg.append("g").selectAll(".v-rect")
        .data(yHist).enter().append("rect")
        .attr("y", d => yScale(d.x1))
        .attr("x", margin.left + centerXOffset + mainSize + 10) 
        .attr("height", d => Math.max(0, yScale(d.x0) - yScale(d.x1) - 1))
        .attr("width", d => histScale(d.length)) 
        .attr("fill", color_map[ds]).attr("opacity", 0.4);

      // --- KDE curve ---
      const proj = dsPts.map(p => xScale(p.x) * dVec[0] + yScale(p.y) * dVec[1]);
      const uGrid = d3.range(d3.min(proj), d3.max(proj), (d3.max(proj)-d3.min(proj))/50);
      const kdeVals = kernelDensityEstimator(uGrid, proj, 20);
      const line = d3.line().curve(d3.curveBasis).x(d => d[0]).y(d => d[1]);
      const linePts = kdeVals.map(([u, dens]) => {
        const base = [u * dVec[0], u * dVec[1]];
        const offset = [dens * 1500 * d_orth[0], dens * 1500 * d_orth[1]];
        return [kdeCenter[0] + base[0] + offset[0]+ mainSize/2 + centerXOffset/2, kdeCenter[1] + base[1] + offset[1]-mainSize/2-centerXOffset/2]; // mainsize for offset
      });
      
      svg.append("path").datum(linePts).attr("d", line).attr("fill", "none").attr("stroke", color_map[ds]).attr("stroke-width", 2).attr("opacity", 0.8);
    });

    // ===== Overlay graph=====
    // ===== need to redraw?=====
    if (showOverlay) {
      svg.append("image")
        .attr("href", chartType === "uni" ? uniIcon : multiIcon)
        .attr("x", margin.left +  centerXOffset+ mainSize - 160)
        .attr("y", margin.top + mainSize - 130)
        .attr("width", 150)
        .attr("height", 120)
        .attr("opacity", 0.8)
        .style("cursor", "help");
    }

    // ===== (Legend) =====
    const legend = svg.append("g").attr("transform", `translate(${margin.left + centerXOffset+ 20}, ${margin.top + 20})`);
    legendData.forEach((ds, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
      lg.append("circle").attr("r", 6).attr("fill", color_map[ds]).attr("stroke", "#333");
      lg.append("text").attr("x", 15).attr("y", 5).style("font-size", "13px").text(datasetLabelMap[ds]);
    });

  }, [murtyData, nsdData, roi, datasetArray, onModelClick, dimensions, chartType, showOverlay,selectedModel, points]);

  // return (
  //   <div 
  //     ref={containerRef} 
  //     style={{ 
  //       width: "100%", 
  //       height: "100%", 
  //       position: "relative",
  //       background: "#fff",
  //       overflow: "hidden"
  //     }}
  //   ></div>
  // );
  // priorty: hover then clicked 
  const displayInfo = hoveredData || (selectedModel ? points.find(p => p.model === selectedModel) : null);
  const activeModelName = hoveredData?.model || selectedModel;
  
 
  const modelEntries = activeModelName 
    ? points.filter(p => p.model === activeModelName) 
    : [];

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fafafa", overflow: "hidden" }}>
      
      {/* left：graph*/}
      <div 
        ref={containerRef} 
        style={{ flex: 1, position: "relative", minWidth: 0 }}
      ></div>

 
      {/* right：model details */}
      <div style={{ 
        width: "250px", 
        borderLeft: "1px solid #eee", 
        padding: "20px", 
        backgroundColor: "#fafafa",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 10,
        overflowY: "auto", 
        boxShadow: "-2px 0 5px rgba(0,0,0,0.02)"
      }}>
        <h5 style={{ fontsize: "12px",margin: "10px 0 10px 0", color: "#333", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>
          Model Details
        </h5>
        
        {activeModelName ? (
          <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
            {/* 1. model's name */}
            <div style={{ fontWeight: "bold", color: "#1890ff", fontSize: "12px", marginBottom: "12px", wordBreak: "break-all" }}>
              {activeModelName}
            </div>

            {/* 2. show all Evaluation Dataset info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {modelEntries.map((entry) => (
                <div 
                  key={entry.dataset} 
                  style={{ 
                    padding: "10px", 
                    background: (hoveredData?.dataset === entry.dataset) ? "#e6f7ff" : "#fff", 
                    borderRadius: "6px", 
                    border: (hoveredData?.dataset === entry.dataset) ? "1.5px solid #1890ff" : "1px solid #eee",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: "all 0.2s"
                  }}
                >
                  {/* dataset name */}
                  <div style={{ fontWeight: "bold", fontSize: "10px", color: "#555", marginBottom: "6px", borderBottom: "1px solid #f0f0f0", paddingBottom: "2px" }}>
                    Evaluation: {datasetLabelMap[entry.dataset] || entry.dataset}
                  </div>
                  
                  {/* value*/}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#888" }}>Murty185:</span>
                    <span style={{ fontWeight: 600 }}>{entry.x.toFixed(3)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                    <span style={{ color: "#888" }}>NSD1000:</span>
                    <span style={{ fontWeight: 600 }}>{entry.y.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ color: "#999", fontSize: "11px", fontStyle: "italic", marginTop: "20px", textAlign: "center" }}>
            Hover or click a point to see details across all evaluation datasets
          </div>
        )}
      </div>
    </div>
  );
};

export default ScatterMurtyVsNsd;