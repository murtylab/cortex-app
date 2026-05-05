import React, { useMemo } from "react";
import { Card, Checkbox, Typography, Empty } from "antd";

const { Title, Text } = Typography;

type PreviewFile = {
  uid: string;
  blobURL: string;
  file: File;
  label: string;
  groupKey: string;
  serverKey?: string;
};

type ContrastGroupSelectorProps = {
  files: PreviewFile[];
  groupA: string[];
  setGroupA: React.Dispatch<React.SetStateAction<string[]>>;
  groupB: string[];
  setGroupB: React.Dispatch<React.SetStateAction<string[]>>;
  viewOnly?: boolean;
};

const sectionStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 260,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
};

export default function ContrastGroupSelector({
  files,
  groupA,
  setGroupA,
  groupB,
  setGroupB,
  viewOnly = false,
}: ContrastGroupSelectorProps) {
  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      if (f?.groupKey) set.add(f.groupKey);
    });
    return Array.from(set);
  }, [files]);

  const handlePreferredChange = (checkedValues: Array<string | number>) => {
    if (viewOnly) return;
    const nextA = checkedValues.map(String);
    const filteredB = groupB.filter((g) => !nextA.includes(g));
    setGroupA(nextA);
    setGroupB(filteredB);
  };

  const handleContrastChange = (checkedValues: Array<string | number>) => {
    if (viewOnly) return;
    const nextB = checkedValues.map(String);
    const filteredA = groupA.filter((g) => !nextB.includes(g));
    setGroupB(nextB);
    setGroupA(filteredA);
  };

  if (groupOptions.length === 0) {
    return (
      <Card style={cardStyle}>
        <Empty description="No image groups available yet" />
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        width: "100%",
        opacity: viewOnly ? 0.55 : 1,
        pointerEvents: viewOnly ? "none" : "auto",
        transition: "opacity 0.2s ease",
      }}
    >
      <div style={sectionStyle}>
        <Card
          style={cardStyle}
          title={<Title level={5} style={{ margin: 0 }}>Preferred Group</Title>}
        >
          <Checkbox.Group
            value={groupA}
            onChange={handlePreferredChange}
            disabled={viewOnly}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupOptions.map((group) => (
                <Checkbox
                  key={group}
                  value={group}
                  disabled={viewOnly || groupB.includes(group)}
                >
                  <span
                    style={{
                      color: viewOnly
                        ? "#999"
                        : groupB.includes(group)
                        ? "#999"
                        : "inherit",
                    }}
                  >
                    {group}
                  </span>
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">
              Selected: {groupA.length ? groupA.join(", ") : "None"}
            </Text>
          </div>
        </Card>
      </div>

      <div style={sectionStyle}>
        <Card
          style={cardStyle}
          title={<Title level={5} style={{ margin: 0 }}>Contrast Group</Title>}
        >
          <Checkbox.Group
            value={groupB}
            onChange={handleContrastChange}
            disabled={viewOnly}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupOptions.map((group) => (
                <Checkbox
                  key={group}
                  value={group}
                  disabled={viewOnly || groupA.includes(group)}
                >
                  <span
                    style={{
                      color: viewOnly
                        ? "#999"
                        : groupA.includes(group)
                        ? "#999"
                        : "inherit",
                    }}
                  >
                    {group}
                  </span>
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">
              Selected: {groupB.length ? groupB.join(", ") : "None"}
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
}