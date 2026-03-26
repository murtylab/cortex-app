// // components/HeatmapDetail.jsx
import React, { useEffect, useRef } from "react"; 
import * as d3 from "d3";

const HeatmapDetail = ({ data, roi, dataset, rank, selectedModel, onModelClick, onScrollUpdate,showYAxis = true,isMultiRegion = false }) => {
  const headerRef = useRef();
  const bodyRef = useRef();
  const legendRef = useRef();

  // sorted model for relocate the selected model
  const sortedModelsRef = useRef([]);

  const datasetLabelMap = {
    murty185: "Murty185",
    nsd_1000: "NSD1000",
    bold_5000: "BOLD5000v2",
    bonner_2021: "Bonner2021",
    bmd_2024: "BMD2024",
    kingbaker_2019: "King2019",
    wardle_2020: "Wardle2020",
    nsd_syn: "NSD synthetic",
    global_score: "Global Score",
  };

  const ROW_HEIGHT_TOTAL = 27;

  const handleScroll = (e) => {
    const { scrollLeft, scrollTop, clientHeight } = e.target;
    if (headerRef.current) {
      // header and body roll together
      headerRef.current.scrollLeft = e.target.scrollLeft;
    }

    if (onScrollUpdate) {
      const startIndex = Math.floor(scrollTop / ROW_HEIGHT_TOTAL);
      // 向上取整确保覆盖底部边缘
      const visibleCount = Math.ceil(clientHeight / ROW_HEIGHT_TOTAL);
      const endIndex = startIndex + visibleCount -1;
      
      onScrollUpdate({ start: startIndex, end: endIndex });
    }
  };

  // selectedModel: automatically roll to selected model row
  useEffect(() => {
    if (!selectedModel || !bodyRef.current || sortedModelsRef.current.length === 0) return;

    // find the index of the selected model
    const index = sortedModelsRef.current.indexOf(selectedModel);

    if (index !== -1) {
      const rowHeight = 25; // keep it the same number as below
      const rowGap = 2;
      
      // calculate the y axis of the target selected row
      const targetY = index * (rowHeight + rowGap);
      
      // container's height
      const containerHeight = bodyRef.current.clientHeight;

      // calculate the target Y to make it center
      const scrollTo = targetY - (containerHeight / 2) + (rowHeight / 2);

      bodyRef.current.scrollTo({
        top: scrollTo,
        behavior: "smooth",
      });
    }
  }, [selectedModel]);

  // 3. drawing logic
  useEffect(() => {
    // if there is no data then return
    if (!data || Object.keys(data).length === 0) return;

    d3.select(headerRef.current).selectAll("*").remove();
    d3.select(bodyRef.current).selectAll("*").remove();
    d3.select(legendRef.current).selectAll("*").remove();
    const LEFT_MARGIN = showYAxis ? 200 : 10;
    const headerMargin = { top: 80, right: 40, bottom: 10, left: LEFT_MARGIN };
    const bodyMargin = { top: 10, right: 40, bottom: 0, left: LEFT_MARGIN };
    const rowHeight = 25;
    const rowGap = 2;
    const columnWidth = 75;
    const columnGap = 5;

    // const colorScale = d3.scaleLinear().domain([0, 1]).range(["#D3D3D3", "#9CC9FF"]);
    const colorScale = d3
      .scaleSequential(d3.interpolateGnBu)
      .domain([1, 0]); 

    let xLabels = [];
    let models = [];
    let cellData = [];
    let ceilingData = [];

    // --- data processing ---
    // if (roi && data[roi]) {
    //   models = Object.keys(data[roi]).filter((m) => m !== "ceiling");
    //   xLabels = Array.from(new Set(models.flatMap((m) => Object.keys(data[roi][m] || {}))));

    //   models.forEach((model) => {
    //     let rawVals = [];
    //     xLabels.forEach((ds) => {
    //       if (["murty185", "nsd_1000"].includes(ds)) return;
    //       const vals = data[roi][model]?.[ds];
    //       if (vals) {
    //         const raw = vals[0];
    //         const norm = vals[1];
    //         rawVals.push(raw);
    //         cellData.push({ model, x: ds, raw, norm });
    //       }
    //     });
    //     if (rawVals.length > 0) {
    //       cellData.push({
    //         model,
    //         x: "global_score",
    //         raw: d3.mean(rawVals),
    //         norm: null,
    //       });
    //     }
    //   }) 

    //   ceilingData = xLabels
    //     .filter((ds) => !["murty185", "nsd_1000"].includes(ds))
    //     .map((ds) => {
    //       const vals = data[roi]?.ceiling?.[ds];
    //       return vals ? { x: ds, raw: vals[0], norm: vals[1] } : {};
    //     });

    //   const ceilingVals = ceilingData.map((d) => d.raw).filter((v) => v != null);
    //   if (ceilingVals.length > 0) {
    //     ceilingData.push({
    //       x: "global_score",
    //       raw: d3.mean(ceilingVals),
    //       norm: null,
    //     });
    //   }

    //   xLabels = ["global_score", ...xLabels.filter((ds) => !["murty185", "nsd_1000"].includes(ds))];
    // } else if (dataset) {
    //   const rois = Object.keys(data).filter((roiName) => roiName.toLowerCase() !== "overall");
    //   models = [];
    //   let validRois = [];

    //   rois.forEach((roiName) => {
    //     const modelNames = Object.keys(data[roiName] || {}).filter((m) => m !== "ceiling");
    //     models = Array.from(new Set([...models, ...modelNames]));

    //     let roiHasData = false;
    //     modelNames.forEach((model) => {
    //       const vals = data[roiName]?.[model]?.[dataset];
    //       if (vals) {
    //         roiHasData = true;
    //         cellData.push({ model, x: roiName, raw: vals[0], norm: vals[1] });
    //       }
    //     });

    //     const ceilingVals = data[roiName]?.ceiling?.[dataset];
    //     if (ceilingVals) {
    //       roiHasData = true;
    //       ceilingData.push({
    //         x: roiName,
    //         raw: ceilingVals[0],
    //         norm: ceilingVals[1],
    //       });
    //     }
    //     if (roiHasData) validRois.push(roiName);
    //   });

    //   models.forEach((model) => {
    //     const rawVals = cellData.filter((d) => d.model === model && d.raw != null).map((d) => d.raw);
    //     if (rawVals.length > 0) {
    //       cellData.push({
    //         model,
    //         x: "global_score",
    //         raw: d3.mean(rawVals),
    //         norm: null,
    //       });
    //     }
    //   });

    //   const ceilingVals = ceilingData.map((d) => d.raw).filter((v) => v != null);
    //   if (ceilingVals.length > 0) {
    //     ceilingData.push({
    //       x: "global_score",
    //       raw: d3.mean(ceilingVals),
    //       norm: null,
    //     });
    //   }
    //   xLabels = ["global_score", ...validRois];
    // } else {
    //   return;
    // }
    if (roi && data[roi]) {
      // Case 1: 固定 ROI -> X轴是 Dataset
      models = Object.keys(data[roi]).filter((m) => m !== "ceiling");
      const allPossibleDatasets = Array.from(new Set(models.flatMap((m) => Object.keys(data[roi][m] || {}))));

      models.forEach((model) => {
        let rawVals = [];
        allPossibleDatasets.forEach((ds) => {
          if (["murty185", "nsd_1000"].includes(ds)) return;
          const vals = data[roi][model]?.[ds];
          if (vals) {
            rawVals.push(vals[0]);
            cellData.push({ model, x: ds, raw: vals[0], norm: vals[1] });
          }
        });
        if (rawVals.length > 0) {
          cellData.push({ model, x: "global_score", raw: d3.mean(rawVals), norm: null });
        }
      });

      ceilingData = allPossibleDatasets
        .filter(ds => !["murty185", "nsd_1000"].includes(ds))
        .map(ds => {
          const vals = data[roi]?.ceiling?.[ds];
          return vals ? { x: ds, raw: vals[0], norm: vals[1] } : null;
        }).filter(d => d !== null);

      const cVals = ceilingData.map(d => d.raw).filter(v => v != null);
      if (cVals.length > 0) ceilingData.push({ x: "global_score", raw: d3.mean(cVals), norm: null });
      
      xLabels = ["global_score", ...allPossibleDatasets.filter(ds => !["murty185", "nsd_1000"].includes(ds))];

    } else if (dataset) {
      // Case 2: 固定 Dataset -> X轴是 ROI 名
      const rois = Object.keys(data).filter((n) => n.toLowerCase() !== "overall");
      let validRois = [];
      
      rois.forEach((roiName) => {
        const modelNames = Object.keys(data[roiName] || {}).filter((m) => m !== "ceiling");
        models = Array.from(new Set([...models, ...modelNames]));

        let hasEntry = false;
        modelNames.forEach((model) => {
          const vals = data[roiName]?.[model]?.[dataset];
          if (vals) {
            hasEntry = true;
            cellData.push({ model, x: roiName, raw: vals[0], norm: vals[1] });
          }
        });

        const cVals = data[roiName]?.ceiling?.[dataset];
        if (cVals) {
          hasEntry = true;
          ceilingData.push({ x: roiName, raw: cVals[0], norm: cVals[1] });
        }
        if (hasEntry) validRois.push(roiName);
      });

      models.forEach((model) => {
        const rawVals = cellData.filter(d => d.model === model && d.raw != null).map(d => d.raw);
        if (rawVals.length > 0) {
          cellData.push({ model, x: "global_score", raw: d3.mean(rawVals), norm: null });
        }
      });

      const cVals = ceilingData.map(d => d.raw).filter(v => v != null);
      if (cVals.length > 0) ceilingData.push({ x: "global_score", raw: d3.mean(cVals), norm: null });
      
      xLabels = ["global_score", ...validRois];
    } else {
      return; // 无 ROI 也无 Dataset 则不渲染
    }

    if (!models.length) return;

    // --- Ranking Logic ---
    // if (rank && rank !== "") {
    //   const modelGlobal = {};
    //   cellData.forEach((d) => {
    //     if (d.x === "global_score") {
    //       modelGlobal[d.model] = d.raw ?? -Infinity;
    //     }
    //   });
    //   models.sort((a, b) => (modelGlobal[b] || -Infinity) - (modelGlobal[a] || -Infinity));
    // }
    if (rank && rank !== "") {
      const modelGlobal = {};
      cellData.forEach((d) => { if (d.x === "global_score") modelGlobal[d.model] = d.raw ?? -Infinity; });
      models.sort((a, b) => (modelGlobal[b] || -Infinity) - (modelGlobal[a] || -Infinity));
    } else {
      models.sort(); // 默认按字母排序，保证并排显示时模型行号一致
    }

    // 4. sorted rank store in Ref
    sortedModelsRef.current = models;

    // ======= Dimensions =======
    const chartWidth = xLabels.length * (columnWidth + columnGap);
    const headerHeight = headerMargin.top + rowHeight;
    const bodyHeight = models.length * (rowHeight + rowGap) + 15;
    const width = chartWidth + headerMargin.left + headerMargin.right;

    // ======= Header =======
    const svgHeader = d3.select(headerRef.current).append("svg").attr("width", width).attr("height", headerHeight);

    svgHeader
      .append("g")
      .attr("transform", `translate(${columnWidth / 2},${headerMargin.top - 40})`)
      .call(d3.axisTop(d3.scalePoint().domain(xLabels).range([headerMargin.left + columnWidth / 2, headerMargin.left + xLabels.length * (columnWidth + columnGap) - columnGap - columnWidth / 2])))
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll("line").remove();
        g.selectAll("text").style("font-size", "12px").style("fill", "black");
      })
      .selectAll("text")
      .text((d) => datasetLabelMap[d] || d)
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    // Ceiling Row
    svgHeader.selectAll("rect.ceiling")
      .data(ceilingData)
      .enter().append("rect")
      .attr("x", (d) => headerMargin.left + xLabels.indexOf(d.x) * (columnWidth + columnGap))
      .attr("y", headerMargin.top)
      .attr("width", columnWidth)
      .attr("height", rowHeight)
      .attr("fill", (d) => {
        if (d.x === "global_score") return "rgba(158, 117, 214, 0.5)";
        if (d.norm == null) return "#f0f0f0";
        return colorScale(d.norm > 1 ? 1 : d.norm < 0 ? 0 : d.norm);
      });

    // Ceiling Labels
    svgHeader.selectAll("text.ceiling-label")
      .data(ceilingData.filter((d) => d.raw != null))
      .enter().append("text")
      .attr("x", (d) => headerMargin.left + xLabels.indexOf(d.x) * (columnWidth + columnGap) + columnWidth / 2)
      .attr("y", headerMargin.top + rowHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("fill", "black")
      .style("font-size", "12px")
      .text((d) => d.raw.toFixed(2));

    // Ceiling Y Axis
    // svgHeader.append("g")
    //   .attr("transform", `translate(${headerMargin.left - 10},0)`)
    //   .call(d3.axisLeft(d3.scalePoint().domain(["ceiling"]).range([headerMargin.top + rowHeight / 2, headerMargin.top + rowHeight / 2])))
    //   .call((g) => {
    //     g.select(".domain").remove();
    //     g.selectAll("text").style("font-size", "12px").style("fill", "black");
    //   });

    if (showYAxis) {
      svgHeader.append("g")
        .attr("transform", `translate(${headerMargin.left - 10},0)`)
        .call(d3.axisLeft(d3.scalePoint().domain(["ceiling"]).range([headerMargin.top + rowHeight / 2, headerMargin.top + rowHeight / 2])))
        .call((g) => { g.select(".domain").remove(); g.selectAll("text").style("font-size", "12px").style("font-weight", "bold"); });
    }
    // ======= Body =======
    const svgBody = d3.select(bodyRef.current).append("svg").attr("width", width).attr("height", bodyHeight);

    // highlight logic
    if (selectedModel) {
        const modelIndex = models.indexOf(selectedModel);
        if (modelIndex !== -1) {
            // 计算高亮行的 Y 坐标
            const highlightY = bodyMargin.top + modelIndex * (rowHeight + rowGap);
            // 计算高亮行的总宽度（从 Y轴开始到最后一个单元格结束）
            const highlightWidth = xLabels.length * (columnWidth + columnGap) + bodyMargin.left; // 稍微调整宽度计算方式
            
            svgBody.append("rect")
                .attr("class", "highlight-border")
                .attr("x", 0) // 从最左侧开始，包含 Y 轴标签区域
                .attr("y", highlightY - rowGap / 2) // 稍微向上一点，包住行间距
                .attr("width", width) // 使用整个 SVG 的宽度
                .attr("height", rowHeight + rowGap) // 高度包含一个行间距
                .attr("fill", "none") // 内部透明
                .attr("stroke", "#FF4500") // ✨ 边框颜色：橙红色，非常显眼
                .attr("stroke-width", 3) // ✨ 边框宽度：加粗
                .style("pointer-events", "none"); // 让鼠标事件穿透，不影响下方单元格的点击
        }
    }

    // Cells
    svgBody.selectAll("rect.cell")
      .data(cellData)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", (d) => bodyMargin.left + xLabels.indexOf(d.x) * (columnWidth + columnGap))
      .attr("y", (d) => bodyMargin.top + models.indexOf(d.model) * (rowHeight + rowGap))
      .attr("width", columnWidth)
      .attr("height", rowHeight)
      .attr("fill", (d) => {
        if (d.x === "global_score") return "rgba(158, 117, 214, 0.5)";
        if (d.norm == null) return "#f0f0f0";
        return colorScale(d.norm > 1 ? 1 : d.norm < 0 ? 0 : d.norm);
      })
      .style("cursor", "pointer")
      // 5. click logic
      .on("click", (event, d) => {
        if (onModelClick) onModelClick(d.model === selectedModel ? null : d.model);
      });

    // Cell Labels
    svgBody.selectAll("text.cell-label")
      .data(cellData.filter((d) => d.raw != null))
      .enter().append("text")
      .attr("x", (d) => bodyMargin.left + xLabels.indexOf(d.x) * (columnWidth + columnGap) + columnWidth / 2)
      .attr("y", (d) => bodyMargin.top + models.indexOf(d.model) * (rowHeight + rowGap) + rowHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("fill", "black")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .text((d) => d.raw.toFixed(2));

    // Y Axis (Models)
    // svgBody.append("g")
    //   .attr("transform", `translate(${bodyMargin.left - 10},0)`)
    //   .call(
    //     d3.axisLeft(
    //       d3.scalePoint().domain(models).range([
    //         bodyMargin.top + rowHeight / 2,
    //         bodyMargin.top + models.length * (rowHeight + rowGap) - rowGap - rowHeight / 2,
    //       ])
    //     )
    //   )
    //   .call((g) => {
    //     g.select(".domain").remove();
    //     g.selectAll("text")
    //       .style("font-size", "12px")
    //       // .style("fill", "black")
    //       .style("fill", (d) => (d === selectedModel ? "#FF4500" : "black"))
    //       // 6. hightlight logic
    //       .style("font-weight", (d) => (d === selectedModel ? "bold" : "normal"))
    //       .style("cursor", "pointer")
    //       .on("click", (event, d) => {
    //         if (onModelClick) onModelClick(d === selectedModel ? null : d);
    //       });
    //   });
    // ✨ 仅当显示 Y 轴时绘制模型名
    if (showYAxis) {
      svgBody.append("g")
        .attr("transform", `translate(${bodyMargin.left - 10},0)`)
        .call(d3.axisLeft(d3.scalePoint().domain(models).range([bodyMargin.top + rowHeight / 2, bodyMargin.top + models.length * (rowHeight + rowGap) - rowGap - rowHeight / 2])))
        .call((g) => {
          g.select(".domain").remove();
          g.selectAll("text")
            .style("font-size", "11px")
            .style("fill", (d) => (d === selectedModel ? "#FF4500" : "black"))
            .style("font-weight", (d) => (d === selectedModel ? "bold" : "normal"))
            .style("cursor", "pointer")
            .on("click", (_, d) => onModelClick && onModelClick(d === selectedModel ? null : d));
        });
    }

    // ======= Legend =======
    // const legendHeight = 250;
    // const legendWidth = 12;
    // const svgLegend = d3.select(legendRef.current).append("svg").attr("width", 80).attr("height", legendHeight + 40);

    // const defs = svgLegend.append("defs");
    // const gradient = defs.append("linearGradient").attr("id", "legend-gradient-vertical").attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");
    // gradient.append("stop").attr("offset", "0%").attr("stop-color", "#D3D3D3");
    // gradient.append("stop").attr("offset", "100%").attr("stop-color", "#9CC9FF");

    // svgLegend.append("rect").attr("x", 30).attr("y", 20).attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#legend-gradient-vertical)");
    // const legendScale = d3.scaleLinear().domain([0, 1]).range([legendHeight + 20, 20]);
    // svgLegend.append("g").attr("transform", `translate(42,0)`).call(d3.axisRight(legendScale).ticks(5));
    if (showYAxis && !isMultiRegion) {
        const legendHeight = 200;
        const svgLegend = d3.select(legendRef.current).append("svg").attr("width", 60).attr("height", legendHeight + 40);
        const defs = svgLegend.append("defs");
        const gradient = defs.append("linearGradient").attr("id", "grad").attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");
        // gradient.append("stop").attr("offset", "0%").attr("stop-color", "#D3D3D3");
        // gradient.append("stop").attr("offset", "100%").attr("stop-color", "#9CC9FF");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateGnBu(1));
        gradient.append("stop").attr("offset", "50%").attr("stop-color", d3.interpolateGnBu(0.5));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateGnBu(0));
        svgLegend.append("rect").attr("x", 10).attr("y", 20).attr("width", 10).attr("height", legendHeight).style("fill", "url(#grad)");
        const legScale = d3.scaleLinear().domain([0, 1]).range([legendHeight + 20, 20]);
        svgLegend.append("g").attr("transform", "translate(20,0)").call(d3.axisRight(legScale).ticks(5));
    }

    
   



  }, [data, roi, dataset, rank, onModelClick, selectedModel]); // 

  // 8. layout
  return (
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* left: Header + Body */}
      <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", height: "100%", overflow: "hidden" }}>
        
        {/* fixed head */}
        <div ref={headerRef} 
             style={{ 
              flex: "0 0 auto", 
              lineHeight: "0",
              overflowX: "hidden",
              width: "100%" 
              }}>

        </div>
        
        {/* rollable body */}
        <div 
          ref={bodyRef} 
          onScroll={handleScroll}
          style={{ 
            flex: "1 1 auto",  // auto fill
            overflowY: "auto", // flowY
            overflowX: "auto", // flowX
            marginTop: "0px",
            minHeight: 0,      // 
            scrollBehavior: "smooth" 
          }}
        ></div>
      </div>
      
      {/* 右侧 Legend */}
      <div ref={legendRef} style={{ flex: "0 0 auto", marginLeft: "0px", marginTop: "100px", width: "80px" }}></div>
    </div>
  );
};

export default HeatmapDetail;