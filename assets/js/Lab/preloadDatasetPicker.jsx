import React from "react";
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
    <div data-tutorial="lab-upload-dataset-selector" className="lab-paper-grid">
      {Object.entries(PRELOAD_DATASETS).map(([key, ds]) => {
        const active = selectedKey === key;
        const buttonLoading = isLoading && loadingKey === key;

        return (
          <button
            key={key}
            type="button"
            data-tutorial={key === "reza" ? "lab-preload-reza" : undefined}
            className={`lab-choice-btn${active ? " is-selected" : ""}`}
            disabled={isLoading && loadingKey !== key}
            aria-pressed={active}
            aria-busy={buttonLoading || undefined}
            title={ds.label}
            onClick={() => onSelectDataset(active ? null : key)}
          >
            {buttonLoading ? "Loading…" : ds.label}
          </button>
        );
      })}
    </div>
  );
}
