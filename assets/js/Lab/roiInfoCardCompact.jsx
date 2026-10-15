import * as React from "react";
import Box from "@mui/material/Box";
import { LAB_ROI_INFO, REGION_OPTIONS } from "../constants";

const RoiInfoCardCompact = ({ region }) => {
  const key = (region || "").toLowerCase();
  const label = REGION_OPTIONS.find(
    (option) => (option.value || "").toLowerCase() === key
  )?.label || key.toUpperCase();
  const info = LAB_ROI_INFO[key];

  return (
    <Box
      component="details"
      sx={{
        border: "0.5px solid var(--lab-hairline, #D6D2C6)",
        borderRadius: "8px",
        background: "var(--lab-panel, #FBFAF6)",
        padding: "12px",
        "& summary": { cursor: "pointer", listStyle: "none" },
        "& summary::-webkit-details-marker": { display: "none" },
        "& .roi-compact-chevron": { transition: "transform 150ms ease" },
        "&[open] .roi-compact-chevron": { transform: "rotate(180deg)" },
        "& summary:focus-visible": { outline: "2px solid currentColor", outlineOffset: "4px" },
      }}
    >
      <summary>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="lab-section-label">ROI Card</span>
          <svg className="roi-compact-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 8px", marginTop: 6 }}>
          <span className="lab-model-card-name" style={{ fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{label || "—"}</span>
          <span style={{ fontSize: 12, color: "var(--lab-muted, #706D65)" }}>{info?.stream || "Visual cortex"}</span>
        </div>
      </summary>
      <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.6 }}>
        {info?.description || "Select an fROI to see where it sits in visual cortex and what it typically prefers."}
      </p>
    </Box>
  );
};

export default RoiInfoCardCompact;
