import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { barchartStyles, styleTooltip } from './barchartstyles';
import { LAB_CHART, LAB_COLORS, styleLabAxis, applyLabAxisTitle } from './labTheme';

// Fabio Crameri's "vik" perceptually-uniform diverging scientific colour map
// (blue = negative, warm red = positive). Colour-blind safe.
const VIK_COLORS = [
  "#001261", "#022a70", "#03417f", "#08598f", "#2575a1", "#5194b6",
  "#80b2ca", "#b0cfde", "#dee6e9", "#eedbd0", "#e4bea8", "#d7a081",
  "#cc855d", "#c06b3a", "#af4c18", "#8f2b06", "#731406", "#590008",
];

/**
 * @param {{
 *   barChartData: any[];
 *   height: number;
 *   fileMappings: any[];
 *   order: string;
 *   setOrder: (nextOrder: string) => void;
 *   tutorialSelectedGroups?: string[] | null;
 *   labChart?: boolean;
 * }} props
 */
const BarChart = ({
  barChartData,
  height,
  fileMappings,
  order,
  setOrder,
  tutorialSelectedGroups = null,
  labChart = false,
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tutorialChartAnimationsRef = useRef([]);
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

  const effectiveSelectedGroups = tutorialSelectedGroups ?? selectedGroups;
  const tutorialActiveGroup = tutorialSelectedGroups?.[0] ?? null;

  const clearTutorialChartAnimations = () => {
    tutorialChartAnimationsRef.current.forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        // Ignore animations that are already finished.
      }
    });

    tutorialChartAnimationsRef.current = [];
  };

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

    if (effectiveSelectedGroups.length === 0) return true;

    return effectiveSelectedGroups.includes(group);
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
    return () => {
      clearTutorialChartAnimations();
    };
  }, []);

  useEffect(() => {
    const sortedData = getSortedData;
    const groupSpans = [];

    clearTutorialChartAnimations();

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

    const MAX_BAR_WIDTH = 25;
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

    const maxAbsVariation =
      d3.max(
        sortedData,
        (d) => Math.max(Math.abs(d.mean - d.sem), Math.abs(d.mean + d.sem))
      ) ?? 0;
    const yExtent = maxAbsVariation + 0.05;
    const yMin = -yExtent;
    const yMax = yExtent;

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    const colorScale = d3
      .scaleDiverging()
      .domain([yMin, 0, yMax])
      .interpolator(d3.interpolateRgbBasis(VIK_COLORS));

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
    const bars = g.selectAll(".bar")
      .data(sortedData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("data-tutorial-bar-group", (d) => getGroupForFilename(d.filename))
      .attr("x", (d) => shiftX(xScale(d.filename) + (xScale.bandwidth() - adjustedBandwidth) / 2))
      .attr("y", (d) => (d.mean >= 0 ? yScale(d.mean) : yScale(0)))
      .attr("width", adjustedBandwidth)
      .attr("height", (d) => Math.abs(yScale(d.mean) - yScale(0)))
      .style("transform-box", "fill-box")
      .style("transform-origin", "50% 100%")
      .attr("fill", (d) => {
        const color = colorScale(d.mean);
        return isGroupHighlighted(d.filename)
          ? color
          : desaturateColor(color, 0.2);
      })
      .attr("opacity", (d) => (isGroupHighlighted(d.filename) ? 1 : 0.2))
      .attr("stroke", (d) =>
        tutorialActiveGroup && getGroupForFilename(d.filename) === tutorialActiveGroup
          ? "rgba(91, 58, 110, 0.9)"
          : "none"
      )
      .attr("stroke-width", (d) =>
        tutorialActiveGroup && getGroupForFilename(d.filename) === tutorialActiveGroup ? 2.2 : 0
      )
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
        const color = colorScale(d.mean);
        d3.select(event.currentTarget).attr(
          "fill",
          isGroupHighlighted(d.filename) ? color : desaturateColor(color, 0.2)
        );
        tooltip.style("display", "none");
      });

    if (order === "ranking" && tutorialActiveGroup) {
      bars
        .filter((d) => getGroupForFilename(d.filename) === tutorialActiveGroup)
        .each((_, index, nodes) => {
          const node = nodes[index];
          if (!(node instanceof SVGGraphicsElement)) {
            return;
          }

          const animation = node.animate(
            [
              {
                transform: "translateY(0px) scale(1)",
                opacity: 1,
              },
              {
                transform: "translateY(-10px) scale(1.05)",
                opacity: 1,
              },
              {
                transform: "translateY(0px) scale(1)",
                opacity: 1,
              },
            ],
            {
              duration: 920,
              delay: index * 36,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
          );

          tutorialChartAnimationsRef.current.push(animation);
        });
    }

    // Y axis
    const yAxisG = g.append("g")
      .attr("transform", "translate(20, 0)")
      .call(d3.axisLeft(yScale));
    if (labChart) {
      styleLabAxis(yAxisG);
      // No plot frame: hide domain path, keep ticks
      yAxisG.select(".domain").remove();
    }

    // X axis baseline
    g.append("line")
      .attr("x1", 20)
      .attr("x2", innerWidth + 20)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", labChart ? LAB_COLORS.hairline : "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", labChart ? null : "3,2");

    // Axis labels
    const xTitle = g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .style("font-size", labChart ? `${LAB_CHART.axisTitle.fontSize}px` : "14px")
      .text(labChart ? "Images" : "Images");
    if (labChart) applyLabAxisTitle(xTitle);

    const yTitle = g.append("text")
      .attr("x", -margin.left - 50)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .style("font-size", labChart ? `${LAB_CHART.axisTitle.fontSize}px` : "20px")
      .text(labChart ? "Predicted response" : "Mean Predicted Response");
    if (labChart) applyLabAxisTitle(yTitle);

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
      .attr("stroke-width", adjustedBandwidth / 20)
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
      .attr("stroke-width", adjustedBandwidth / 20)
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
      .attr("stroke-width", adjustedBandwidth / 20)
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
        .style("font-family", labChart ? LAB_CHART.category.fontFamily : null)
        .style("font-size", labChart ? `${LAB_CHART.category.fontSize}px` : "12px")
        .style("font-weight", labChart ? LAB_CHART.category.fontWeight : null)
        .style("fill", labChart ? LAB_CHART.category.fill : "#666")
        .text(group);
            });
          }

    return () => {
      clearTutorialChartAnimations();
      d3.select(containerRef.current).select(".tooltip").remove();
    };
  }, [
    getSortedData,
    containerWidth,
    height,
    fileMap,
    order,
    selectedGroups,
    tutorialActiveGroup,
    tutorialSelectedGroups,
    labChart,
  ]);

  return (
    <div
      data-tutorial="lab-results-barchart-panel"
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
          data-tutorial="lab-results-barchart-order"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <label
            htmlFor="order"
            style={labChart ? {
              fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--lab-text, #211F1C)',
            } : undefined}
          >
            {labChart ? 'Order by' : 'Order by:'}
          </label>
          <select
            id="order"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            style={labChart ? {
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              border: '0.5px solid var(--lab-hairline, #D6D2C6)',
              borderRadius: 5,
              padding: '6px 10px',
              background: 'var(--lab-panel, #FBFAF6)',
              color: 'var(--lab-text, #211F1C)',
            } : undefined}
          >
            <option value="group">Group</option>
            <option value="ranking">Rank</option>
          </select>
        </div>

        {order === "ranking" && allGroups.length > 0 && (
          <div
            data-tutorial="lab-results-barchart-highlight"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span style={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              fontSize: labChart ? 13 : undefined,
              fontFamily: labChart ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
            }}>
              {labChart ? 'Highlight group' : 'Highlight group:'}
            </span>

            {allGroups.map((group) => (
              <label
                key={group}
                data-tutorial-result-group={group}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border:
                    tutorialActiveGroup === group
                      ? '1px solid rgba(91, 58, 110, 0.45)'
                      : effectiveSelectedGroups.includes(group)
                      ? '1px solid rgba(107, 99, 88, 0.35)'
                      : '1px solid transparent',
                  background:
                    tutorialActiveGroup === group
                      ? 'rgba(91, 58, 110, 0.10)'
                      : effectiveSelectedGroups.includes(group)
                      ? 'rgba(247, 242, 238, 0.95)'
                      : 'transparent',
                  boxShadow: 'none',
                  transform: 'none',
                  opacity:
                    effectiveSelectedGroups.length > 0 && !effectiveSelectedGroups.includes(group)
                      ? 0.55
                      : 1,
                  transition: 'all 220ms ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={effectiveSelectedGroups.includes(group)}
                  onChange={() => toggleGroupSelection(group)}
                />
                <span style={{
                  fontFamily: "var(--lab-mono, var(--mono-font, 'IBM Plex Mono', monospace))",
                  fontSize: '12px',
                  fontWeight: 400,
                }}>{group}</span>
              </label>
            ))}

            <button
              type="button"
              className={labChart ? 'lab-secondary-btn' : undefined}
              onClick={() => setSelectedGroups([])}
              disabled={effectiveSelectedGroups.length === 0}
              style={labChart ? {
                padding: '4px 12px',
                opacity: effectiveSelectedGroups.length === 0 ? 0.45 : 1,
                cursor: effectiveSelectedGroups.length === 0 ? 'default' : 'pointer',
              } : {
                cursor: effectiveSelectedGroups.length === 0 ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '13px',
                fontWeight: 500,
                color: effectiveSelectedGroups.length === 0 ? 'rgba(107, 99, 88, 0.4)' : 'rgba(61, 56, 50, 0.9)',
                padding: '4px 12px',
                borderRadius: '5px',
                border: '1px solid rgba(107, 99, 88, 0.35)',
                background: 'rgba(255, 255, 255, 0.65)',
                opacity: effectiveSelectedGroups.length === 0 ? 0.6 : 1,
                transition: 'all 220ms ease',
              }}
              onMouseEnter={labChart ? undefined : (e) => {
                if (effectiveSelectedGroups.length === 0) return;
                e.currentTarget.style.background = 'rgba(247, 242, 238, 0.95)';
                e.currentTarget.style.borderColor = 'rgba(91, 58, 110, 0.45)';
              }}
              onMouseLeave={labChart ? undefined : (e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.65)';
                e.currentTarget.style.borderColor = 'rgba(107, 99, 88, 0.35)';
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        style={{
          marginTop: '10px',
          width: '100%',
          fontFamily: labChart
            ? "'IBM Plex Mono', ui-monospace, monospace"
            : "'Inter', system-ui, sans-serif",
        }}
      />
    </div>
  );
};

export default BarChart;