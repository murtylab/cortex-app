import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button, message, Steps, theme } from 'antd';
import { Images } from 'lucide-react';
import { uploadImages } from './services/imageUploader-WholeBrain.js';
import { SERVER_URL_Whole_Brain } from './services/config.js';
import { ConfigProvider } from 'antd'; 
import JSZip from "jszip";

//main component
import LinearIndeterminate from './Lab/linearprogessor.jsx';
import Uploader from './Lab/uploader.tsx';
import RegionSelector from './Lab/regionselector.jsx';
import WholeBrainSelector from './Lab/wholebrainselector.jsx';
import Settings from './Lab/settings.jsx';
import TValueSelector from './Lab/tvalueselector.jsx';
import ContrastGroupSelector from './Lab/contrastgroupselector.js';
import ModelCard from './Lab/modelcard.jsx';

// visualization graphics
import BarChart from './Lab/barchart.jsx';
import Heatmap from './Lab/heatmap.jsx';
import ImagePreviewGroupedDnD from './Lab/imagePreviewGrid.tsx';
import WholeBrainHtmlViewer from './Lab/wholebrain.jsx';


type PreviewFile = {
  uid: string;       
  blobURL: string;
  file: FileWithPath;
  label: string;     
  groupKey: string;  
  serverKey?: string; 
};



type FileWithPath = File & { webkitRelativePath?: string };

type VoxelsData = Record<
  string, // imageName
  Record<
    string, // subject
    Record<
      string, // regionName
      number[] // voxelArray
    >
  >
>;

const normalizePath = (p: string) =>
  (p || "").replaceAll("\\", "/").replace(/\/+/g, "/");

const buildOrgName = (f: FileWithPath) => {
  const rel = normalizePath(f.webkitRelativePath || f.name);
  const meta = `${f.size}-${f.lastModified}`;
  const safeRel = rel.replaceAll("/", "__");
  return `${safeRel}__${meta}`;
};

const buildGroupKey = (f: FileWithPath, depth = 1) => {
  const rel = normalizePath(f.webkitRelativePath || "");
  if (!rel) return "Ungrouped";
  const parts = rel.split("/").filter(Boolean);
  if (parts.length <= depth + 1) return parts[0] || "Ungrouped";
  return parts[depth] || parts[0] || "Ungrouped";
};

const getExt = (name: string) => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
};

const safe = (s: string) =>
  s.replaceAll("\\", "/").replaceAll("/", "__").replaceAll(" ", "_");

const { Step } = Steps;
const SERVER_BASE_URL = SERVER_URL_Whole_Brain;

const useBarchartData = (predictionResult: any) => {
  console.log("📊 Prediction Result for Bar Chart:", predictionResult);

  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) {
      console.log("❌ predictionResult is invalid or empty:", predictionResult);
      return [];
    }

    const data = predictionResult[0]; // Access the first (and only) object in the array

    if (!data.mean || !data.sem) {
      console.log("❌ predictionResult is missing required fields:", data);
      return [];
    }
    const processedData = Object.keys(data.mean).map((filename) => ({
      filename,
      mean: +data.mean[filename], // Convert to number
      sem: +data.sem[filename],   // Convert to number
    }));

    console.log("✅ Final Processed Bar Chart Data:", processedData);

    return processedData;
  }, [predictionResult]);
};

const useHeatmapData = (predictionResult: any) => {
  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) {
      console.log("❌ predictionResult is invalid or empty:", predictionResult);
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }
    const data = predictionResult[0];

    if (!data.rdm || !Array.isArray(data.rdm)) {
      console.log("❌ RDM data is missing or invalid:", data);
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }
    const rdm = data.rdm as number[][];
    const n = rdm.length;
    // Extract filenames from the mean or sem object
    const originalFilenames = Object.keys(data.mean || data.sem || {});

    // Create heatmap data with filenames
    const heatmapData = rdm.flatMap((row, i) =>
      row.map((value, j) => ({
        x: originalFilenames[i],
        y: originalFilenames[j],
        value
      }))
    );

    // For now, we'll use the original order for sortedFilenames
    // You can implement custom sorting logic here if needed
    const sortedFilenames = [...originalFilenames];

    console.log("✅ Processed Heatmap Data:", {
      heatmapData: heatmapData.slice(0, 5), // Log first 5 elements
      originalFilenames,
      sortedFilenames
    });

    return { heatmapData, originalFilenames, sortedFilenames };
  }, [predictionResult]);
};

