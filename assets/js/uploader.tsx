import React, { useState } from "react";
import "../css/main.css";
import { InboxOutlined } from "@ant-design/icons";
import { Upload, Progress, message, Modal, Image } from "antd";

const { Dragger } = Upload;

interface UploaderProps {
  onFilesUploaded: (files: { blobURL: string; file: File | null }[]) => void;
  onFileMappingsUpdate: (fileMappings: { blobURL: string; file: File | null }[]) => void;
}

// 🔹 预存 demo 图片 (assets/img/demo 里 1-01.jpg ~ 1-10.jpg)
const DEMO_IMAGES = Array.from({ length: 10 }).map((_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return {
    id: i,
    name: `1-${num}.jpg`,
    url: `/assets/img/demo/1-${num}.jpg`,
  };
});

const Uploader: React.FC<UploaderProps> = ({ onFilesUploaded, onFileMappingsUpdate }) => {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);

  // 确认选择
  const handleOk = () => {
    const files = selected.map((id) => ({
      blobURL: DEMO_IMAGES[id].url,
      file: null, // ⚠️ 没有真实 file，只是假数据
    }));
    onFilesUploaded(files);
    onFileMappingsUpdate(files);
    setCompleted(true);
    setVisible(false);
    message.success("📂 Demo images selected!");
  };

  // 选择/取消图片
  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {/* 🔹 外观保留 antd Dragger 样式 */}
      <Dragger
        showUploadList={false}
        beforeUpload={() => false}
        customRequest={() => {}}  // 防止报错
        openFileDialogOnClick={false} // ✅ 禁用系统 file input
        style={{ background: "white", position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.preventDefault();
            setVisible(true); // ✅ 打开 fake 弹窗
          }}
        />
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag file to this area to upload</p>
        <p className="ant-upload-hint">
          (Demo mode: choose from preloaded images instead of local files)
        </p>
      </Dragger>

      {/* 🔹 fake 进度条 */}
      <Progress
        className="progress-bar"
        percent={completed ? 100 : 0}
        status={completed ? "success" : "active"}
        style={{ marginTop: 10 }}
        strokeColor="#1890ff"
      />

      {/* 🔹 fake 弹窗 */}
      <Modal
        open={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        okText="Confirm Selection"
        cancelText="Cancel"
        width={700}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {DEMO_IMAGES.map((img) => (
            <div
              key={img.id}
              style={{
                border: selected.includes(img.id) ? "3px solid #1677ff" : "1px solid #ccc",
                borderRadius: "6px",
                padding: "2px",
                cursor: "pointer",
              }}
              onClick={() => toggleSelect(img.id)}
            >
              <Image
                src={img.url}
                alt={img.name}
                width={100}
                height={100}
                style={{ objectFit: "cover" }}
                preview={false}
              />
              <div style={{ fontSize: "12px", textAlign: "center" }}>{img.name}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default Uploader;
