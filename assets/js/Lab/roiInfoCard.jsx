import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { LAB_ROI_INFO, REGION_OPTIONS } from "../constants";

const RoiInfoCard = ({ region, variant = "stage", children, onClose }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const ignoreScrollUntil = React.useRef(0);
  const abbrev =
    REGION_OPTIONS.find(
      (option) => (option.value || "").toLowerCase() === (region || "").toLowerCase()
    )?.label || (region || "").toUpperCase();

  const info = LAB_ROI_INFO[(region || "").toLowerCase()] || {
    name: abbrev || "Region of interest",
    stream: "Visual cortex",
    description: "Select an fROI to see where it sits in visual cortex and what it typically prefers.",
  };

  const setCollapsedFromUser = (next) => {
    ignoreScrollUntil.current = performance.now() + 700;
    setCollapsed(next);
  };

  React.useEffect(() => {
    if (onClose) return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (performance.now() < ignoreScrollUntil.current) return;
      if (delta > 12 && y > 40) setCollapsed(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onClose]);

  return (
    <Box
      className={`lab-roi-card-wrap${variant === "rail" ? " is-rail" : ""}${children ? " has-viewer" : ""}${collapsed ? " is-collapsed" : ""}`}
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
          <div
            className="lab-roi-card-head"
            onClick={() => {
              if (collapsed) setCollapsedFromUser(false);
            }}
          >
            <div className="lab-roi-card-identity">
              <p className="lab-section-label">ROI Card</p>
              <span className="lab-model-card-name">{abbrev || "—"}</span>
              <p className="lab-model-card-type">{info.stream}</p>
            </div>
            <p className="lab-roi-card-description">{info.description}</p>
            <button
              type="button"
              className="lab-roi-card-toggle"
              aria-expanded={onClose ? undefined : !collapsed}
              aria-label={onClose ? "Close ROI viewer" : collapsed ? "Expand ROI card" : "Collapse ROI card"}
              onClick={(event) => {
                event.stopPropagation();
                if (onClose) onClose();
                else setCollapsedFromUser(!collapsed);
              }}
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                <path
                  d={onClose ? "M3 3 9 9 M9 3 3 9" : collapsed ? "M2 4.5 6 8.5 10 4.5" : "M2 7.5 6 3.5 10 7.5"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {children ? <div className="lab-roi-card-viewer">{children}</div> : null}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RoiInfoCard;
