import React, { useState, useEffect } from 'react';
import { Typography, Button, Radio } from 'antd';

// LoadData
import useLoadData from './DataProcess/loadData.jsx';

//selector
import SelectedFiltersBar from './Scoreboard/Settings/selectFiltersBar.jsx';
import TrainingSelect from './Scoreboard/Settings/trainingselect.jsx';
import ROISelect from './Scoreboard/Settings/roiselect.jsx';
import DatasetSelect from './Scoreboard/Settings/datasetselect.jsx';


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


const { Title } = Typography;


const ScoreboardPageQuantitative: React.FC = () => {
  const [training, setTraining] = useState('NSD');
  const [region, setRegion] = useState(['Across Regions']);
  const [dataset, setDataset] = useState([]);

  const [chartType, setChartType] = useState('uni');
  const [rank, setRank] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // interaction variable for overview and details
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

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
  };

  const getDataByTraining = (training: string) => {
  if (training === "NSD") {
    return  nsdData;
  } else if (training === "Murty185") {
    return murtyData;
  } else {
    return {};
  }
};

  const hasData = Boolean(nsdData && murtyData);

  if (loadingNew) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e0e0e0', borderTopColor: '#1890ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Title level={4} style={{ margin: 0 }}>Filters</Title>
            <Button
              type="default"
              disabled={!hasFilters}
              onClick={clearFilters}
              size="small"
              style={{
                borderRadius: 6,
                fontWeight: 500,
                color: hasFilters ? 'var(--tungsten)' : '#aaa',
                borderColor: hasFilters ? 'var(--tungsten)' : '#ccc',
              }}
            >
              Default
            </Button>
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
          <div style={{ flex: '0 0 auto' }}>
            <PageSelect value={pageView} onChange={(val: string) => setPageView(val)} />
          </div>

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
          <div style={{
            background: 'transparent',
            // 如果是详情模式，占 25%，否则占满 100%
            height: isDatasetDetailMode  ? '25%' : '100%',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 0, // 👈 关键：允许容器在 grid 内部正确缩放
            gap: 12,
            overflowY: isDatasetDetailMode ? 'auto' : 'hidden', // rollable
            overflowX: isDatasetDetailMode ? 'hidden' : 'hidden',
            flexShrink: 0,

          }}>

            {/* 分支 1：BarChart 模式 (详情模式保持不变) */}
            {isDatasetDetailMode && dataset.map((dsName) => (
              region.map((roiValue) => (
                <div key={`${dsName}-${roiValue}`} style={{ flex: 1, minHeight: '80px', background: '#fafafa', padding: '6px', borderRadius: 6, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>
                    {roiValue === 'Across Regions' ? 'Overall' : roiValue} ({dsName})
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
            ))}

            {/* 统一分支 2 和 3：Heatmap 模式 */}
            {(!isDatasetDetailMode) && (
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                gap: 12,
                height: '100%',
                minHeight: 0,
                overflowX: 'auto',

              }}>

                {(dataset.length === 0 ? region : dataset).map((item) => {
                  // 统一标题和参数逻辑
                  const isBranch2 = dataset.length === 0;
                  const subtitle = isBranch2
                    ? (item === 'Across Regions' ? 'Overall' : item)
                    : (datasetLabelMap[item] || item);

                  const currentRoi = isBranch2
                    ? (item === 'Across Regions' ? 'Overall' : item)
                    : "Across Regions";

                  const currentDataset = isBranch2 ? null : item;

                  return (
                    <div
                      key={item}
                      style={{
                        flex: '1 0 60px',

                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        minWidth: '60px',
                      }}
                    >
                      {/* 标题 */}
                      <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#888', marginBottom: 4 }}>
                        {subtitle}
                      </div>

                      {/* 热图容器：增加 flex: 1 并强制 display: flex */}
                      <div style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column'

                      }}>
                        <HeatmapOverview
                          data={getDataByTraining(training)}
                          roi={currentRoi}
                          dataset={currentDataset}
                          rank={rank}
                          selectedModel={selectedModel}
                          onModelClick={setSelectedModel}
                          visibleRange={visibleRange}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


            {/* chart 2: Detail */}

            <div
              style={{
                background: '#fafafa',
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
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#333',
                  textAlign: 'center',
                }}
              >

                {isDatasetDetailMode
                  ? `Performance On Specific Dataset Trained on ${training === 'NSD' ? 'NSD1000' : 'Murty185'} `
                  : (training === 'Murty185 VS NSD1000'
                      ? 'Murty185 vs NSD1000 Performance Comparison'
                  : (isDatasetROI)
                      ? `Model Performance Gap to Ceiling vs Ceiling (Trained on ${training === 'NSD' ? 'NSD1000' : 'Murty185'})`
                  : (region.includes("Across Regions"))
                      ? `${region[0]?.toUpperCase()} Performance (Trained on ${training === 'NSD' ? 'NSD1000' : 'Murty185'})`


                  : `Performance  on Specific Region (Trained on ${training === 'NSD' ? 'NSD1000' : 'Murty185'})`)
                }
              </h3>

              {/* content */}
              <div
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
                    murtyData={murtyData}
                    nsdData={nsdData}
                    roi={region[0] === 'Across Regions' ? 'Overall' : region[0]}
                    dataset={dataset} // dataset list filter
                    chartType={chartType}
                    showOverlay={true}
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
                              background: '#fafafa',
                              padding: '10px 0',
                              borderBottom: '2px solid #1890ff',
                              marginBottom: 15,
                              fontWeight: 'bold',
                              color: '#1890ff',
                              fontSize: '14px',
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
                  {/* subtilte*/}
                  <div style={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    marginBottom: 12,
                    fontSize: '14px',
                    color: '#555',
                    textTransform: 'uppercase',
                    background: '#b7afafff',
                    padding: '4px 0',
                    borderRadius: '4px'
                  }}>
                    {roiValue === 'Across Regions' ? 'Across Regions' : roiValue}
                  </div>

                  <HeatmapDetail
                    data={getDataByTraining(training)}
                    roi={roiValue === 'Across Regions' ? 'Overall' : roiValue}
                    dataset={dataset[0] || ''}
                    rank={rank}
                    selectedModel={selectedModel}
                    onModelClick={(m: string) => setSelectedModel(m)}
                    onScrollUpdate={(range: {start: number, end: number}) => setVisibleRange(range)}
                    showYAxis={index === 0}
                    isMultiRegion={region.length > 1}
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
                        background: '#b7afafff',
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
  );
};
export default ScoreboardPageQuantitative;


