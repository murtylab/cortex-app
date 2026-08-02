
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
import { LAB_COLORS } from "./labTheme";

const RegionSelector = ({
  region,
  setRegion,
  dataset,
  tutorialRootKey = "lab-settings-region",
  activeTutorialKey = "lab-settings-region-active",
  variant = "default",
}) => {
  const isEnabled = (option) => {
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
      <FormControl data-tutorial={tutorialRootKey} sx={{ minWidth: 120 }} fullWidth>
        <div
          id="region-buttons-group-label"
          className="lab-eyebrow"
          style={{ marginBottom: 12, fontSize: 12 }}
        >
          Region of interest
        </div>

        <div
          role="group"
          aria-labelledby="region-buttons-group-label"
          style={{
            display: "flex",
            flexWrap: "nowrap",
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
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
                  fontSize: 14,
                  fontWeight: 400,
                  padding: "12px 6px",
                  borderRadius: 5,
                  border: selected
                    ? "0.5px solid transparent"
                    : `0.5px solid ${LAB_COLORS.hairline}`,
                  background: selected
                    ? "var(--highlight-color-button, linear-gradient(135deg, #c98d9a 0%, #b8a4bc 50%, #c4b4cc 100%))"
                    : "transparent",
                  color: selected ? "#ffffff" : LAB_COLORS.text,
                  cursor: enabled ? "pointer" : "not-allowed",
                  opacity: enabled ? 1 : 0.4,
                  lineHeight: 1.2,
                  boxShadow: "none",
                  textAlign: "center",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
