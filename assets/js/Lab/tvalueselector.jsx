import React from "react";
import { Slider, InputNumber, Typography, Space } from "antd";

const { Text } = Typography;

const TValueSelector = ({
  label = "T-value Threshold",
  min = 1.96,
  max = 5.0,
  value = 1.96,
  step = 0.1,
  onChange,
  changeable = true,
}) => {
  const safeValue = typeof value === "number" ? value : min;

  const handleChange = (newValue) => {
    if (!changeable) return;
    if (typeof newValue !== "number" || Number.isNaN(newValue)) return;

    const clamped = Math.min(max, Math.max(min, newValue));
    onChange?.(clamped);
  };

  return (
    <div
      style={{
        width: "100%",
        padding: "16px",
        border: "1px solid #e5e5e5",
        borderRadius: "12px",
        background: changeable ? "#fff" : "#f7f7f7",
        opacity: changeable ? 1 : 0.7,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <Text strong style={{ color: "black" }}>
          {label}
        </Text>

        {!changeable && (
          <Text type="secondary">Waiting for prediction results</Text>
        )}
      </div>

      <Space
        direction="vertical"
        size="middle"
        style={{ width: "100%" }}
      >
        <Slider
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={handleChange}
          disabled={!changeable}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text type="secondary">
            Range: {min} - {max}
          </Text>

          <InputNumber
            min={min}
            max={max}
            step={step}
            value={safeValue}
            onChange={handleChange}
            disabled={!changeable}
            style={{ width: 120 }}
          />
        </div>
      </Space>
    </div>
  );
};

export default TValueSelector;