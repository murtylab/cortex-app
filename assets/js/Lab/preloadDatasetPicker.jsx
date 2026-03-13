import React from "react";
import { Button } from "antd";
import { PRELOAD_DATASETS } from "../constants";

export default function PreloadDatasetPicker({ selectedKey, onSelectDataset }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {Object.entries(PRELOAD_DATASETS).map(([key, ds]) => {
        const active = selectedKey === key;

        return (
          <Button
            key={key}
            type={active ? "primary" : "default"}
            onClick={() => onSelectDataset(active ? null : key)}
            style={{
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            {ds.label}
          </Button>
        );
      })}
    </div>
  );
}