import React, { useState, useEffect, useRef } from 'react';
import { Typography, Button, Radio, ConfigProvider } from 'antd';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MuiButton from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';

// LoadData
import useLoadData from './DataProcess/loadData.jsx';

//selector
import SelectedFiltersBar from './Scoreboard/Settings/selectFiltersBar.jsx';
import TrainingSelect from './Scoreboard/Settings/trainingselect.jsx';
import ROISelect from './Scoreboard/Settings/roiselect.jsx';
import DatasetSelect from './Scoreboard/Settings/datasetselect.jsx';
import ModelTypeSelect from './Scoreboard/Settings/modeltypeselect.jsx';



import ChartSelect from './Scoreboard/Settings/chartselect.jsx';
import PageSelect from './Scoreboard/Settings/pageselect.jsx';
import QuestionSelect from './Scoreboard/Settings/questionselect.jsx';


//Heatmap
import HeatmapOverview from './Scoreboard/Visualizations/heatmapOverview.jsx';
import HeatmapDetail from './Scoreboard/Visualizations/heatmapDetail.jsx';

//Barchart
import BarChartDetail from './Scoreboard/Visualizations/barchartdetail.jsx';
import BarChartOverview from './Scoreboard/Visualizations/barchartoverview.jsx';

//advanced insights
import ScatterGapCeiling from './Scoreboard/Visualizations/scatterGapCeiling.jsx';
import ScatterMurtyVsNsd from './Scoreboard/Visualizations/scatterMurtyVsNsd.jsx';

//model / region /dataset card
import ModelCardScoreboard from './Scoreboard/Settings/modelcardScoreboard.jsx';
import DatasetCard from './Scoreboard/Settings/datasetcard.jsx';
import ROICard from './Scoreboard/Settings/roicard.jsx';



// constants
import {
  DATASET_OPTIONS,
  DATASET_OPTIONS_LESS,
  MURTY185_DATASET,
  NSD_DATASET,
  MODEL_OPTIONS,
} from './constants-scoreboard.jsx';




const { Title } = Typography;

const muiTheme = createTheme({
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
});

