import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { interpolateRdBu } from "d3-scale-chromatic";
import { barchartStyles, createXScale, createYScale, styleTooltip } from './barchartstyles';

const BarChart = ({ barChartData, height, fileMappings}) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [containerWidth, setContainerWidth] = useState(0);
  const [order, setOrder] = useState("filename");

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

const getFileInfo = (filename) => {
  // 兼容 demo 模式：优先找 file.name，否则用我们自己加的 name
  const mapping = fileMappings?.find(
    (m) => (m.file ? m.file.name : m.name) === filename
  );
  if (!mapping) return { blobURL: null, folder: null };

  let folder = null;

  if (mapping.file) {
    // ✅ 真实上传的文件才可能有 webkitRelativePath
    const relPath = mapping.file.webkitRelativePath || "";
    folder = relPath && relPath.includes("/")
      ? relPath.split("/").slice(0, -1).join("/")
      : null;
  } else {
    // ✅ demo 模式：用一个假 folder（比如 "demo"）
    folder = "demo";
  }

  return { blobURL: mapping.blobURL, folder };
};


  const getFolderForFilename = (filename) => {
  // ✅ 找到文件在 fileMappings 里的 index，当作“folder顺序”
    const index = fileMappings?.findIndex(m => m.name === filename);
    if (index === -1) return "";
    return `Folder-${Math.floor(index / 5) + 1}`;  // 比如每5个一组，Folder-1, Folder-2
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

    const MAX_BAR_WIDTH = 100; // Maximum width for each bar

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
    

    let yMin = d3.min(sortedData, d => d.mean - d.sem);
    let yMax = d3.max(sortedData, d => d.mean + d.sem);

    // Expand domain if yMin === yMax
    if (yMin === yMax) {
      yMin -= 1; // Add some padding below
      yMax += 1; // Add some padding above
    }

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

     d3.select(containerRef.current).select(".tooltip").remove();
        const tooltip = d3.select(containerRef.current)
          .append("div")
          .attr("class", "tooltip");
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

        const { blobURL, folder } = getFileInfo(d.filename);

        tooltip
          .html(
            `<div>
              <p><strong>Filename:</strong> ${d.filename}</p>
              <p><strong>Folder:</strong> ${folder ?? "(none)"}</p>
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
      .attr("stroke-width", adjustedBandwidth / 10);

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
      .attr("stroke-width", adjustedBandwidth / 10);

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
      .attr("stroke-width", adjustedBandwidth / 10);

 


    

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
    <div className="controls" style={{ position: 'absolute', top: -150, left: 10 }}>
      <label htmlFor="order">Order by: </label>
      <select id="order" value={order} onChange={e => setOrder(e.target.value)}>
        <option value="name">Image Name</option>
        <option value="folder">Folder</option>
        <option value="ranking">Rank</option>
      </select>
    </div>
    {/* Bar Chart */}
    <svg ref={svgRef} style={{ marginTop: '10px' }}></svg> {/* Added marginTop */}
  </div>
  );
};

export default BarChart;