const WholeBrain: React.FC = () => {
  const { token } = theme.useToken();
  const [current, setCurrent] = useState(0);
  const [predictstep, setPredictstep] = useState(0);

  const DEFAULT_REGION = "ffa";
  const DEFAULT_MODEL = "clip_rn50";
  const DEFAULT_DATASET = "nsd_1000";
  const DEFAULT_VOXEL = "subject1";
  const DEFAULT_WHOLEBRAIN = "wholebrain";

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [dataset, setDataset] = useState(DEFAULT_DATASET);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [voxelOption, setVoxelOption] = useState(DEFAULT_VOXEL);
  const [wholeBrain, setWholeBrain] = useState(DEFAULT_WHOLEBRAIN);
  const [voxelNumber, setVoxelNumber] = useState("");
  const [paper, setPaper] = useState("");
  const [participantName, setParticipantName] = useState("");

  const [tValueMin, setTValueMin] = useState(0);
  const [tValueMax, setTValueMax] = useState(10.0);
  const [tValue, setTValue] = useState(1.96);
  const [tValueChangeable, setTValueChangeable] = useState(false);



  const [uploaderKey, setUploaderKey] = useState(0);


  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [fileMappings, setFileMappings] = useState<PreviewFile[]>([]);
  const [loading, setLoading] = useState(false);

  const [backendState, setBackendState] = useState<any>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [statusText, setStatusText] = useState("");
  const [wholebrainHtml, setWholebrainHtml] = useState("");
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

 
  const [rawNpyFile, setRawNpyFile] = useState<string | null>(null);
  const [contrastHtmlFile, setContrastHtmlFile] = useState<string | null>(null);
  const [contrastCsvFile, setContrastCsvFile] = useState<string | null>(null);

  const [groupA, setGroupA] = useState<string[]>([]);
  const [groupB, setGroupB] = useState<string[]>([]);

  const [nImages, setNImages] = useState(10);

  const next = () => setCurrent((prev) => prev + 1);
  const prev = () => setCurrent((prev) => prev - 1);

  const onChange = (value: number) => {
    console.log("Step changed:", value);
    setCurrent(value);
  };

type FileWithPath = File & { webkitRelativePath?: string };

 
const addIncomingFiles = (newFiles: File[]) => {
  if (!newFiles?.length) return;

  setFiles((prev) => {
    const existing = new Set(prev.map((x) => x.uid));

    const nextAdd: PreviewFile[] = newFiles
      .filter((f) => f.type?.startsWith("image/"))
      .map((f) => {
        const ff = f as FileWithPath;
        const uid = buildOrgName(ff); 
        const label = ff.webkitRelativePath || ff.name;
        const groupKey = buildGroupKey(ff, 1);
        return {
          uid,
          label,
          groupKey,
          file: ff,
          blobURL: URL.createObjectURL(ff),
        };
      })
      .filter((x) => !existing.has(x.uid));

    const next = [...prev, ...nextAdd];
    setFileMappings(next);
    return next;
  });
};

// 
const removeOne = (uid: string) => {
  setFiles((prev) => {
    const target = prev.find((x) => x.uid === uid);
    if (target) {
      try { URL.revokeObjectURL(target.blobURL); } catch {}
    }

    const next = prev.filter((x) => x.uid !== uid);

    setFileMappings(next);

    if (next.length === 0) {
      setUploaderKey((k) => k + 1); 
    }
    return next;
  });
};

// 
const clearGroup = (uidsToRemove: string[]) => {
  const removeSet = new Set(uidsToRemove);

  setFiles((prev) => {
    prev.forEach((x) => {
      if (removeSet.has(x.uid)) {
        try { URL.revokeObjectURL(x.blobURL); } catch {}
      }
    });

    const next = prev.filter((x) => !removeSet.has(x.uid));

    setFileMappings(next);

    if (next.length === 0) {
      setUploaderKey((k) => k + 1); 
    }

    return next;
  });
};


const clearAll = () => {
  setFiles((prev) => {
    prev.forEach((x) => {
      try { URL.revokeObjectURL(x.blobURL); } catch {}
    });
    return [];
  });

  setFileMappings([]);
  setUploaderKey((k) => k + 1); 
};

const moveItemToGroup = (uid: string, toGroupKey: string) => {
  setFiles(prev => prev.map(f => (f.uid === uid ? { ...f, groupKey: toGroupKey } : f)));
  setFileMappings(prev => prev.map(f => (f.uid === uid ? { ...f, groupKey: toGroupKey } : f)));
};

const renameGroupKey = (oldKey: string, newKey: string) => {
  setFiles(prev => prev.map(f => (f.groupKey === oldKey ? { ...f, groupKey: newKey } : f)));
  setFileMappings(prev => prev.map(f => (f.groupKey === oldKey ? { ...f, groupKey: newKey } : f)));
};

const buildMetadata = () => {
  return files.map((f) => ({
    uid: f.uid,
    label: f.label,
    groupKey: f.groupKey,
  }));
};


  useEffect(() => {
    if (predictstep === 1 && current === 0) {
      next(); // inference 完成 → step1
    }

    if (predictstep === 2 && current === 1) {
      next(); // contrast 完成 → step2
    }
  }, [predictstep]);



  useEffect(() => {
    console.log("🔄 backendState changed=", backendState);
  }, [backendState]);


const runInference = async () => {
  console.log("SERVER_URL =", SERVER_URL_Whole_Brain);
  console.log("run_inference url =", `${SERVER_BASE_URL}/api/run_inference`);

  if (files.length === 0) {
    message.error("No files uploaded. Please upload files first.");
    return;
  }

  setPredictionLoading(true);

  try {
    console.log("🟡 original files =", files);

    const uploadFiles = files.map((x) => {
      const ext = getExt(x.file.name);
      const newName = `${safe(x.uid)}${ext}`;
      return new File([x.file], newName, { type: x.file.type });
    });

    console.log("🟡 uploadFiles =", uploadFiles);
    console.log("🟡 uploadFiles names =", uploadFiles.map((f) => f.name));

    const paths: string[] = await uploadImages(uploadFiles);

    console.log("✅ upload returned paths =", paths);
    console.log("✅ isArray(paths) =", Array.isArray(paths));
    console.log("✅ paths length =", paths?.length);
    console.log("✅ first 3 paths =", paths?.slice?.(0, 3));

    const metadata = files.map((f) => ({
      uid: f.uid,
      label: f.label,
      groupKey: f.groupKey,
    }));

    console.log("🟡 metadata =", metadata);
    console.log("🟡 metadata length =", metadata.length);
    console.log("🟡 first 3 metadata =", metadata.slice(0, 3));
    console.log("metadata length =", metadata.length);
    console.log("paths length =", paths.length);

    const statePayload = {
      state_id: null,
      grouped: null,
      conditions: [],
      t_vals: null,
      p_vals: null,
      metadata_by_path: null,
    };

    const payload = {
      data: [
        paths,
        metadata,
        nImages,
        statePayload,
      ],
    };

    console.log("🚀 run_inference payload =", payload);
    console.log("🚀 payload JSON =", JSON.stringify(payload, null, 2));

    const result = await axios.post(
      `${SERVER_BASE_URL}/api/run_inference`,
      payload,
    );
    console.log("responseData JSON =", JSON.stringify(result.data, null, 2));

    console.log("✅ run_inference raw response =", result);
    console.log("✅ run_inference response.data =", result.data);
    console.log("✅ run_inference response.data.data =", result.data.data);
    console.log("✅ run_inference response.data.data[0] =", result.data.data[0]);


    // setPredictionResult(result.data.data ?? result.data);
    
    setBackendState(result.data.data[0]);
    setRawNpyFile(result.data.data[11].value.url)
    message.success("Inference complete!");
  } catch (e: any) {
    console.error("❌ run_inference error =", e);
    console.error("❌ error.response =", e?.response);
    console.error("❌ error.response?.status =", e?.response?.status);
    console.error("❌ error.response?.data =", e?.response?.data);
    console.error("❌ error.message =", e?.message);

    message.error("Inference failed. Check console logs.");
  } finally {
    setPredictionLoading(false);
    setLoading(false);
    setPredictstep(1);
  }
};

const computeContrast = async () => {
  console.log("SERVER_URL =", SERVER_URL_Whole_Brain);
  console.log("compute_group_contrast url =", `${SERVER_BASE_URL}/api/compute_group_contrast`);

  if (files.length === 0) {
    message.error("No files uploaded. Please upload files first.");
    return;
  }

  setPredictionLoading(true);

  try {
    console.log("🟡 original files =", files);
    console.log("🟡 groupA =", groupA);
    console.log("🟡 groupB =", groupB);

  
  

    const payload = {
      data: [
        groupA,
        groupB,
        backendState
      ],
    };

    console.log("🚀 compute_group_contrast payload =", payload);
    console.log("🚀 compute_group_contrast payload JSON =", JSON.stringify(payload, null, 2));

    const result = await axios.post(
      `${SERVER_BASE_URL}/api/compute_group_contrast`,
      payload,
    );
    console.log("responseData JSON =", JSON.stringify(result.data, null, 2));

    console.log("✅ compute_group_contrast raw response =", result);
    console.log("✅ compute_group_contrast response.data =", result.data);
    console.log("✅ compute_group_contrast response.data.data =", result.data.data);
    console.log("✅ compute_group_contrast response.data.data[0] =", result.data.data[0]);


    setPredictionResult(result.data.data ?? result.data);
    setBackendState(result.data.data[0]);
    setTValueMax(Number((result.data.data[3]?.maximum ?? 10).toFixed(2)));
    setWholebrainHtml(result.data.data[5]);
    setTValueChangeable(true);

    setContrastHtmlFile(result.data.data[6].value.url);
    setContrastCsvFile(result.data.data[7].value.url);

    
    message.success("Inference complete!");
  } catch (e: any) {
    console.error("❌ compute_group_contrast error =", e);
    console.error("❌ error.response =", e?.response);
    console.error("❌ error.response?.status =", e?.response?.status);
    console.error("❌ error.response?.data =", e?.response?.data);
    console.error("❌ error.message =", e?.message);

    message.error("Inference failed. Check console logs.");
  } finally {
    setPredictionLoading(false);
    setLoading(false);
    setPredictstep(2);
  }
};

const updateT = async () => {
  console.log("SERVER_URL =", SERVER_URL_Whole_Brain);
  console.log("update_t url =", `${SERVER_BASE_URL}/api/update_thresholding`);

  if (!backendState) {
    message.error("Missing backend state. Please run inference first.");
    return;
  }

  setPredictionLoading(true);

  try {
    const payload = {
      data: [
        false,
        tValue,
        backendState,
      ],
    };

    console.log("🚀 update_t payload =", payload);
    console.log("🚀 update_t payload JSON =", JSON.stringify(payload, null, 2));

    const result = await axios.post(
      `${SERVER_BASE_URL}/api/update_thresholding`,
      payload,
    );

    console.log("✅ update_t raw response =", result);
    console.log("✅ update_t response.data =", result.data);
    console.log("✅ update_t response.data.data =", result.data.data);

    const responseData = result.data.data ?? result.data;

    setBackendState(result.data.data[0]);
    setWholebrainHtml(responseData?.[3]);
    setContrastHtmlFile(responseData?.[4]?.value?.url);
    setContrastCsvFile(responseData?.[5]?.value?.url);

    message.success("T-threshold updated!");
  } catch (e: any) {
    console.error("❌ update_t error =", e);
    console.error("❌ error.response =", e?.response);
    console.error("❌ error.response?.status =", e?.response?.status);
    console.error("❌ error.response?.data =", e?.response?.data);
    console.error("❌ error.message =", e?.message);

    message.error("Failed to update t-threshold. Check console logs.");
  } finally {
    setPredictionLoading(false);
  }
};

  

  const contentStyle: React.CSSProperties = {
    textAlign: 'center',
    color: token.colorTextTertiary,
    backgroundColor: 'transparent',
    borderRadius: 0,
    border: 'none',
    marginTop: 16,
    padding: 0,
  };

  //support csv download
const downloadData = async () => {
  const files = [
    { url: rawNpyFile, name: "raw_data.npy" },
    { url: contrastHtmlFile, name: "whole_brain_result.html" },
    { url: contrastCsvFile, name: "contrast_result.csv" },
  ].filter((f) => f.url);

  if (files.length === 0) {
    message.error("No files available to download.");
    return;
  }

  try {
   

    const zip = new JSZip();

    for (const file of files) {
      const res = await fetch(file.url as string);
      if (!res.ok) throw new Error(`Failed to fetch ${file.name}`);

      const blob = await res.blob();
      zip.file(file.name, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;

    const timestamp = new Date().toISOString().replace(/[:\-T.]/g, "");
    a.download = `murtylab_results_${timestamp}.zip`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    message.success("ZIP downloaded!");
  } catch (e) {
    console.error("zip download error", e);
    message.error("Failed to create ZIP.");
  } finally {
  
  }
};

  const getGroupKey = (file: File) => {
          const rel = file?.webkitRelativePath || "";
          if (!rel) return "Ungrouped";
          const parts = rel.split("/").filter(Boolean);
          // groupDepth=1: inputFolder / subfolder / filename  -> subfolder
          return parts[1] || "Ungrouped";
        };
  
  const steps = [
    {
      title: 'Upload Stimuli',
      // content: <Uploader onFilesUploaded={handleFilesUploaded} onFileMappingsUpdate={handleFileMappingsUpdate} />,
          content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Uploader  key={uploaderKey} onAddFiles={(newFiles) => addIncomingFiles(newFiles)} />

          

          <ImagePreviewGroupedDnD
            files={files}
            title="Uploaded Images Preview"
            groupDepth={1}
            onMoveItemToGroup={moveItemToGroup}
            onRenameGroupKey={renameGroupKey}
            onRemove={(uid: string) => removeOne(uid)}
            onClear={() => clearAll()}
            onClearGroup={(groupKey, uids) => clearGroup(uids)}
            onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
            viewOnly={false}
            
          />

          <div style={{ textAlign: 'right', color: 'black', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            <Images size={15} strokeWidth={1.5} aria-hidden="true" />
            <span style={{ fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)" }}>{files.length}</span> images uploaded
          </div>

           <Settings
            model={model}
            setModel={setModel}
            dataset={dataset}
            setDataset={setDataset}
            voxelOption={voxelOption}
            setVoxelOption={setVoxelOption}
            voxelNumber={voxelNumber}
            setVoxelNumber={setVoxelNumber}
            participantName={participantName}
            setParticipantName={setParticipantName}
          />
           {predictionLoading && <LinearIndeterminate />}
        </div>
      ),
    },
    {
      title: 'Training Settings',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px'}}>
          {/* <RegionSelector region={region} setRegion={setRegion} dataset={dataset}/> */}
          <WholeBrainSelector wholeBrain={wholeBrain} setWholeBrain={setWholeBrain} />
      
         
             <ImagePreviewGroupedDnD
              files={files}
              title="Uploaded Images Preview"
              groupDepth={1}
              onMoveItemToGroup={moveItemToGroup}
              onRenameGroupKey={renameGroupKey}
              onRemove={(uid: string) => removeOne(uid)}
              onClear={() => clearAll()}
              onClearGroup={(groupKey, uids) => clearGroup(uids)}
              onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
              viewOnly={true}
            />
            <ContrastGroupSelector
              files={files}
              groupA={groupA}
              setGroupA={setGroupA}
              groupB={groupB}
              setGroupB={setGroupB}
            />
            {/* <TValueSelector
              label="T-value Threshold"
              min={tValueMin}
              max={tValueMax}
              value={tValue}
              onChange={setTValue}
              changeable={tValueChangeable}
          /> */}
          {predictionLoading && <LinearIndeterminate />}
        </div>
      ),
    },
    {
      title: 'Prediction Results',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column'}}>
          {/* <RegionSelector region={region} setRegion={setRegion} dataset={dataset} />
          <ModelCard
            region={region}
            dataset={dataset}
            model={model}
          /> */}
            <ImagePreviewGroupedDnD
              files={files}
              title="Uploaded Images Preview"
              groupDepth={1}
              onMoveItemToGroup={moveItemToGroup}
              onRenameGroupKey={renameGroupKey}
              onRemove={(uid: string) => removeOne(uid)}
              onClear={() => clearAll()}
              onClearGroup={(groupKey, uids) => clearGroup(uids)}
              onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
              viewOnly={true}
            />
             <ContrastGroupSelector
              files={files}
              groupA={groupA}
              setGroupA={setGroupA}
              groupB={groupB}
              setGroupB={setGroupB}
              viewOnly={true}
            />

        <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                width: "100%",
                marginTop: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <TValueSelector
                  label="T-value Threshold"
                  min={tValueMin}
                  max={tValueMax}
                  value={tValue}
                  onChange={setTValue}
                  changeable={true}
                />
              </div>

             <Button
                type="primary"
                onClick={updateT}
                disabled={!tValueChangeable || predictionLoading}
              >
                {predictionLoading ? "Updating..." : "Update T Threshold"}
              </Button>
            </div>

            <WholeBrainHtmlViewer
              html={wholebrainHtml}
              loading={predictionLoading}
            />

        </div>
      ),
    },
  ];

 return (
  <>
    <ConfigProvider
      theme={{
        components: {
          Steps: {
            colorPrimary: "var(--tungsten)", // Customize the primary color for Steps
          },
          Button: {
            colorPrimary: "var(--tungsten)",                 // 正常状态
            colorPrimaryHover: "var(--highlight-color-button)", // hover
            colorPrimaryActive: "var(--highlight-color-button)", // 点击时
          },
           Progress: {
            colorPrimary: "var(--highlight-color-button)",
          },
        },
      }}
    >
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--hairline-color, rgba(60,55,48,0.14))",
        }}
      >
        {steps.map((item, idx) => {
          const active = idx === current;
          const done = idx < current;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onChange(idx)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--accent-color, #5b3a6e)"
                  : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                textAlign: "left",
                color: active
                  ? "var(--accent-strong, #4a2e5c)"
                  : done
                  ? "var(--text-main, #3d3832)"
                  : "rgba(61,56,50,0.42)",
                transition: "color 0.2s ease, border-color 0.2s ease",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 500 }}>
                {item.title}
              </span>
            </button>
          );
        })}
      </div>

      <div style={contentStyle}>{steps[current].content}</div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        {current === 0 && (
          <Button
            type="primary"
            onClick={() => {
              runInference();
            }}
            disabled={loading || files.length === 0}
          >
            {loading ? "Running Inference..." : "Run Inference"}
          </Button>
        )}

        {current === 1 && (
          <Button
            type="primary"
            onClick={() => {
              computeContrast();
            }}
            disabled={
              predictionLoading ||
              files.length === 0 ||
              groupA.length === 0 ||
              groupB.length === 0
            }
          >
            {predictionLoading ? "Processing..." : "Compute Contrasts"}
          </Button>
        )}

        {current === steps.length - 1 && (
          <Button type="primary" onClick={downloadData} disabled={!predictionResult}>
            Download Data
          </Button>
        )}
      </div>
    </ConfigProvider>
  </>
);
};

export default WholeBrain;