const ScoreboardPageQuantitative: React.FC = () => {
  const [training, setTraining] = useState('NSD');
  const [region, setRegion] = useState<string[]>(['Across Regions']);
  const [dataset, setDataset] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [chartType, setChartType] = useState('uni');
  const [rank, setRank] = useState('');
 

  // interaction variable for overview and details
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const detailScrollRef = useRef<HTMLDivElement>(null);

  
  const [overviewWidth, setOverviewWidth] = useState(0);

  const [modelType, setModelType] = useState<string[]>([]);

  // const [pageView, setPageView] = useState('rank');
  const initialView = (() => {
    const v = new URLSearchParams(window.location.search).get("view");
    return v === "2" ? "2" : "rank";
  })();
  const [pageView, setPageView] = useState(initialView);

  const isDatasetDetailMode = pageView === 'rank' && dataset.length > 0 && !region.includes('Across Regions');
  const [activeQuestion, setActiveQuestion] = useState('q1');


  const isVS = pageView === '2' && activeQuestion === 'q1';
  const isDatasetROI = pageView === '2' && activeQuestion === 'q2';
  console.log("Parent - pageView:", pageView, "activeQuestion:", activeQuestion, "isVS:", isVS);
  console.log("Parent - pageView:", pageView, "activeQuestion:", activeQuestion, "isDasetROI:", isDatasetROI);

  useEffect(() => {
  console.log("=== Current Filter Selection ===");
  console.log("Training Source:", training);
  console.log("Selected Regions (ROI):", region);
  console.log("Selected Datasets:", dataset);
  console.log("Active Question:", activeQuestion);
  console.log("Page View:", pageView);
  console.log("===============================");
  // Expose current scoreboard state so the chatbot widget can read it
  (window as any).cortexScoreboardState = {
    training,
    region,
    dataset,
    selectedModel,
    chartType,
    pageView,
    activeQuestion,
  };
}, [training, region, dataset, activeQuestion, pageView, selectedModel, chartType]);

  const [expandedStates, setExpandedStates] = useState({
    training: false,
    region: false,
    dataset: false,
    modelType: false,
  });

  const datasetLabelMap: Record<string, string> = {
    murty185: "Murty185",
    nsd_1000: "NSD1000",
    bold_5000: "BOLD5000v2",
    bonner_2021: "Bonner2021",
    bmd_2024: "BMD2024",
    kingbaker_2019: "King2019",
    wardle_2020: "Wardle2020",
    nsd_syn: "NSD synthetic",
    global_score: "Global Score",
  };

   const datasetLabelMapShort: Record<string, string> = {
    murty185: "Murty",
    nsd_1000: "NSD",
    bold_5000: "BOLD",
    bonner_2021: "Bonner",
    bmd_2024: "BMD",
    kingbaker_2019: "King",
    wardle_2020: "Wardle",
    nsd_syn: "NSD Syn",
  };

  const allowedModelValues = React.useMemo(() => {
    if (!Array.isArray(modelType) || modelType.length === 0) return null;

    return new Set(
      MODEL_OPTIONS
        .filter((m: any) => modelType.includes(m.type))
        .map((m: any) => m.value)
    );
  }, [modelType]);

  const filterDataByModelType = React.useCallback(
    (dataSource: Record<string, any> | undefined) => {
      if (!dataSource || !allowedModelValues) return dataSource;

      const filtered: Record<string, any> = {};

      Object.keys(dataSource).forEach((roiKey) => {
        filtered[roiKey] = {};

        Object.keys(dataSource[roiKey] || {}).forEach((modelKey) => {
          if (modelKey === 'ceiling' || allowedModelValues.has(modelKey)) {
            filtered[roiKey][modelKey] = dataSource[roiKey][modelKey];
          }
        });
      });

      return filtered;
    },
    [allowedModelValues]
  );

  





  const handleTogglePanel = (panelName: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedStates(prev => ({
      ...prev,
      [panelName]: isExpanded
    }));
  };

  const handleTagClick = (type:string) => {
  setExpandedStates(prev => ({
      ...prev,
      [type]: true
    }));
  };

  useEffect(() => {
  if (isVS) {
    setTraining('Murty185 VS NSD1000');
  }
  else if (isDatasetROI) {
    setTraining("")
  } else {

    if (training === 'Murty185 VS NSD1000' || training === "") {
      setTraining('NSD');
    }
  }
}, [isVS, isDatasetROI]);


  const [overviewNode, setOverviewNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!overviewNode) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      setOverviewWidth(entries[0].contentRect.width);
    });

    resizeObserver.observe(overviewNode);
    return () => resizeObserver.disconnect();
  }, [overviewNode]);


  // pageview logic
  useEffect(() => {
    if (pageView === 'rank') {
      // 1. rank (Scoreboard)
      setTraining('NSD');
    }
    else if (isVS) {
      // 2.  2 (Comparison)
      // force to comparison
      setTraining('Murty185 VS NSD1000');
    }
    else if (isDatasetROI) {
      // 3.

      setTraining('');
    }
  }, [pageView]);

  useEffect(() => {
    if (!selectedModel || !allowedModelValues) return;

    if (!allowedModelValues.has(selectedModel)) {
      setSelectedModel(null);
    }
  }, [allowedModelValues, selectedModel]);




  type newData = {
    //group by ppa
    murty_uni?: Record<string, any>;
    nsd_uni?: Record<string, any>;
    murty_multi?: Record<string, any>;
    nsd_multi?: Record<string, any>;

    //
    ceiling_uni?: Record<string, any>;
    ceiling_multi?: Record<string, any>;


    roi_dataset_Murty185_uni?: Record<string, any>;
    roi_dataset_Murty185_multi?: Record<string, any>;
    roi_dataset_NSD_uni?: Record<string, any>;
    roi_dataset_NSD_multi?: Record<string, any>;
  };

    const { data: newData, loading: loadingNew } = useLoadData() as {
      data: newData;
      loading: boolean;
    };


    const murtyData = chartType === "uni" ? newData?.murty_uni : newData?.murty_multi;
    const nsdData   = chartType === "uni" ? newData?.nsd_uni   : newData?.nsd_multi;
    const ROI_DATASET_Murty = chartType === "uni" ? newData?.roi_dataset_Murty185_uni : newData?.roi_dataset_Murty185_multi;
    const ROI_DATASET_NSD = chartType === "uni" ? newData?.roi_dataset_NSD_uni : newData?.roi_dataset_NSD_multi;
    const Ceiling = chartType === "uni" ? newData?.ceiling_uni : newData?.ceiling_multi;
    const yLabel = chartType === "uni" ? "Pearson Correlation" : "Spearman Correlation";




  const hasFilters =
    (training && training !== '') ||
    (Array.isArray(dataset) && dataset.length > 0) ||
    (Array.isArray(region) && region.length > 0);

  const clearFilters = () => {
    if (isVS) {
      setTraining('Murty185 VS NSD1000');
      setRegion(['Across Regions']);
      setDataset([]);
    } else if(isDatasetROI) {
      setTraining('');
      setRegion(['Across Regions']);
      setDataset([]);
    } else {
      setTraining('NSD');
      setRegion(['Across Regions']);
      setDataset([]);

    }

  };

  const clearSingle = (key: string, value: string) => {
    if (key === 'training') setTraining('');
    if (key === 'dataset') setDataset((prev) => prev.filter((r) => r !== value));
    if (key === 'region') setRegion((prev) => prev.filter((r) => r !== value));
    if (key === 'modelType') setModelType((prev) => prev.filter((r) => r !== value));
  };

  const getDataByTraining = (training: string) => {
    let baseData: Record<string, any> | undefined;

    if (training === "NSD") {
      baseData = nsdData;
    } else if (training === "Murty185") {
      baseData = murtyData;
    } else {
      baseData = {};
    }

    return filterDataByModelType(baseData);
  };

