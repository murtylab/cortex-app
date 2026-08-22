import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { LAB_ROI_INFO, REGION_OPTIONS } from "../constants";

const RoiInfoCard = ({ region }) => {
  const abbrev =
    REGION_OPTIONS.find(
      (option) => (option.value || "").toLowerCase() === (region || "").toLowerCase()
    )?.label || (region || "").toUpperCase();

  const info = LAB_ROI_INFO[(region || "").toLowerCase()] || {
    name: abbrev || "Region of interest",
    stream: "Visual cortex",
    description: "Select an fROI to see where it sits in visual cortex and what it typically prefers.",
    paperLink: "#",
    papername: "",
  };

  const hasPaper = Boolean(info.papername && info.paperLink && info.paperLink !== "#");

  return (
    <Box
      className="lab-roi-card-wrap"
      data-tutorial="lab-roi-card"
      sx={{
        height: "100%",
        minHeight: 0,
        borderRadius: "8px",
      }}
    >
      <Card
        variant="outlined"
        sx={{
          height: "100%",
          borderRadius: "8px",
          boxShadow: "none",
          border: "0.5px solid var(--lab-hairline, #D6D2C6)",
          background: "var(--lab-panel, #FBFAF6)",
        }}
      >
        <CardContent className="lab-model-card lab-roi-card">
          <p className="lab-eyebrow">ROI Card</p>
          {hasPaper ? (
            <a
              className="lab-model-card-name"
              href={info.paperLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {abbrev || "—"}
            </a>
          ) : (
            <span className="lab-model-card-name">{abbrev || "—"}</span>
          )}
          <p className="lab-model-card-type">{info.stream}</p>

          <div className="lab-model-card-rank">
            <p className="lab-roi-card-description">{info.description}</p>
            {hasPaper ? (
              <div className="lab-model-card-rank-lines">
                <a
                  className="lab-model-card-link"
                  href={info.paperLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {info.papername}
                </a>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RoiInfoCard;
