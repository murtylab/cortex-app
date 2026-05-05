import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { interpolateRdBu } from "d3-scale-chromatic";
import { barchartStyles, createXScale, createYScale, styleTooltip } from './barchartstyles';

const BarChart = ({ barChartData, height, fileMappings}) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [containerWidth, setContainerWidth] = useState(0);
  const [order, setOrder] = useState("filename");
  const fileMap = useMemo(() => {
    const m = new Map();
    (fileMappings || []).forEach((f) => {
      if (f.serverKey) m.set(f.serverKey, f);
    });
    return m;
  }, [fileMappings]);

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

  const getSortedData = () => {
    if (!barChartData) return [];
    
    if (order === "filename") {
      return [...barChartData].sort((a, b) => a.filename.localeCompare(b.filename));
    } else if (order === "ranking") {
      return [...barChartData].sort((a, b) => b.mean - a.mean);
    } else if (order === "folder") {
    // Sort by folder (A→Z), then by filename within the same folder
      return [...barChartData].sort((a, b) => {
        const fa = getFolderForFilename(a.filename);
        const fb = getFolderForFilename(b.filename);
        if (fa === fb) return a.filename.localeCompare(b.filename);
        return fa.localeCompare(fb);
      });
    }
    return barChartData;
  };

  const getFileInfo = (serverKey) => {
    const mapping = fileMap.get(serverKey);
    if (!mapping) return { blobURL: null, group: null, label: null };

    return {
      blobURL: mapping.blobURL,
      group: mapping.groupKey || null,   
      label: mapping.label || null,
    };
  };
  const getFolderForFilename = (filename) => {
    const mapping = fileMappings?.find(m => m.file.name === filename);
    if (!mapping) return "";
    const relPath = mapping.file.webkitRelativePath || "";
    return relPath && relPath.includes("/")
      ? relPath.split("/").slice(0, -1).join("/")   // everything except filename
      : "";
  };

  useEffect(() => {
    const sortedData = getSortedData();

    if (!sortedData || sortedData.length === 0) {
      console.warn("No barchart data available, skipping rendering.");
      return;
    }
    console.log("✅ Rendering Barchart with Data:", sortedData);

    // Clear existing content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = barchartStyles.margin;
    const width = containerWidth;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const MAX_BAR_WIDTH = 25; // Maximum width for each bar

    // Calculate total width and center bars if few data points
    const totalWidth = Math.min(innerWidth, sortedData.length * (MAX_BAR_WIDTH + 20));
    const xScale = d3.scaleBand()
      .domain(sortedData.map(d => d.filename))
      .range([(innerWidth - totalWidth) / 2, (innerWidth + totalWidth) / 2])
      .padding(0.1)
      .paddingOuter(0.2);

    const adjustedBandwidth = Math.min(xScale.bandwidth(), MAX_BAR_WIDTH);
    const barCenterX = d => 
      xScale(d.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2 + adjustedBandwidth / 2;
    

    const maxAbsVariation = d3.max(
      sortedData,
      d => Math.max(Math.abs(d.mean - d.sem), Math.abs(d.mean + d.sem))
    ) ?? 0;
    const yExtent = maxAbsVariation + 0.05;
    const yMin = -yExtent;
    const yMax = yExtent;

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    const colorScale = d3.scaleDiverging()
      .domain([yMin, 0, yMax])
      .interpolator(t => d3.interpolateRdBu(1 - t));

    // Append group to SVG
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    let tooltip = d3.select(containerRef.current).select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select(containerRef.current)
        .append("div")
        .attr("class", "tooltip");
    }
    styleTooltip(tooltip);

    //Draw bars

    const shiftX = x => x + 20;

    g.selectAll(".bar")
      .data(sortedData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => shiftX(xScale(d.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2))
      .attr("y", d => d.mean >= 0 ? yScale(d.mean) : yScale(0))
      .attr("width", adjustedBandwidth)
      .attr("height", d => Math.abs(yScale(d.mean) - yScale(0)))
      .attr("fill", d => colorScale(d.mean))
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr("fill", d3.color(colorScale(d.mean)).darker(0.5));

        const { blobURL, group, label } = getFileInfo(d.filename);

        tooltip
          .html(
            `<div>
              <p><strong>Filename:</strong> ${label ?? d.filename}</p>
              <p><strong>Group:</strong> ${group ?? "(none)"}</p>
              <p><strong>Mean:</strong> ${d.mean.toFixed(4)}</p>
              <p><strong>SEM:</strong> ${d.sem.toFixed(4)}</p>
              ${blobURL ? `
                <img src="${blobURL}" alt="Thumbnail"
                    style="width: 140px; height: 140px; object-fit: cover; margin-bottom: 5px; border: 1px solid #ccc;">
              ` : ""}
            </div>`
          )
          .style("display", "block")
          .style("opacity", 1);
      })
      .on("mousemove", event => {
        const containerRect = containerRef.current.getBoundingClientRect(); 
        tooltip
          .style("left", `${event.clientX - containerRect.left + 10}px`)
          .style("top", `${event.clientY - containerRect.top - 40}px`);
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget).attr("fill", colorScale(d.mean));
        tooltip.style("display", "none");
      });


    g.append("g")
      .attr("transform", "translate(20, 0)")  
      .call(d3.axisLeft(yScale));

    // Keep an explicit zero baseline in the middle of the chart.
    g.append("line")
      .attr("x1", 20)
      .attr("x2", innerWidth + 20)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,2");


    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Images");
    
    g.append("text")
      .attr("x", -margin.left - 50)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .style("font-size", "20px")
      .text("Mean Predicted Response");

   // Draw error bar (vertical line)
    g.selectAll(".error-bar")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("class", "error-bar")
      .attr("x1", d => shiftX(barCenterX(d)))
      .attr("x2", d => shiftX(barCenterX(d)))
      .attr("y1", d => yScale(d.mean - d.sem))
      .attr("y2", d => yScale(d.mean + d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 20);

    // Top cap
    g.selectAll(".cap-top")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("x1", d => shiftX(barCenterX(d) - adjustedBandwidth/4))
      .attr("x2", d => shiftX(barCenterX(d) + adjustedBandwidth/4))
      .attr("y1", d => yScale(d.mean + d.sem))
      .attr("y2", d => yScale(d.mean + d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 20);

    // Bottom cap
    g.selectAll(".cap-bottom")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("x1", d => shiftX(barCenterX(d) - adjustedBandwidth/4))
      .attr("x2", d => shiftX(barCenterX(d) +  adjustedBandwidth/4))
      .attr("y1", d => yScale(d.mean - d.sem))
      .attr("y2", d => yScale(d.mean - d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 20);

 


    

    return () => {
      d3.select(".tooltip").remove(); // Cleanup tooltip on component unmount
    };

  }, [barChartData, containerWidth, height, order, fileMappings]);
  

  return (
    <div
    ref={containerRef}
    style={{
      position: 'relative',
      width: 'auto',
      height,
      backgroundColor: 'transparent',
      display: 'flex',
      flexDirection: 'column', // Stack dropdown above the chart
      alignItems: 'center', // Center align content
      paddingTop: '10px', // Add extra space for the dropdown
    }}
    >
    <div className="controls" style={{ position: 'absolute', top: 0, left: 10 }}>
      <label htmlFor="order">Order by: </label>
      <select id="order" value={order} onChange={e => setOrder(e.target.value)}>
        <option value="name">Image Name</option>
        <option value="group">Group</option>
        <option value="ranking">Rank</option>
      </select>
    </div>
    {/* Bar Chart */}
    <svg ref={svgRef} style={{ marginTop: '10px' }}></svg> {/* Added marginTop */}
  </div>
  );
};

export default BarChart;