const getOverviewColumnCount = (
  dataSource: any,
  roiValue: string | null,
  datasetValue: string | null
) => {
  if (!dataSource) return 0;

  // 固定 ROI，看不同 dataset
  if (roiValue && !datasetValue) {
    const roiKey = roiValue === "Across Regions" ? "Overall" : roiValue;
    if (!dataSource[roiKey]) return 0;

    const xLabels = new Set<string>();
    const rawModels = Object.keys(dataSource[roiKey]).filter((m) => m !== "ceiling");

    rawModels.forEach((model) => {
      Object.entries(dataSource[roiKey][model] || {}).forEach(
        ([x, vals]: [string, any]) => {
          if (vals) xLabels.add(x);
        }
      );
    });

    return xLabels.size;
  }

  // 固定 dataset，看不同 ROI
  if (datasetValue) {
    const xLabels = new Set<string>();

    Object.keys(dataSource)
      .filter((r) => r !== "overall" && r !== "Across Regions")
      .forEach((r) => {
        const modelNames = Object.keys(dataSource[r] || {}).filter((m) => m !== "ceiling");
        modelNames.forEach((model) => {
          const vals = dataSource[r][model]?.[datasetValue];
          if (vals) xLabels.add(r);
        });
      });

    return xLabels.size;
  }

  return 0;
};

  const hasData = Boolean(nsdData && murtyData);

  if (loadingNew) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e8e2ee', borderTopColor: '#8966a3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#666' }}>Loading scoreboard data…</span>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <span style={{ fontSize: 18, color: '#333' }}>Scoreboard data could not be loaded.</span>
        <span style={{ color: '#666' }}>Check the browser console (F12) for errors and ensure JSON data files exist under <code>/assets/data/new/</code>.</span>
      </div>
    );
  }

  return (
    <ConfigProvider theme={{ token: { fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" } }}>
    <ThemeProvider theme={muiTheme}>
    <div>
        <div
          style={{
            height: 'calc(100vh - var(--header-h, 0px))',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '2px 16px',
            boxSizing: 'border-box',
            background: 'var(--background-color, #f5f5f5)',
          }}
        >
          {/* 2. SelectedFiltersBar */}
          {/* flex: 0 0 auto  */}
          <div style={{ flex: '0 0 auto', marginBottom: 16 }}>
            <SelectedFiltersBar
              training={training}
                region={region}
                dataset={dataset}
                modelType={modelType}
                clearSingle={clearSingle}
                onTagClick={handleTagClick}
            />
          </div>

          {/* 3. body part（left: Filter + right: Charts） */}
          {/* flex: 1 fit all space */}


          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              // gridTemplateColumns: '1.5fr 7fr', // ratio for overview and detail
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 7fr)',
              gap: 16,
            }}
          >

            {/* --- left Filters --- */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',     // fill height
                overflowY: 'auto',  //
                paddingRight: 4,    //
                scrollbarWidth: 'thin',
              }}
            >
              {/* view toggle: Leaderboard / Advanced Insights */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '11px', color: '#888', marginLeft: 2, marginBottom: 4, fontFamily: "'Inter', system-ui, sans-serif" }}>VIEW</div>
                <ButtonGroup size="small" fullWidth variant="outlined">
                  {[{ value: 'rank', label: 'Leaderboard' }, { value: '2', label: 'Advanced Insights' }].map((opt) => (
                    <MuiButton
                      key={opt.value}
                      onClick={() => setPageView(opt.value)}
                      variant={pageView === opt.value ? 'contained' : 'outlined'}
                      sx={{
                        fontSize: '12px',
                        padding: '4px 2px',
                        textTransform: 'none',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        borderColor: 'var(--tungsten)',
                        color: pageView === opt.value ? 'white' : 'var(--tungsten)',
                        backgroundColor: pageView === opt.value ? 'var(--tungsten)' : 'transparent',
                        '&:hover': { borderColor: 'var(--tungsten)', backgroundColor: pageView === opt.value ? 'var(--tungsten)' : 'rgba(66,66,66,0.06)' },
                      }}
                    >
                      {opt.label}
                    </MuiButton>
                  ))}
                </ButtonGroup>
              </div>

              {/* ChartSelect button group*/}
              <div
                style={{
                  flex: '0 0 auto',
                  background: '#f5f5f5',
                  borderRadius: 8,
                  padding: '4px',
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom:12
                }}
              >
                <ChartSelect
                  chartType={chartType}
                  setChartType={setChartType}
                  rank={rank}
                  setRank={setRank}
                  enable={true}
                />
              </div>

              {/* reset filters */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button
                  type="text"
                  disabled={!hasFilters}
                  onClick={clearFilters}
                  size="small"
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: hasFilters ? 'var(--tungsten)' : '#bbb',
                    border: `1px solid ${hasFilters ? 'var(--tungsten)' : '#ddd'}`,
                    borderRadius: 6,
                    height: 'auto',
                    lineHeight: '18px',
                  }}
                >
                  Reset filters
                </Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TrainingSelect
                  training={training}
                  setTraining={setTraining}
                  dataset={dataset}
                  vsOption = {isVS}
                  expanded={expandedStates.training} //read property
                  onToggle={handleTogglePanel('training')}
                />

                <ROISelect
                  region={region}
                  setRegion={setRegion}
                  dataset={dataset}
                  setDataset={setDataset}
                  allowToggle={true}
                  mode={1}
                  training={training}
                  expanded={expandedStates.region} // read property
                  onToggle={handleTogglePanel('region')}
                  isVS = {isVS}
                />

                <DatasetSelect
                  dataset={dataset}
                  setDataset={setDataset}
                  training={training}
                  region={region}
                  allowToggle={true}
                  mode={1}
                  expanded={expandedStates.dataset}
                  onToggle={handleTogglePanel('dataset')}
                />

                <ModelTypeSelect
                  modelType={modelType}
                  setModelType={setModelType}
                  allowToggle={true}
                  mode={1}
                  expanded={expandedStates.modelType}
                  onToggle={handleTogglePanel('modelType')}
                />


              </div>
            </div>

            {/* --- right（ChartSelect + overview + details） --- */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%', // fill height
                gap: 16,
                minHeight: 0, //
                minWidth: 0,
              }}

            >
              {pageView === '2' && (
                <QuestionSelect
                  value={activeQuestion}
                  onChange={(val: string) => setActiveQuestion(val)}
                />
              )}

              {/* view toggle */}
              {/* <div style={{ flex: '0 0 auto' }}>
                <PageSelect value={pageView} onChange={(val: string) => setPageView(val)} />
              </div> */}

              {/* chart: horizontal*/}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: (isDatasetDetailMode || pageView === '2') ? 'flex' : 'grid',
                flexDirection: 'column',
                gridTemplateColumns: '1fr 6fr',
                gap: 16
              }}
            >

            {/* --- Overview Section --- */}
            {pageView !== '2' && (
              <div
                style={{
                  background: 'var(--background-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  gap: 12,

                  // 关键：不要再固定 25%
                  height: 'auto',
                  flex: isDatasetDetailMode ? '0 1 auto' : 1,
                  flexShrink: 0,

                  // 动态范围
                  minHeight: isDatasetDetailMode ? 140 : 0,
                  maxHeight: isDatasetDetailMode ? '45%' : '100%',

                  // 超过最大高度再滚
                  overflowY: isDatasetDetailMode ? 'auto' : 'hidden',
                  overflowX: 'hidden',
                }}
              >

                {/* 分支 1：BarChart 模式 (详情模式保持不变) */}
                {isDatasetDetailMode && dataset.map((dsName) => (
                  region.map((roiValue) => (
                    <div key={`${dsName}-${roiValue}`} style={{ flex: 1, minHeight: '80px', background: 'var(--background-color)', padding: '6px', borderRadius: 6, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>
                        {roiValue === 'Across Regions' ? 'Across Regions' : roiValue} ({dsName})
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <BarChartOverview
                          data={getDataByTraining(training)}
                          roi={roiValue === 'Across Regions' ? 'Overall' : roiValue}
                          dataset={dsName}
                          ceiling={Ceiling}
                          rank={rank}
                          onModelClick={setSelectedModel}
                          selectedModel={selectedModel}
                        />
                      </div>
                    </div>
                  ))

                ))
                
                }

                {/* 统一分支 2 和 3：Heatmap 模式 */}
                {(!isDatasetDetailMode) && (() => {
                  const overviewItems = (dataset.length === 0 ? region : dataset).map((item) => {
                    const isBranch2 = dataset.length === 0;

                    const subtitle = isBranch2
                      ? (item === 'Across Regions' ? 'Across Regions' : item)
                      : (datasetLabelMapShort[item] || item);

                    const currentRoi = isBranch2
                      ? (item === 'Across Regions' ? 'Overall' : item)
                      : "Across Regions";

                    const currentDataset = isBranch2 ? null : item;

                    const colCount = getOverviewColumnCount(
                      getDataByTraining(training),
                      currentRoi,
                      currentDataset
                    );

                    return {
                      key: item,
                      subtitle,
                      currentRoi,
                      currentDataset,
                      colCount,
                    };
                  });

                  const panelGap = 5;
                  const totalGap = panelGap * Math.max(overviewItems.length - 1, 0);
                  const usableWidth = Math.max(0, overviewWidth - totalGap);
                  const totalCols = overviewItems.reduce((sum, item) => sum + item.colCount, 0);

                  const sharedColWidth =
                  totalCols > 0 && usableWidth > 0
                    ? Math.max(6, usableWidth / totalCols)
                    : 20;

                  return (
                    <div
                      ref={setOverviewNode}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        flex: 1,
                        gap: panelGap,
                        height: '100%',
                        minHeight: 0,
                        overflowX: 'hidden',
                        alignItems: 'stretch',
                      }}
                    >
                      {overviewItems.map(({ key, subtitle, currentRoi, currentDataset, colCount }) => (
                        <div
                          key={key}
                          style={{
                            flex: '0 0 auto',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            width: `${colCount * sharedColWidth}px`,
                          }}
                        >
                          <div
                            style={{
                              textAlign: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              color: '#888',
                              marginBottom: 4,
                            }}
                          >
                            {subtitle}
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minHeight: 0,
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            <HeatmapOverview
                              data={getDataByTraining(training)}
                              roi={currentRoi}
                              dataset={currentDataset}
                              rank={rank}
                              selectedModel={selectedModel}
                              onModelClick={setSelectedModel}
                              visibleRange={visibleRange}
                              sharedColWidth={sharedColWidth}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}


                {/* chart 2: Detail */}

                <div
                  style={{
                    background: 'var(--background-color)',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,

                    overflow: 'hidden',
                    flex: (isDatasetDetailMode || pageView === '2') ? 1 : 'none',
                    overflowY: 'auto',
                  }}
                >
                <h3
                    style={{
                      flex: '0 0 auto',
                      marginBottom: 8,
                      textAlign: 'center',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      lineHeight: 1.5,
                    }}
                  >
                    {(() => {
                      const trainingLabel = training === 'NSD' ? 'NSD1000' : 'Murty185';
                      const regionLabel = region
                        .map((r: string) => r === 'Across Regions' ? 'Across Regions' : r.toUpperCase())
                        .join(' / ');
                      const datasetLabel = dataset.length > 0
                        ? dataset.map((d: string) => datasetLabelMap[d] || d).join(' · ')
                        : null;

                      if (training === 'Murty185 VS NSD1000') {
                        return <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Murty185 vs NSD1000 Performance Comparison</span>;
                      }
                      if (isDatasetROI) {
                        return <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Model Performance Gap to Ceiling (Trained on {trainingLabel})</span>;
                      }
                      return (
                        <>
                          <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#333' }}>
                            {regionLabel} Performance
                          </span>
                          <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#999', marginTop: 2 }}>
                            Trained on {trainingLabel}{datasetLabel ? ` · Evaluated on ${datasetLabel}` : ''}
                          </span>
                        </>
                      );
                    })()}
                  </h3>

                

                  {/* content */}
                  <div
                    ref={detailScrollRef}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: isDatasetDetailMode ? "auto" : "hidden",
                      overflowX: isDatasetDetailMode ? "hidden" : "auto",
                      position: 'relative',
                      display: 'flex',
                      flexDirection: (isDatasetDetailMode || pageView === '2') ? 'column' : 'row',
                      justifyContent: training === 'Murty185 VS NSD1000' ? 'center' : 'flex-start',
                      gap: isDatasetDetailMode ? 0 : 24,
                      paddingBottom: 10

                    }}
                  >
                    {/* scatter plot */}
                    {(training === 'Murty185 VS NSD1000') &&  activeQuestion === "q1" && (
                      <ScatterMurtyVsNsd
                        murtyData={filterDataByModelType(murtyData)}
                        nsdData={filterDataByModelType(nsdData)}
                        murtyDataFull = {murtyData}
                        nsdDataFull = {nsdData}
                        roi={region[0] === 'Across Regions' ? 'Overall' : region[0]}
                        dataset={dataset} // dataset list filter
                        chartType={chartType}
                        showOverlay={false}
                        onModelClick={(m: string) => setSelectedModel(m)}
                      />
                    )}

                    {activeQuestion === "q2" && (
                      <ScatterGapCeiling
                        nsdData={ROI_DATASET_NSD}
                        murtyData={ROI_DATASET_Murty}
                        ceilingData={Ceiling}
                        roi={region}
                        dataset={dataset}
                        training={training}
                      />
                    )}



                  {isDatasetDetailMode && dataset.map((dsName) => (
                          <React.Fragment key={dsName}>
                            {region.map((roiValue) => (
                              <div
                                key={`${dsName}-${roiValue}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  width: '100%',
                                  position: 'relative'
                                }}
                              >
                                {/* ✨ 纵向吸顶标题 */}
                                <div style={{
                                  position: 'sticky',
                                  top: 0,           // 向下滚动时固定在顶部
                                  zIndex: 10,
                                  background: 'var(--background-color)',
                                  padding: '10px 0',
                                  borderBottom: '1px solid #c4b4cc',
                                  marginBottom: 15,
                                  fontWeight: 600,
                                  color: '#6b4a8c',
                                  fontSize: '13px',
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase'
                                }}>
                                  {dsName} —— {roiValue === 'Across Regions' ? 'Overall' : roiValue}
                                </div>

                                {/* 柱状图组件 */}
                                <div style={{ width: '100%', overflowX: 'auto' }}>
                                  <BarChartDetail
                                    data={getDataByTraining(training)}
                                    roi={roiValue === 'Across Regions' ? 'Overall' : roiValue}
                                    dataset={dsName}
                                    ceiling={Ceiling}
                                    rank={rank}
                                    yLabel={yLabel}
                                    selectedModel={selectedModel}
                                    onModelClick={(m: string | null) => setSelectedModel(m)}
                                  />
                                </div>
                              </div>
                            ))}
                          </React.Fragment>
                        ))}

                    {/* heapmap for a fixed region comparing datasets */}
                    {pageView === "rank" &&  training !== 'Murty185 VS NSD1000' &&  dataset.length === 0 && region.map((roiValue, index) => (
                    <div
                      key={roiValue}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: index === 0 ? 450 : 350,
                        flexShrink: 0
                      }}
                    >
                      <HeatmapDetail
                        data={getDataByTraining(training)}
                        roi={roiValue === 'Across Regions' ? 'Overall' : roiValue}
                        dataset={dataset[0] || ''}
                        rank={rank}
                        selectedModel={selectedModel}
                        onModelClick={(m: string) => setSelectedModel(m)}
                        onScrollUpdate={(range: {start: number, end: number}) => setVisibleRange(range)}
                        showYAxis={true}
                        isMultiRegion={region.length > 1}
                        defaultScrollToRight={region.length === 1}
                        showLegend={index === region.length - 1}
                      />
                    </div>
                  ))}


                  {/* heapmap for a fixed dataset comparing regions */}
                  {pageView === "rank" && training !== 'Murty185 VS NSD1000' && dataset.length > 0 && region.includes('Across Regions') && (
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 20, overflowX: 'auto', paddingBottom: 10 }}>
                      {dataset.map((datasetValue, index) => (
                        <div
                          key={datasetValue}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            // bigger for first one as show for label
                            minWidth: index === 0 ? 450 : 350,
                            flexShrink: 0
                          }}
                        >
                          {/* subtitle */}
                          <div style={{
                            textAlign: 'center',
                            fontWeight: 'bold',
                            marginBottom: 12,
                            fontSize: '13px',
                            color: '#555',
                            textTransform: 'uppercase',
                            background: 'var(--background-color)',
                            padding: '4px 0',
                            borderRadius: '4px'
                          }}>
                            Dataset: {datasetLabelMap[datasetValue] || datasetValue}
                          </div>

                          <HeatmapDetail
                            data={getDataByTraining(training)}
                            roi="Across Regions"
                            dataset={datasetValue}
                            rank={rank}
                            selectedModel={selectedModel}
                            onModelClick={(m: string) => setSelectedModel(m)}
                            onScrollUpdate={(range: {start: number, end: number}) => setVisibleRange(range)}

                            showYAxis={index === 0}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                
                  </div>
                
                </div>
            </div>
            

            </div>
          </div>
        </div>

        {selectedModel  && (
            <ModelCardScoreboard  region={region} dataset={training} model={selectedModel} evalDataset={dataset}/>
        )
        }


        {Array.isArray(region) && region.length > 0 && (
          <>
            {region.map((item, index) => (
               ((item !== "Across Regions") && <ROICard key={item ?? index} region={item}/>)
            ))}
          </>
        )}

        {training === "Murty185" && (
            <DatasetCard dataset={"murty185"}/>
          )
        }
        {training === "NSD" && (
          <DatasetCard dataset={"nsd_1000"}/>
        )
        }

        {Array.isArray(dataset) && dataset.length > 0 && (
          <>
            {dataset.map((item, index) => (
             <DatasetCard key={item ?? index} dataset={item} />
            ))}
          </>
        )}





    </div>
    </ThemeProvider>
    </ConfigProvider>
  );
};
export default ScoreboardPageQuantitative;


