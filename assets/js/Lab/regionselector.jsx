
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

const RegionSelector = ({
  region,
  setRegion,
  dataset,
  tutorialRootKey = "lab-settings-region",
  activeTutorialKey = "lab-settings-region-active",
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