import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { heatmapStyles, styleTooltip } from './heatmapstyles';

const Heatmap = ({ heatmapData, originalFilenames, sortedFilenames, width, height, fileMappings, order}) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [containerWidth, setContainerWidth] = useState(0); 

    // Update container width dynamically
    useEffect(() => {

      setTimeout(() => {
        document.querySelectorAll('.tooltip').forEach((el) => {
          el.style.opacity = "1";
          el.style.visibility = "visible";
        });
      }, 100);
  
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
  
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
  
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }, []);
  
    const fileMap = useMemo(() => {
      const m = new Map();
      (fileMappings || []).forEach((f) => {
        if (f.serverKey) m.set(f.serverKey, f);
      });
      return m;
    }, [fileMappings]);

    const getFileInfo = (serverKey) => {
      const m = fileMap.get(serverKey);
      if (!m) return { blobURL: null, label: null, groupKey: null };
      return {
        blobURL: m.blobURL,
        label: m.label,
        groupKey: m.groupKey,
      };
    };

    const getGroupForFilename = (filename) => {
      const m = fileMap.get(filename);
      return m?.groupKey || "Ungrouped";
    };

    const getDisplayLabel = (filename) => {
      const m = fileMap.get(filename);
      return m?.label || filename;
    };

  useEffect(() => {

    if (!heatmapData || heatmapData.length === 0) {
      console.warn(" No heatmap data available, skipping rendering.");
      return;
    }
    console.log("✅ Rendering Heatmap with Data:", heatmapData);

    const svg = d3.select(svgRef.current);

    const margin = heatmapStyles.margin;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const currentOrder = sortedFilenames?.length ? sortedFilenames : originalFilenames;

    // Compute group spans (used for labels when order === "group")
    const groupSpans = [];
    if (order === "group" && currentOrder.length > 0) {
      let si = 0;
      while (si < currentOrder.length) {
        const grp = getGroupForFilename(currentOrder[si]);
        let ei = si;
        while (ei + 1 < currentOrder.length && getGroupForFilename(currentOrder[ei + 1]) === grp) ei++;
        groupSpans.push({ group: grp, startFilename: currentOrder[si], endFilename: currentOrder[ei] });
        si = ei + 1;
      }
    }

    const n = currentOrder.length;
    const extraRight = order === "group" && groupSpans.length > 0 ? 70 : 0;
    const cellSize = Math.min((innerWidth - extraRight) / n, innerHeight / n);
    const actualInner = cellSize * n;

    const xScale = d3.scaleBand().domain(currentOrder).range([0, actualInner]).padding(0);
    const yScale = d3.scaleBand().domain(currentOrder).range([0, actualInner]).padding(0);

    // Set up color scale
    const colorScale = d3.scaleSequential(d3.interpolatePlasma)
      .domain([d3.min(heatmapData, d => d.value), d3.max(heatmapData, d => d.value)]);

    // Adjust SVG size to fit the square grid exactly
    svg.attr("width", actualInner + margin.left + margin.right + extraRight)
       .attr("height", actualInner + margin.top + margin.bottom);

    // Clear previous SVG elements
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    let tooltip = d3.select(containerRef.current).select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select(containerRef.current)
        .append("div")
        .attr("class", "tooltip");
    }
    styleTooltip(tooltip);

    // Draw heatmap rectangles
    const rects = g.selectAll("rect")
      .data(heatmapData, d => `${d.x}-${d.y}`) // Key function for updates
      .join(
        enter =>
          enter.append("rect")
            .attr("x", d => xScale(d.x))
            .attr("y", d => yScale(d.y))
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", d => colorScale(d.value))
            .on("mouseover", (event, d) => {
              const fx = getFileInfo(d.x);
              const fy = getFileInfo(d.y);

              const blobURL_imageX = fx.blobURL;
              const blobURL_imageY = fy.blobURL;

              const labelX = fx.label ?? d.x;
              const labelY = fy.label ?? d.y;

              const cellColor = colorScale(d.value);

              let imageHtml, labelHtml;
              if (d.x === d.y) {
  imageHtml = blobURL_imageX
    ? `<img src="${blobURL_imageX}" ...>`
    : "";
  labelHtml = `<p><strong>x & y:</strong> ${labelX}</p>`;
              } else {
                imageHtml = `
                  ${blobURL_imageX ? `<img src="${blobURL_imageX}" ...>` : ""}
                  ${blobURL_imageY ? `<img src="${blobURL_imageY}" ...>` : ""}
                `;
                labelHtml = `
                  <div style="display: flex; justify-content: center; gap: 10px;">
                    <p><strong>x:</strong> ${labelX}</p>
                    <p><strong>y:</strong> ${labelY}</p>
                  </div>
                `;
              }

            tooltip.html(`
                <div style="
                  padding: 12px;
                  background: transparent;
                  border-radius: 12px;
                  min-width: 280px;
                  font-family: 'Lato', sans-serif;
                ">

                  <div style="
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    margin-bottom: 10px;
                  ">
                    ${blobURL_imageX ? `
                      <img src="${blobURL_imageX}"
                        style="
                          width: 110px;
                          height: 110px;
                          object-fit: cover;
                          border-radius: 10px;
                        ">
                    ` : ""}

                    ${blobURL_imageY && d.x !== d.y ? `
                      <img src="${blobURL_imageY}"
                        style="
                          width: 110px;
                          height: 110px;
                          object-fit: cover;
                          border-radius: 10px;
                        ">
                    ` : ""}
                  </div>

                  <div style="text-align:center; font-size: 13px; color: #444;">
                    ${d.x === d.y
                      ? `<div>${labelX}</div>`
                      : `
                        <div><strong>x:</strong> ${labelX}</div>
                        <div><strong>y:</strong> ${labelY}</div>
                      `
                    }
                  </div>

                  <div style="
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #333;
                  ">
                    Euclidean: ${d.value.toFixed(4)}
                    <span style="
                      width: 14px;
                      height: 14px;
                      border-radius: 50%;
                      background: ${cellColor};
                      border: 1px solid rgba(0,0,0,0.2);
                    "></span>
                  </div>

                </div>
              `)
              .style("display", "block")
              .style("opacity", 1)
              .style("visibility", "visible");
            })
            .on("mousemove", event => {
              const containerRect = containerRef.current.getBoundingClientRect(); 
              tooltip
                .style("left", `${event.clientX - containerRect.left + 10}px`)
                .style("top", `${event.clientY - containerRect.top - 40}px`);
            })
            .on("mouseout", () => {
              tooltip
                .style("display", "none")
                .style("opacity", 0)
                .style("visibility", "hidden");
            }),
      );
    
    //legend
    // Add legend
    const legend = g.append("g")
      .attr("transform", `translate(-50, 0)`); // Move legend to the left of the heatmap
    
    const legendColorScale = d3.scaleSequential(d3.interpolatePlasma)
      .domain([d3.min(heatmapData, d => d.value), d3.max(heatmapData, d => d.value)]);
    
    const legendHeight = actualInner;
    const legendWidth = 20;
    
    const legendScale = d3.scaleLinear()
      .domain(legendColorScale.domain())
      .range([legendHeight, 0]);
    
    const legendAxis = d3.axisLeft(legendScale).ticks(6);
    
    
    legend.append("g")
      .attr("transform", `translate(${legendWidth - 20}, 0)`)
      .call(legendAxis);
    

    legend.selectAll("text") // Select all tick labels
      .style("font-size", "14px")
    
    legend.selectAll("rect")
      .data(d3.range(legendHeight))
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", d => d)
      .attr("width", legendWidth)
      .attr("height", 1)
      .attr("fill", d => legendColorScale(legendScale.invert(d)));
    
    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", legendHeight + 20)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text("euclidean");

    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", legendHeight + 38)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .text("distance");

    // Group bracket labels (top + right) when order === "group"
    if (order === "group" && groupSpans.length > 0) {
      const TICK = 6;

      // ── Top labels (for columns) ──
      const topG = g.append("g").attr("class", "group-labels-top");
      const TOP_Y = -10;

      groupSpans.forEach(({ group, startFilename, endFilename }) => {
        const x1 = xScale(startFilename);
        const x2 = xScale(endFilename) + cellSize;
        const cx = (x1 + x2) / 2;

        topG.append("line")
          .attr("x1", x1).attr("x2", x2)
          .attr("y1", TOP_Y).attr("y2", TOP_Y)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        topG.append("line")
          .attr("x1", x1).attr("x2", x1)
          .attr("y1", TOP_Y).attr("y2", TOP_Y + TICK)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        topG.append("line")
          .attr("x1", x2).attr("x2", x2)
          .attr("y1", TOP_Y).attr("y2", TOP_Y + TICK)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        topG.append("text")
          .attr("x", cx).attr("y", TOP_Y - 3)
          .attr("text-anchor", "middle")
          .style("font-size", "11px").style("fill", "#666")
          .text(group);
      });

      // ── Right labels (for rows) ──
      const rightG = g.append("g").attr("class", "group-labels-right");
      const RIGHT_X = actualInner + 10;

      groupSpans.forEach(({ group, startFilename, endFilename }) => {
        const y1 = yScale(startFilename);
        const y2 = yScale(endFilename) + cellSize;
        const cy = (y1 + y2) / 2;

        rightG.append("line")
          .attr("x1", RIGHT_X).attr("x2", RIGHT_X)
          .attr("y1", y1).attr("y2", y2)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        rightG.append("line")
          .attr("x1", RIGHT_X - TICK).attr("x2", RIGHT_X)
          .attr("y1", y1).attr("y2", y1)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        rightG.append("line")
          .attr("x1", RIGHT_X - TICK).attr("x2", RIGHT_X)
          .attr("y1", y2).attr("y2", y2)
          .attr("stroke", "#888").attr("stroke-width", 1.2);
        rightG.append("text")
          .attr("x", RIGHT_X + 4).attr("y", cy)
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "middle")
          .style("font-size", "11px").style("fill", "#666")
          .text(group);
      });
    }

    return () => {
        d3.select(".tooltip").remove(); // Cleanup tooltip on component unmount
    };

  }, [heatmapData, originalFilenames, sortedFilenames, width, height, order, fileMappings]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width, height, backgroundColor: 'transparent' }}>
      {/* <div className="controls" style={{ position: 'absolute', top: 10, left: 10 }}>
        <label htmlFor="order">Order by: </label>
        <select id="order" value={order} onChange={e => setOrder(e.target.value)}>
          <option value="name">Name</option>
          <option value="group">Group</option>
        </select>
      </div> */}
      <svg ref={svgRef} style={{ fontFamily: "'Lato', sans-serif" }}></svg>
    </div>
  );
};

export default Heatmap;
