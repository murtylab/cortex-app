import React from "react";
import { Card, Empty, Typography } from "antd";

const { Title, Text } = Typography;

export default function WholeBrainHtmlViewer({
  html = "",
  title = "Whole Brain Result",
  loading = false,
}) {
  const hasHtml = typeof html === "string" && html.trim().length > 0;

  return (
    <Card
      style={{ borderRadius: 12, marginTop: 20 }}
      bodyStyle={{ padding: 16 }}
    >
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
        {title}
      </Title>

      {loading ? (
        <div
          style={{
            minHeight: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <Text type="secondary">Updating...</Text>
        </div>
      ) : hasHtml ? (
        <div
          style={{
            width: "100%",
            overflowX: "auto",
            background: "#fff",
            borderRadius: 8,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <Empty description="No whole brain result available yet" />
      )}
    </Card>
  );
}