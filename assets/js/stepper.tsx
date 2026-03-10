import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button, message, Steps, theme } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import { uploadImages } from './services/imageUploader.js';
import { SERVER_URL } from './services/config';
import { ConfigProvider } from 'antd'; 

//main component
import LinearIndeterminate from './Lab/linearprogessor.jsx';
import Uploader from './Lab/uploader.tsx';
import RegionSelector from './Lab/regionselector.jsx';
import Settings from './Lab/settings.jsx';
import ModelCard from './Lab/modelcard.jsx';

// visualization graphics
import BarChart from './Lab/barchart.jsx';
import Heatmap from './Lab/heatmap.jsx';
import ImagePreviewGroupedDnD from './Lab/imagePreviewGrid.tsx';

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
const SERVER_BASE_URL = SERVER_URL;

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

const Stepper: React.FC = () => {
  const { token } = theme.useToken();
  const [current, setCurrent] = useState(0);
  const [predictstep, setPredictstep] = useState(1);

  const DEFAULT_REGION = "ffa";
  const DEFAULT_MODEL = "clip_rn50";
  const DEFAULT_DATASET = "nsd_1000";
  const DEFAULT_VOXEL = "all-participants";

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [dataset, setDataset] = useState(DEFAULT_DATASET);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [voxelOption, setVoxelOption] = useState(DEFAULT_VOXEL);
  const [voxelNumber, setVoxelNumber] = useState("");
  const [paper, setPaper] = useState("");
  const [participantName, setParticipantName] = useState("");

  const [uploaderKey, setUploaderKey] = useState(0);


  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [fileMappings, setFileMappings] = useState<PreviewFile[]>([]);

  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictionFFAResult, setPredictionFFAResult] = useState<any>(null);
  const [predictionEBAResult, setPredictionEBAResult] = useState<any>(null);
  const [predictionPPAResult, setPredictionPPAResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false); // new state


  //visualization
  const [vizOrder, setVizOrder] = useState("group");

  const next = () => setCurrent((prev) => prev + 1);
  const prev = () => setCurrent((prev) => prev - 1);

  const onChange = (value: number) => {
    console.log("Step changed:", value);
    setCurrent(value);
  };

type FileWithPath = File & { webkitRelativePath?: string };

