import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { heatmapStyles, styleTooltip } from './heatmapstyles';

const Heatmap = ({ heatmapData, originalFilenames, sortedFilenames, width, height, fileMappings}) => {
  const svgRef = useRef();
  const containerRef = useRef();
  const [order, setOrder] = useState("name");
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
  
   const getBlobURL = (filename) => {
  const mapping = fileMappings?.find(
    (m) => (m.file ? m.file.name : m.name) === filename
  );
  console.log("🔍 getBlobURL lookup:", {
    filename,
    mapping,
    allFileMappings: fileMappings
  });
  return mapping ? mapping.blobURL : null;
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

    const currentOrder = order === "name" ? originalFilenames : sortedFilenames;

    const xScale = d3.scaleBand().domain(currentOrder).range([0, innerWidth]).padding(0);
    const yScale = d3.scaleBand().domain(currentOrder).range([0, innerHeight]).padding(0);

    // Set up color scale
    const colorScale = d3.scaleSequential(d3.interpolatePlasma)
      .domain([d3.min(heatmapData, d => d.value), d3.max(heatmapData, d => d.value)]);

    // Adjust SVG size
    svg.attr("width", Math.max(width, 500))
       .attr("height", Math.max(height, 500));

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
            .attr("width", Math.min(xScale.bandwidth(), yScale.bandwidth()))
            .attr("height", Math.min(xScale.bandwidth(), yScale.bandwidth()))
            .attr("fill", d => colorScale(d.value))
            .on("mouseover", (event, d) => {
              const blobURL_imageX = getBlobURL(d.x);
              const blobURL_imageY = getBlobURL(d.y);

              const cellColor = colorScale(d.value);

              let imageHtml, labelHtml;
              if (d.x === d.y) {
                imageHtml = `<img src="${blobURL_imageX}" alt="Thumbnail" style="width: 140px; height: 140px; border-radius: 5px; object-fit: cover; border: 1px solid #ccc;" onerror="this.style.display='none'">`;
                labelHtml = `<p><strong>x & y:</strong> ${d.x}</p>`;
              } else {
                imageHtml = `<img src="${blobURL_imageX}" alt="Thumbnail" style="width: 140px; height: 140px; border-radius: 5px; object-fit: cover; border: 1px solid #ccc;" onerror="this.style.display='none'">
                             <img src="${blobURL_imageY}" alt="Thumbnail" style="width: 140px; height: 140px; border-radius: 5px; object-fit: cover; border: 1px solid #ccc;" onerror="this.style.display='none'">`;
                labelHtml = `<div style="display: flex; justify-content: center; gap: 10px;">
                               <p><strong>x:</strong> ${d.x}</p>
                               <p><strong>y:</strong> ${d.y}</p>
                             </div>`;
              }

              tooltip.html(`
                  <div style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 2px;">${imageHtml}</div>
                    ${labelHtml}
                    <p style="margin: 0;"><strong>Euclidean distance:</strong> ${d.value.toFixed(4)}
                      <span style="display: inline-block; width: 20px; height: 20px; background-color: ${cellColor}; border-radius: 50%; border: 1px solid #555;"></span>
                    </p>
                  </div>
                `).style("display", "block");
                console.log("✅ Tooltip updated:", tooltip.node());
            })
            .on("mousemove", (event,d) => {
              const blobURL_imageX = getBlobURL(d.x);
  const blobURL_imageY = getBlobURL(d.y);

  console.log("blobURL_imageX:", blobURL_imageX);
  console.log("blobURL_imageY:", blobURL_imageY);

               console.log("heatmap x:", d.x, "y:", d.y, "fileMappings:", fileMappings);

              const containerRect = containerRef.current.getBoundingClientRect(); 
              tooltip
                .style("left", `${event.clientX - containerRect.left + 10}px`)
                .style("top", `${event.clientY - containerRect.top - 40}px`)
                .style("opacity", 1)
                .style("visibility", "visible");
            })
            .on("mouseout", () => {tooltip.style("display", "none");}),
      );
    
    //legend
    // Add legend
    const legend = g.append("g")
      .attr("transform", `translate(-50, 50)`); // Move legend to the left of the heatmap
    
    const legendColorScale = d3.scaleSequential(d3.interpolatePlasma)
      .domain([d3.min(heatmapData, d => d.value), d3.max(heatmapData, d => d.value)]);
    
    const legendHeight = 600;
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
      .attr("x", legendWidth / 2) // Center the text
      .attr("y", 630) // Adjust y position for the first line
      .attr("text-anchor", "middle") // Center align the text
      .style("font-size", "15px")
      .text("euclidean");

    legend.append("text")
      .attr("x", legendWidth / 2) // Center the text
      .attr("y", 650) // Adjust y position for the second line
      .attr("text-anchor", "middle") // Center align the text
      .style("font-size", "15px")
      .text("distance");
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
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default Heatmap;
