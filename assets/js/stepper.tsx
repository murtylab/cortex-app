import React, { useState, useEffect, useMemo } from 'react';
import { Button, message, Steps, theme } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import * as d3 from "d3";

import Uploader from './uploader.tsx';
import BarChart from './barchart.jsx';
import Settings from './settings.jsx';
import Heatmap from './heatmap.jsx';
import RegionSelector from './regionselector.jsx';
import ModelCard from './modelcard.jsx';
import LinearIndeterminate from './linearprogessor.jsx';

const { Step } = Steps;

// 🔹 根据前缀找到对应 JSON 文件
function getDemoJsonFile(model: string, dataset: string, region: string) {
  const prefix = `murtylab_${model}_${dataset}_${region}`;
  // 直接拼路径，后端 demo 文件夹里只保留一个匹配文件即可
  return `/demo/${prefix}.json`;
}

// 🔹 BarChart 数据 hook
const useBarchartData = (predictionResult: any) => {
  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) return [];
    const data = predictionResult[0];
    if (!data.mean || !data.sem) return [];

    return Object.keys(data.mean).map((filename) => ({
      filename,
      mean: +data.mean[filename],
      sem: +data.sem[filename],
    }));
  }, [predictionResult]);
};

// 🔹 Heatmap 数据 hook
const useHeatmapData = (predictionResult: any) => {
  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) {
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }
    const data = predictionResult[0];
    if (!data.rdm || !Array.isArray(data.rdm)) {
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }

    const rdm = data.rdm;
    const originalFilenames = Object.keys(data.mean || {});
    const heatmapData = rdm.flatMap((row, i) =>
      row.map((value, j) => ({
        x: originalFilenames[i],
        y: originalFilenames[j],
        value
      }))
    );

    return { heatmapData, originalFilenames, sortedFilenames: [...originalFilenames] };
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

  const [files, setFiles] = useState<{ blobURL: string; file: File | null }[]>([]);
  const [fileMappings, setFileMappings] = useState<{ blobURL: string; file: File | null }[]>([]);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);

  const next = () => setCurrent((prev) => prev + 1);
  const onChange = (value: number) => setCurrent(value);

  // 🔹 监听 region 变化，在 Step3 自动重新跑预测
  useEffect(() => {
  if (current === 2 && files.length > 0 && !predictionLoading) {
    handlePrediction();
  }
}, [ region]); 


  const handleFilesUploaded = (uploadedFiles: { blobURL: string; file: File | null }[]) => {
    setFiles(uploadedFiles);
    setPredictionResult(null);
    setPredictstep(1);
  };

  const handleFileMappingsUpdate = (newFileMappings: { blobURL: string; file: File | null }[]) => {
    const withNames = newFileMappings.map(m => ({
      ...m,
      name: m.file ? m.file.name : m.blobURL.split("/").pop() // demo模式给个 name
    }));
    setFileMappings(withNames);
  };


  // 🔹 用 JSON 文件代替真实 prediction
const handlePrediction = async () => {
  if (files.length === 0) return;

  setPredictionLoading(true); // 动画立即开始

  try {
    const jsonPath = getDemoJsonFile(model, dataset, region);
    const raw = await d3.json(jsonPath);
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (!data || !data.mean || !data.sem) {
      throw new Error("Invalid demo JSON format: missing mean/sem");
    }

    // 只保留用户选择的图
    const selectedNames = files.map(f => f.blobURL.split("/").pop());
    const filtered = {
      mean: {},
      sem: {},
      rdm: [],
      voxels: {}
    };

    Object.entries(data.mean).forEach(([k, v]) => {
      if (selectedNames.includes(k)) filtered.mean[k] = v;
    });
    Object.entries(data.sem).forEach(([k, v]) => {
      if (selectedNames.includes(k)) filtered.sem[k] = v;
    });

    const indices = Object.keys(data.mean)
      .map((k, i) => (selectedNames.includes(k) ? i : -1))
      .filter(i => i !== -1);

    filtered.rdm = indices.map(i => indices.map(j => data.rdm[i][j]));

// ✅ 确保生成新引用
    const newFiltered = {
      mean: { ...filtered.mean },
      sem: { ...filtered.sem },
      rdm: filtered.rdm.map(row => [...row]),  // 深拷贝二维数组
      voxels: { ...filtered.voxels }
    };

    Object.entries(data.voxels).forEach(([k, v]) => {
      if (selectedNames.includes(k)) filtered.voxels[k] = v;
    });

    // ✅ 一个 setTimeout 统一控制
    setTimeout(() => {
      setPredictionResult([newFiltered]);   // 更新数据
      setPredictionLoading(false);       // 结束动画
      setLoading(false);
      setCurrent(2);                     // 跳 Step3
      message.success("Demo prediction loaded from JSON!");
    }, 1000);

  } catch (err) {
    console.error("❌ Error loading demo JSON:", err);
    message.error("Failed to load demo data.");
    setPredictionLoading(false);
  }
};



  const barchartData = useBarchartData(predictionResult);
  const { heatmapData, originalFilenames, sortedFilenames } = useHeatmapData(predictionResult);

  const contentStyle: React.CSSProperties = {
    lineHeight: '260px',
    textAlign: 'center',
    color: token.colorTextTertiary,
    backgroundColor: 'transparent',
    border: 'none',
    marginTop: 16,
  };

  // ✅ 下载 CSV 而不是 JSON，但按钮位置不变
