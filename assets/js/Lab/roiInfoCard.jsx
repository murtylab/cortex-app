import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { LAB_ROI_INFO, REGION_OPTIONS } from "../constants";

const RoiInfoCard = ({ region, variant = "stage", children }) => {
  const abbrev =
    REGION_OPTIONS.find(
      (option) => (option.value || "").toLowerCase() === (region || "").toLowerCase()
    )?.label || (region || "").toUpperCase();

  const info = LAB_ROI_INFO[(region || "").toLowerCase()] || {
    name: abbrev || "Region of interest",
    stream: "Visual cortex",
    description: "Select an fROI to see where it sits in visual cortex and what it typically prefers.",
  };

  return (
    <Box
      className={`lab-roi-card-wrap${variant === "rail" ? " is-rail" : ""}${children ? " has-viewer" : ""}`}
      data-tutorial="lab-roi-card"
      sx={{
        height: variant === "rail" || children ? "auto" : "100%",
        minHeight: 0,
        borderRadius: "8px",
      }}
    >
      <Card
        variant="outlined"
        sx={{
          height: variant === "rail" || children ? "auto" : "100%",
          borderRadius: "8px",
          boxShadow: "none",
          border: "0.5px solid var(--lab-hairline, #D6D2C6)",
          background: "var(--lab-panel, #FBFAF6)",
        }}
      >
        <CardContent className="lab-model-card lab-roi-card">
          <div className="lab-roi-card-head">
            <div className="lab-roi-card-identity">
              <p className="lab-section-label">ROI Card</p>
              <span className="lab-model-card-name">{abbrev || "—"}</span>
              <p className="lab-model-card-type">{info.stream}</p>
            </div>
            <p className="lab-roi-card-description">{info.description}</p>
          </div>
          {children ? <div className="lab-roi-card-viewer">{children}</div> : null}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RoiInfoCard;
