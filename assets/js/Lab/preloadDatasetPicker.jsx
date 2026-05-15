import React from "react";
import { Button } from "antd";
import { PRELOAD_DATASETS } from "../constants";

/**
 * @typedef {Object} PreloadDatasetPickerProps
 * @property {string | null | undefined} selectedKey
 * @property {(key: string | null) => void} onSelectDataset
 * @property {boolean | undefined} isLoading
 * @property {string | null | undefined} loadingKey
 */

/** @param {PreloadDatasetPickerProps} props */
export default function PreloadDatasetPicker({
  selectedKey,
  onSelectDataset,
  isLoading = false,
  loadingKey = null,
}) {
  return (
    <div data-tutorial="lab-upload-dataset-selector" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {Object.entries(PRELOAD_DATASETS).map(([key, ds]) => {
        const active = selectedKey === key;
        const buttonLoading = isLoading && loadingKey === key;

        return (
          <span
            key={key}
            data-tutorial={key === "reza" ? "lab-preload-reza" : undefined}
            style={{ display: "inline-flex" }}
          >
            <Button
              type={active ? "primary" : "default"}
              loading={buttonLoading}
              disabled={isLoading && loadingKey !== key}
              onClick={() => onSelectDataset(active ? null : key)}
              style={{
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              {ds.label}
            </Button>
          </span>
        );
      })}
    </div>
  );
}