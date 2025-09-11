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

  const handleFilesUploaded = (uploadedFiles: { blobURL: string; file: File | null }[]) => {
    setFiles(uploadedFiles);
    setPredictionResult(null);
    setPredictstep(1);
  };

  const handleFileMappingsUpdate = (newFileMappings: { blobURL: string; file: File | null }[]) => {
    setFileMappings(newFileMappings);
  };

  // 🔹 用 JSON 文件代替真实 prediction
 const handlePrediction = async () => {
  if (files.length === 0) {
    message.error("No files uploaded. Please upload files first.");
    return;
  }

  setPredictionLoading(true);

  try {
    const jsonPath = getDemoJsonFile(model, dataset, region);
    const raw = await d3.json(jsonPath);

    // ✅ 如果是数组，就取第一个对象
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

    // mean / sem
    Object.entries(data.mean).forEach(([k, v]) => {
      if (selectedNames.includes(k)) {
        filtered.mean[k] = v;
      }
    });
    Object.entries(data.sem).forEach(([k, v]) => {
      if (selectedNames.includes(k)) {
        filtered.sem[k] = v;
      }
    });

    // rdm （需要重新筛选行列）
    const indices = Object.keys(data.mean)
      .map((k, i) => (selectedNames.includes(k) ? i : -1))
      .filter(i => i !== -1);

    filtered.rdm = indices.map(i => indices.map(j => data.rdm[i][j]));

    // voxels
    Object.entries(data.voxels).forEach(([k, v]) => {
      if (selectedNames.includes(k)) {
        filtered.voxels[k] = v;
      }
    });

    setPredictionResult([filtered]);
    message.success("Demo prediction loaded from JSON!");
  } catch (err) {
    console.error("❌ Error loading demo JSON:", err);
    message.error("Failed to load demo data.");
  }

  setPredictionLoading(false);
  setLoading(false);
  setPredictstep(2);
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
          <h3><b>Univariate Analysis:</b> Predicted voxel average responses</h3>
          <BarChart barChartData={barchartData} height={600} fileMappings={fileMappings}/>
          <h3><b>Multivariate Analysis:</b> Representational dissimilarity matrix (RDM)</h3>
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
      </div>
    </>
  );
};

export default Stepper;
