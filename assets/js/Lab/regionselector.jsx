
import React from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import {
  REGION_OPTIONS,
  MURTY185_INCLUDED_REGIONS,
  NSD_1000_INCLUDED_REGIONS,
} from "../constants";
import StepHeading from "./stepHeading.jsx";

const RegionSelector = ({
  region,
  setRegion,
  dataset,
  tutorialRootKey = "lab-settings-region",
  activeTutorialKey = "lab-settings-region-active",
  variant = "default",
  onView3D,
  is3DOpen = false,
}) => {
  const isEnabled = (option) => {
    if (variant === "lab") return true;

    const value = (option?.value || "").toLowerCase();

    if (dataset === "murty185") {
      return MURTY185_INCLUDED_REGIONS.includes(value);
    }

    if (dataset === "nsd_1000") {
      return NSD_1000_INCLUDED_REGIONS.includes(value);
    }

    return true;
  };

  if (variant === "lab") {
    return (
      <FormControl data-tutorial={tutorialRootKey} sx={{ minWidth: 0 }} fullWidth>
        <StepHeading id="region-buttons-group-label">
          Select a fROI
        </StepHeading>

        <div
          role="group"
          aria-labelledby="region-buttons-group-label"
          className="lab-froi-grid"
          data-tutorial="lab-results-region"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
            width: "100%",
          }}
        >
          {REGION_OPTIONS.map((option) => {
            const selected =
              (region || "").toLowerCase() === (option.value || "").toLowerCase();
            const enabled = isEnabled(option);

            return (
              <button
                key={option.value}
                type="button"
                data-tutorial={selected ? activeTutorialKey : undefined}
                onClick={() => enabled && setRegion(option.value)}
                disabled={!enabled}
                aria-pressed={selected}
                className={`lab-choice-btn${selected ? " is-selected" : ""}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {onView3D && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            {region ? <button
              type="button"
              className="lab-model-card-link"
              onClick={onView3D}
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            >
              {is3DOpen ? "Close 3D x" : "View in 3D ->"}
            </button> : (
              <span className="lab-model-card-link" style={{ color: "var(--lab-muted, #8A8378)" }}>
                Select an fROI to view in 3D
              </span>
            )}
          </div>
        )}
      </FormControl>
    );
  }

  return (
    <FormControl data-tutorial={tutorialRootKey} sx={{ minWidth: 120 }} fullWidth>
      <FormLabel
        id="region-buttons-group-label"
        sx={{ textAlign: "left", color: "black", marginBottom: 1 }}
      >
        Select a Region of Interest
      </FormLabel>

      <ButtonGroup aria-labelledby="region-buttons-group-label" fullWidth>
        {REGION_OPTIONS.map((option) => {
          const selected =
            (region || "").toLowerCase() === (option.value || "").toLowerCase();

          return (
            <Button
              key={option.value}
              data-tutorial={selected ? activeTutorialKey : undefined}
              onClick={() => isEnabled(option) && setRegion(option.value)}
              variant="contained"
              disabled={!isEnabled(option)}
              sx={{
                background: selected ? "var(--highlight-color-button)" : "transparent",
                color: selected ? "#fff" : "var(--tungsten)",
                boxShadow: "none",
                borderRadius: "5px",
                fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)",
                "&:active": { boxShadow: "none" },
                border: "1px solid var(--solid-pink)",

                "&:hover": {
                  background: "var(--highlight-color-button)",
                  color: "#fff",
                  border: "1px solid transparent",
                  boxShadow: "none",
                },

                "&.Mui-disabled": {
                  background: "transparent",
                  color: "#c0c0c0",
                  border: "1px solid #e0e0e0",
                },
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </ButtonGroup>
    </FormControl>
  );
};

export default RegionSelector;