const clearRegionPredictionCache = () => {
  setPredictionFFAResult(null);
  setPredictionEBAResult(null);
  setPredictionPPAResult(null);
};

 
const addIncomingFiles = (newFiles: File[]) => {
  if (!newFiles?.length) return;

  setFiles((prev) => {
    const existing = new Set(prev.map((x) => x.uid));

    const nextAdd: PreviewFile[] = newFiles
      .filter((f) => f.type?.startsWith("image/"))
      .map((f) => {
        const ff = f as FileWithPath;
        const uid = buildOrgName(ff); 
        const label =   ff.webkitRelativePath?.split("/").pop() || ff.name;
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
    setPredictionResult(null);
    clearRegionPredictionCache();
    setPredictstep(1);
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
    setPredictionResult(null);
    clearRegionPredictionCache();
    setPredictstep(1);

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
    setPredictionResult(null);
    clearRegionPredictionCache();
    setPredictstep(1);

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
  setPredictionResult(null);
  clearRegionPredictionCache();
  setPredictstep(1);
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



  useEffect(() => {
    setPredictionResult(null); // Clear previous results
    setPredictstep(1); // Reset button
  }, [ model, dataset, voxelOption, voxelNumber, paper, participantName]);

  useEffect(() => {
    if (current !== 2) return;

    const cached = getCachedResultByRegion(region);
    console.log("region switched to:", region);
    console.log("cached result found:", cached);
    if (cached) return;

    setPredictionResult(null);
    setPredictstep(1);
    handlePrediction();
  }, [region, current, predictionFFAResult, predictionEBAResult, predictionPPAResult]);

  useEffect(() => {
    console.log("🔄 predictionResult updated:", predictionResult);
    if (predictionResult && current === 1) {
      setTimeout(() => {
        next(); // Automatically go to the next step
      }, 100); // 100ms delay
    }
  }, [predictionResult]);

  useEffect(() => {
    console.log("😊FFA cache updated:", predictionFFAResult);
  }, [predictionFFAResult]);

  useEffect(() => {
    console.log("😊EBA cache updated:", predictionEBAResult);
  }, [predictionEBAResult]);

  useEffect(() => {
    console.log("😊PPA cache updated:", predictionPPAResult);
  }, [predictionPPAResult]);

  // useEffect(() => {
  //   if (predictionResult == null) {
  //     return;
  //   }

  //   if (region === "ffa") {
  //     setPredictionFFAResult(predictionResult);
  //   } else if (region === "eba") {
  //     setPredictionEBAResult(predictionResult);
  //   } else if (region === "ppa") {
  //     setPredictionPPAResult(predictionResult);
  //   }
  // }, [predictionResult, region]);

  const getCachedResultByRegion = (targetRegion: string) => {
    if (targetRegion === "ffa") return predictionFFAResult;
    if (targetRegion === "eba") return predictionEBAResult;
    if (targetRegion === "ppa") return predictionPPAResult;
    return null;
  };

  const currentRegionPredictionResult = useMemo(() => {
    return getCachedResultByRegion(region) ?? predictionResult;
  }, [region, predictionFFAResult, predictionEBAResult, predictionPPAResult, predictionResult]);

  useEffect(() => {
    const ffaCached = !!predictionFFAResult;
    const ebaCached = !!predictionEBAResult;
    const ppaCached = !!predictionPPAResult;

    const selectedCache = getCachedResultByRegion(region);
    const usingCache = selectedCache === currentRegionPredictionResult && !!selectedCache;
    const usingLatestPrediction =
      predictionResult === currentRegionPredictionResult && !usingCache;

    let source = "none";
    if (usingCache) source = `${region} cache`;
    else if (usingLatestPrediction) source = "predictionResult fallback";

    console.log("========== REGION DEBUG ==========");
    console.log("current region:", region);
    console.log("FFA cache exists:", ffaCached, predictionFFAResult);
    console.log("EBA cache exists:", ebaCached, predictionEBAResult);
    console.log("PPA cache exists:", ppaCached, predictionPPAResult);
    console.log("selected cache for current region:", selectedCache);
    console.log("predictionResult:", predictionResult);
    console.log("currentRegionPredictionResult:", currentRegionPredictionResult);
    console.log("currentRegionPredictionResult source:", source);
    console.log("==================================");
  }, [
    region,
    predictionResult,
    predictionFFAResult,
    predictionEBAResult,
    predictionPPAResult,
    currentRegionPredictionResult,
  ]);


  // ✅ Ensure only the actual file is sent to Gradio
  const handlePrediction = async (targetRegion = region) => {
    console.log("📦 handlePrediction received files:");
    console.log(files);
    console.log("🎯 request target region:", targetRegion);

    if (files.length === 0) {
      message.error("No files uploaded. Please upload files first.");
      return;
    }

    setPredictionLoading(true);

    try {
      const uploadFiles = files.map((x) => {
        const ext = getExt(x.file.name);
        const newName = `${safe(x.uid)}${ext}`;
        return new File([x.file], newName, { type: x.file.type });
      });

      const serverKeys = uploadFiles.map((f) => f.name);

      setFiles((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));
      setFileMappings((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));

      const paths: string[] = await uploadImages(uploadFiles);

      const items = paths.map((path, i) => ({
        path,
        org_name: serverKeys[i],
      }));

      const result = await axios.post(`${SERVER_BASE_URL}/api/predict`, {
        data: [items, targetRegion, dataset, model, true, true, true],
      });

      const resultData = result.data.data;

      // 当前临时结果
      setPredictionResult(resultData);

      // 按请求发出时的 region 存 cache，不按当前界面的 region 存
      if (targetRegion === "ffa") {
        setPredictionFFAResult(resultData);
      } else if (targetRegion === "eba") {
        setPredictionEBAResult(resultData);
      } else if (targetRegion === "ppa") {
        setPredictionPPAResult(resultData);
      }

      console.log("✅ saved result into cache for:", targetRegion);
      message.success("Prediction complete!");
    } catch (e) {
      console.error(e);
      message.error("Prediction failed. Check server connection.");
    } finally {
      setPredictionLoading(false);
      setLoading(false);
      setPredictstep(2);
    }
  };

  const barchartData = useBarchartData(currentRegionPredictionResult);




  const { heatmapData, originalFilenames, sortedFilenames } = useHeatmapData(currentRegionPredictionResult);

  const orderedFilenames = useMemo(() => {
  if (!barchartData || barchartData.length === 0) return [];

  const fileMap = new Map();
  (fileMappings || []).forEach((f) => {
    if (f.serverKey) fileMap.set(f.serverKey, f);
    if (f.uid) fileMap.set(f.uid, f);
    if (f.file?.name) fileMap.set(f.file.name, f);
  });

  const getGroupForFilename = (filename: string) => {
    const m = fileMap.get(filename);
    return m?.groupKey || "Ungrouped";
  };

  const getDisplayLabel = (filename: string) => {
    const m = fileMap.get(filename);
    return m?.label || filename;
  };

  if (vizOrder === "ranking") {
    return [...barchartData]
      .sort((a, b) => b.mean - a.mean)
      .map((d) => d.filename);
  }

  if (vizOrder === "group") {
    return [...barchartData]
      .sort((a, b) => {
        const groupA = getGroupForFilename(a.filename);
        const groupB = getGroupForFilename(b.filename);

        if (groupA === groupB) {
          const labelA = getDisplayLabel(a.filename);
          const labelB = getDisplayLabel(b.filename);
          return labelA.localeCompare(labelB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }

        return groupA.localeCompare(groupB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      })
      .map((d) => d.filename);
  }

  return barchartData.map((d) => d.filename);
}, [barchartData, fileMappings, vizOrder]);

  console.log("Extract Heatmap Data from predictionResult:", heatmapData);

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
  const downloadData = () => {
    if (currentRegionPredictionResult) {
     const voxelsData = currentRegionPredictionResult?.[0]?.voxels as VoxelsData | undefined;

    if (!voxelsData) {
      message.error("No voxels data available to download.");
      return;
    }
  
      if (voxelsData && typeof voxelsData === "object") {
        const csvRows = [];
  
        // Step 1: Collect all headers dynamically
        const headers = new Set<string>();
        const imageRows = [];
  
        for (const [imageName, subjects] of Object.entries(voxelsData) as [string, VoxelsData[string]][]) {
        const row: Record<string, number | string> = { image: imageName };

        for (const [subject, regions] of Object.entries(subjects) as [string, VoxelsData[string][string]][]) {
          for (const [_, voxelArray] of Object.entries(regions) as [string, number[]][]) {
            voxelArray.forEach((val: number, i: number) => {
              const key = `${subject}_${i}`;
              row[key] = val;
              headers.add(key);
            });
          }
        }

        imageRows.push(row);
      }
  
        const orderedHeaders: string[] = ["image", ...Array.from(headers)];
        csvRows.push(orderedHeaders.join(","));
  
        // Step 2: Write rows based on headers
        imageRows.forEach(row => {
          const values = orderedHeaders.map(h => row[h] ?? "");
          csvRows.push(values.join(","));
        });
  
        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
  
        const timestamp = new Date().toISOString().replace(/[:\-T.]/g, "");
        const filename = `murtylab_${model}_${dataset}_${region}_${timestamp}.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success("Voxels data downloaded as CSV!");
      } else {
        message.error("No voxels data available to download.");
      }
    } else {
      message.error("No prediction result available to download.");
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
            title="Uploaded Images"
            groupDepth={1}
            onMoveItemToGroup={moveItemToGroup}
            onRenameGroupKey={renameGroupKey}
            onRemove={(uid: string) => removeOne(uid)}
            onClear={() => clearAll()}
            onClearGroup={(groupKey, uids) => clearGroup(uids)}
            onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
          />

          <div style={{ textAlign: 'right', color: 'black', fontWeight: 500 }}>
            📸 {files.length} images uploaded
          </div>
        </div>
      ),
    },
    {
      title: 'Training Settings',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <RegionSelector region={region} setRegion={setRegion} dataset={dataset}/>
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
      title: 'Prediction Results',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column'}}>
          <RegionSelector region={region} setRegion={setRegion} dataset={dataset} />
          

          <ModelCard
            region={region}
            dataset={dataset}
            model={model}
          />

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
            foldable={true}
            viewOnly={true}
          />

          {predictionLoading && <LinearIndeterminate />} {/* add progress bar when predictionLoading is true */}
            <h3 style={{ textAlign: "left", color:"black", fontSize: "18px", marginBottom: "10px", marginTop: "40px"}}>
            <b>Univariate Analysis:</b> Predicted voxel average responses
            </h3>
          <BarChart barChartData={barchartData} height={600} fileMappings={fileMappings} order={vizOrder} setOrder={setVizOrder}/>
            <h3 style={{ textAlign: "left", color:"black", fontSize: "18px", marginBottom: "50px", marginTop: "40px"}}><b>Multivariate Analysis:</b> Respresentational dissimilarity matrix (RDM) from predicted voxel responses</h3>
          {/* <Heatmap heatmapData={heatmapData} originalFilenames={originalFilenames} sortedFilenames={sortedFilenames} width={800} height={800} fileMappings={fileMappings}/> */}
          {barchartData.length <= 1 ? (
            <div style={{ textAlign: 'center', fontSize: '16px', color: '#888', fontStyle: 'italic' }}>
              RDM unavailable for one image. Please upload more than 2 images to see the visualization.
            </div>
          ) : (
            <Heatmap heatmapData={heatmapData} originalFilenames={originalFilenames} sortedFilenames={orderedFilenames} width={800} height={800} fileMappings={fileMappings} order={vizOrder} 
            />
          )}
        </div>
      ),
      icon: <SmileOutlined />,
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
      <Steps current={current} onChange={onChange}>
        {steps.map((item) => (
          <Step key={item.title} title={item.title} icon={item.icon} />
        ))}
      </Steps>

      <div style={contentStyle}>{steps[current].content}</div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        {current === 0 && (
          <Button
            type="primary"
            onClick={() => {
              message.success("Image Upload complete!");
              next();
            }}
            disabled={loading || files.length === 0}
          >
            {loading ? "Uploading..." : "Proceed to Settings"}
          </Button>
        )}

        {current === 1 && (
          <Button
            type="primary"
            onClick={() => {
              predictstep === 1 ? handlePrediction(region) : next();
            }}
            disabled={loading || files.length === 0}
          >
            {loading ? "Processing..." : "Check Prediction Results"}
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

export default Stepper;
