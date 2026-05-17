import React, { useMemo, useRef, useCallback, useState } from "react";
import "../../css/main.css";
import { InboxOutlined, FolderOpenOutlined } from "@ant-design/icons";
import type { UploadProps, UploadFile } from "antd";
import { Upload, Progress, message, Typography } from "antd";

// --- WebKit directory drop type defs (TS) ---
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}
interface FileSystemFileEntry extends FileSystemEntry {
  file: (successCallback: (file: File) => void) => void;
}
interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}
interface FileSystemDirectoryReader {
  readEntries: (successCallback: (entries: FileSystemEntry[]) => void) => void;
}
type AnyEntry = FileSystemFileEntry | FileSystemDirectoryEntry;

const { Dragger } = Upload;
const { Text } = Typography;

interface UploaderProps {
  onAddFiles: (files: File[]) => void; // ✅ parent owns state
  fillHeight?: boolean;
}

async function traverseEntry(entry: AnyEntry): Promise<File[]> {
  if ("file" in entry) {
    const file: File = await new Promise((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );
    (file as any).webkitRelativePath = entry.fullPath.replace(/^\//, "");
    return [file];
  }

  if ("createReader" in entry) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: AnyEntry[] = await new Promise((resolve) => {
      const all: AnyEntry[] = [];
      const read = () =>
        dirReader.readEntries((batch: FileSystemEntry[]) => {
          const typed = batch as AnyEntry[];
          if (!typed.length) resolve(all);
          else {
            all.push(...typed);
            read();
          }
        });
      read();
    });

    const nested = await Promise.all(entries.map(traverseEntry));
    return nested.flat();
  }

  return [];
}

function fileKey(f: File) {
  const rel = (f as any).webkitRelativePath || "";
  return `${rel}::${f.name}::${f.size}::${f.lastModified}`;
}

const Uploader: React.FC<UploaderProps> = ({ onAddFiles, fillHeight = false }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const totalFiles = fileList.length;
  const progressPercent = totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0;

  const simulateUpload = (uploadFile: UploadFile) => {
    uploadFile.status = "uploading";
    setTimeout(() => {
      uploadFile.status = "done";
      setFileList((prev) => [...prev]);
      setCompletedCount((prev) => prev + 1);
    }, 250);
  };

  const addFiles = useCallback(
    (incoming: File[], sourceLabel?: string) => {
      if (!incoming?.length) return;

      const images = incoming.filter((f) => f.type?.startsWith("image/"));
      if (!images.length) {
        message.warning("No image files found.");
        return;
      }

   
      const uploads: UploadFile[] = images.map((file) => ({
        uid: fileKey(file),
        name: file.name,
        status: "uploading",
        originFileObj: file as any,
      }));

      setFileList((prev) => [...prev, ...uploads]);
      uploads.forEach(simulateUpload);

  
      onAddFiles(images);

      if (sourceLabel) message.success(`Added ${images.length} image(s) from ${sourceLabel}.`);
    },
    [onAddFiles]
  );

  const props: UploadProps = useMemo(
    () => ({
      name: "file",
      multiple: true,
      maxCount: 5000,
      directory: false,
      accept: "image/*",

      beforeUpload: (file) => {
        addFiles([file as File], "file picker");
        return false;
      },

      async onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();

        const items = Array.from(e.dataTransfer.items || []);
        const entries: AnyEntry[] = items
          .map((i: any) => i.webkitGetAsEntry?.())
          .filter(Boolean);

        if (!entries.length) {
          addFiles(Array.from(e.dataTransfer.files || []) as File[], "drop");
          return;
        }

        const nestedFiles = (await Promise.all(entries.map(traverseEntry))).flat();
        addFiles(nestedFiles, "dropped folder(s)");
      },

      onDragOver: (e: React.DragEvent<HTMLDivElement>) => e.preventDefault(),
      showUploadList: false,
    }),
    [addFiles]
  );

  const openFolderPicker = () => folderInputRef.current?.click();

  const onFolderChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []) as File[];
    addFiles(files, "folder picker");
    e.target.value = "";
  };

  return (
    <div
      className={fillHeight ? "lab-uploader-fill" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        ...(fillHeight ? { height: "100%", minHeight: 0 } : {}),
      }}
    >
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory="true"
        // @ts-ignore
        directory=""
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFolderChange}
      />

      <Dragger
        {...props}
        className={fillHeight ? "lab-uploader-dragger" : undefined}
        fileList={fileList}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or Drag files to upload</p>

        <div className="ant-upload-hint" style={{ lineHeight: 1.6 }}>
          <br />
          <Text type="secondary">
            Or{" "}
            <span
              className="gradient-link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openFolderPicker();
              }}
              role="button"
            >
              <FolderOpenOutlined className="highlight-icon" style={{ transform: "translateY(3px)" }} />
              <span className="gradient-text" style={{ transform: "translateY(3px)" }}>
                choose a whole folder here
              </span>
            </span>{" "}
            to upload everything inside.
          </Text>
          <br />
        </div>
      </Dragger>

      <Progress
        className="progress-bar"
        percent={progressPercent}
        status={progressPercent === 100 ? "success" : "active"}
        style={{ marginTop: fillHeight ? 8 : 0, flexShrink: 0 }}
        strokeColor="var(--highlight-color-button)"
      />
    </div>
  );
};

export default Uploader;