const downloadData = () => {
  if (predictionResult) {
    const voxelsData = predictionResult[0]?.voxels;

    if (voxelsData && typeof voxelsData === "object") {
      const csvRows = [];

      // Step 1: 收集表头
      const headers = new Set();
      const imageRows = [];

      for (const [imageName, subjects] of Object.entries(voxelsData)) {
        const row: Record<string, any> = { image: imageName };

        for (const [subject, regions] of Object.entries(subjects as any)) {
          for (const [regionName, voxelArray] of Object.entries(regions as any)) {
            (voxelArray as number[]).forEach((val, i) => {
              const key = `${subject}_${regionName}_${i}`;
              row[key] = val;
              headers.add(key);
            });
          }
        }

        imageRows.push(row);
      }

      const orderedHeaders = ["image", ...Array.from(headers)];
      csvRows.push(orderedHeaders.join(","));

      // Step 2: 写入数据
      imageRows.forEach((row) => {
        const values = orderedHeaders.map((h) => row[h] ?? "");
        csvRows.push(values.join(","));
      });

      // Step 3: 生成 CSV Blob
      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // 保留之前的命名规则
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


  const steps = [
    {
      title: 'Upload Stimuli',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Uploader onFilesUploaded={handleFilesUploaded} onFileMappingsUpdate={handleFileMappingsUpdate} />
          <div style={{ textAlign: 'right', color: 'black', marginTop: '10px', fontWeight: 500 }}>
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
          <ModelCard region={region} dataset={dataset} model={model} />
          {predictionLoading && <LinearIndeterminate />}
          <h3 style={{ 
              textAlign: "left", 
              color:"black", 
              fontSize: "18px", 
              marginBottom: "50px", 
              marginTop: "40px"
            }}>
              <b>Univariate Analysis:</b> Predicted voxel average responses
            </h3>

          <BarChart barChartData={barchartData} height={600} fileMappings={fileMappings}/>
          <h3 style={{ 
            textAlign: "left", 
            color:"black", 
            fontSize: "18px", 
            marginBottom: "50px", 
            marginTop: "40px"
          }}>
            <b>Multivariate Analysis:</b> Respresentational dissimilarity matrix (RDM) from predicted voxel responses
          </h3>
          {barchartData.length <= 1 ? (
            <div style={{ textAlign: 'center', fontSize: '16px', color: '#888', fontStyle: 'italic' }}>
              RDM unavailable for one image. Please upload more than 2 images to see the visualization.
            </div>
          ) : (
            <Heatmap
              heatmapData={heatmapData}
              originalFilenames={originalFilenames}
              sortedFilenames={sortedFilenames}
              width={800}
              height={800}
              fileMappings={fileMappings}
            />
          )}
        </div>
      ),
      icon: <SmileOutlined />,
    },
  ];

  return (
    <>
      <Steps current={current} onChange={onChange}>
        {steps.map((item) => (
          <Step key={item.title} title={item.title} icon={item.icon} />
        ))}
      </Steps>
      <div style={contentStyle}>{steps[current].content}</div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        {current === 0 && (
          <Button type="primary" onClick={next} disabled={loading || files.length === 0}>
            Proceed to Settings
          </Button>
        )}
        {current === 1 && (
          <Button type="primary" onClick={() => predictstep === 1 ? handlePrediction() : next()} disabled={files.length === 0}>
            {loading ? "Processing..." : "Check Prediction Results"}
          </Button>
        )}

          {current === steps.length - 1 && (
          <Button
            type="primary"
            onClick={downloadData}
            disabled={!predictionResult} // Disable if no prediction result
          >
            Download Data
          </Button>
        )}
      </div>
    </>
  );
};

export default Stepper;
