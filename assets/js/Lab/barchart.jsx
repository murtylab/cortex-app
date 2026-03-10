import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { barchartStyles, styleTooltip } from './barchartstyles';

const BarChart = ({ barChartData, height, fileMappings,order, setOrder }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const [selectedGroups, setSelectedGroups] = useState([]);


  

  // Build a lookup map using serverKey first, since prediction results
  // usually come back with the renamed/uploaded filename.
  const fileMap = useMemo(() => {
    const m = new Map();

    (fileMappings || []).forEach((f) => {
      if (f.serverKey) {
        m.set(f.serverKey, f);
      }
      // Optional fallback: also map uid in case some data uses uid
      if (f.uid) {
        m.set(f.uid, f);
      }
      // Optional fallback: original file name
      if (f.file?.name) {
        m.set(f.file.name, f);
      }
    });

    return m;
  }, [fileMappings]);

  const getMappingForFilename = (filename) => {
    return fileMap.get(filename) || null;
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

  const getDisplayLabel = (filename) => {
    const mapping = getMappingForFilename(filename);
    return mapping?.label || filename;
  };

  const allGroups = useMemo(() => {
    if (!barChartData || !Array.isArray(barChartData)) return [];

    const groups = Array.from(
      new Set(barChartData.map((d) => getGroupForFilename(d.filename)))
    );

    return groups.sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [barChartData, fileMap]);

  const toggleGroupSelection = (group) => {
    setSelectedGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  const isGroupHighlighted = (filename) => {
    if (order !== "ranking") return true;

    const group = getGroupForFilename(filename);

    if (selectedGroups.length === 0) return true;

    return selectedGroups.includes(group);
  };

  const desaturateColor = (color, factor = 0.1) => {
      const hsl = d3.hsl(color);
      hsl.s = hsl.s * factor; 
      return hsl.toString();
    };
  


  const getSortedData = useMemo(() => {
    if (!barChartData || !Array.isArray(barChartData)) return [];

    if (order === "ranking") {
      return [...barChartData].sort((a, b) => b.mean - a.mean);
    }

    if (order === "group") {
      return [...barChartData].sort((a, b) => {
        const groupA = getGroupForFilename(a.filename);
        const groupB = getGroupForFilename(b.filename);

        if (groupA === groupB) {
          const labelA = getDisplayLabel(a.filename);
          const labelB = getDisplayLabel(b.filename);

          return labelA.localeCompare(labelB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return groupA.localeCompare(groupB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    }

    return [...barChartData];
}, [barChartData, order, fileMap]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const sortedData = getSortedData;
    const groupSpans = [];

    if (order === "group" && sortedData.length > 0) {
      let startIndex = 0;

      while (startIndex < sortedData.length) {
        const currentGroup = getGroupForFilename(sortedData[startIndex].filename);
        let endIndex = startIndex;

        while (
          endIndex + 1 < sortedData.length &&
          getGroupForFilename(sortedData[endIndex + 1].filename) === currentGroup
        ) {
          endIndex++;
        }

        groupSpans.push({
          group: currentGroup,
          startDatum: sortedData[startIndex],
          endDatum: sortedData[endIndex],
        });

        startIndex = endIndex + 1;
      }
    }

    if (!sortedData || sortedData.length === 0 || !containerWidth) {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = barchartStyles?.margin || {
      top: 60,
      right: 30,
      bottom: 80,
      left: 80,
    };

    const width = containerWidth;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const MAX_BAR_WIDTH = 100;
    const totalWidth = Math.min(innerWidth, sortedData.length * (MAX_BAR_WIDTH + 20));

    const xScale = d3
      .scaleBand()
      .domain(sortedData.map((d) => d.filename))
      .range([(innerWidth - totalWidth) / 2, (innerWidth + totalWidth) / 2])
      .padding(0.1)
      .paddingOuter(0.2);

    const adjustedBandwidth = Math.min(xScale.bandwidth(), MAX_BAR_WIDTH);

    const barCenterX = (d) =>
      xScale(d.filename) +
      (xScale.bandwidth() - adjustedBandwidth) / 2 +
      adjustedBandwidth / 2;

    let yMin = d3.min(sortedData, (d) => d.mean - d.sem);
    let yMax = d3.max(sortedData, (d) => d.mean + d.sem);

    if (yMin == null || yMax == null) {
      return;
    }

    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    const colorScale = d3
      .scaleDiverging()
      .domain([yMin, 0, yMax])
      .interpolator((t) => d3.interpolateRdBu(1 - t));

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

    const shiftX = (x) => x + 20;

    // Bars
    g.selectAll(".bar")
      .data(sortedData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => shiftX(xScale(d.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2))
      .attr("y", (d) => (d.mean >= 0 ? yScale(d.mean) : yScale(0)))
      .attr("width", adjustedBandwidth)
      .attr("height", (d) => Math.abs(yScale(d.mean) - yScale(0)))
      .attr("fill", (d) => {
        const color = colorScale(d.mean);
        return isGroupHighlighted(d.filename)
          ? color
          : desaturateColor(color, 0.2);
      })
      .attr("opacity", (d) => (isGroupHighlighted(d.filename) ? 1 : 0.2))
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr(
          "fill",
          d3.color(colorScale(d.mean))?.darker(0.5)?.toString() || colorScale(d.mean)
        );

        const { blobURL, group, label } = getFileInfo(d.filename);

        tooltip
          .html(`
            <div>
              <p><strong>Filename:</strong> ${label}</p>
              <p><strong>Group:</strong> ${group}</p>
              <p><strong>Mean:</strong> ${Number(d.mean).toFixed(4)}</p>
              <p><strong>SEM:</strong> ${Number(d.sem).toFixed(4)}</p>
              ${
                blobURL
                  ? `<img
                      src="${blobURL}"
                      alt="Thumbnail"
                      style="width: 140px; height: 140px; object-fit: cover; margin-top: 6px; border: 1px solid #ccc;"
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
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget).attr("fill", colorScale(d.mean));
        tooltip.style("display", "none");
      });

    // Y axis
    g.append("g")
      .attr("transform", "translate(20, 0)")
      .call(d3.axisLeft(yScale));

    // X axis baseline
    g.append("line")
      .attr("x1", 20)
      .attr("x2", innerWidth + 20)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    // Axis labels
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

    // Error bars
    g.selectAll(".error-bar")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("class", "error-bar")
      .attr("x1", (d) => shiftX(barCenterX(d)))
      .attr("x2", (d) => shiftX(barCenterX(d)))
      .attr("y1", (d) => yScale(d.mean - d.sem))
      .attr("y2", (d) => yScale(d.mean + d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 10)
      .attr("opacity", (d) => (isGroupHighlighted(d.filename) ? 1 : 0.2));

    g.selectAll(".cap-top")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("x1", (d) => shiftX(barCenterX(d) - adjustedBandwidth / 4))
      .attr("x2", (d) => shiftX(barCenterX(d) + adjustedBandwidth / 4))
      .attr("y1", (d) => yScale(d.mean + d.sem))
      .attr("y2", (d) => yScale(d.mean + d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 10)
      .attr("opacity", (d) => (isGroupHighlighted(d.filename) ? 1 : 0.2));

    g.selectAll(".cap-bottom")
      .data(sortedData)
      .enter()
      .append("line")
      .attr("x1", (d) => shiftX(barCenterX(d) - adjustedBandwidth / 4))
      .attr("x2", (d) => shiftX(barCenterX(d) + adjustedBandwidth / 4))
      .attr("y1", (d) => yScale(d.mean - d.sem))
      .attr("y2", (d) => yScale(d.mean - d.sem))
      .attr("stroke", "grey")
      .attr("stroke-width", adjustedBandwidth / 10)
      .attr("opacity", (d) => (isGroupHighlighted(d.filename) ? 1 : 0.2));





    if (order === "group" && groupSpans.length > 0) {
      const groupLabelY = -8;       
      const tickHeight = 8;        
      const textOffsetY = -12;    
      const groupLabelG = g.append("g").attr("class", "group-labels");

      groupSpans.forEach(({ group, startDatum, endDatum }) => {
        const startX =
          shiftX(xScale(startDatum.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2);

        const endX =
          shiftX(xScale(endDatum.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2) +
          adjustedBandwidth;

        const centerX = (startX + endX) / 2;

  
        groupLabelG
          .append("line")
          .attr("x1", startX)
          .attr("x2", endX)
          .attr("y1", groupLabelY)
          .attr("y2", groupLabelY)
          .attr("stroke", "#888")
          .attr("stroke-width", 1.2);

        groupLabelG
          .append("line")
          .attr("x1", startX)
          .attr("x2", startX)
          .attr("y1", groupLabelY)
          .attr("y2", groupLabelY + tickHeight)
          .attr("stroke", "#888")
          .attr("stroke-width", 1.2);

        
        groupLabelG
          .append("line")
          .attr("x1", endX)
          .attr("x2", endX)
          .attr("y1", groupLabelY)
          .attr("y2", groupLabelY + tickHeight)
          .attr("stroke", "#888")
          .attr("stroke-width", 1.2);

  
   
      groupLabelG
        .append("rect")
        .attr("x", centerX - 28)
        .attr("y", textOffsetY - 10)
        .attr("width", 56)
        .attr("height", 16)
        .attr("fill", "var(--background-color)");

  
      groupLabelG
        .append("text")
        .attr("x", centerX)
        .attr("y", textOffsetY + 2)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text(group);
            });
          }

    return () => {
      d3.select(containerRef.current).select(".tooltip").remove();
    };
  }, [getSortedData, containerWidth, height, fileMap, selectedGroups, order]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '10px',
      }}
    >
      <div
        className="controls"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          padding: '6px 10px 0 10px',
          flexWrap: 'wrap',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <label htmlFor="order">Order by:</label>
          <select id="order" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="group">Group</option>
            <option value="ranking">Rank</option>
          </select>
        </div>

        {order === "ranking" && allGroups.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
              Highlight group:
            </span>

            {allGroups.map((group) => (
              <label
                key={group}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group)}
                  onChange={() => toggleGroupSelection(group)}
                />
                {group}
              </label>
            ))}

            <button
              type="button"
              onClick={() => setSelectedGroups([])}
              style={{
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <svg ref={svgRef} style={{ marginTop: '10px', width: '100%' }} />
    </div>
  );
};

export default BarChart;