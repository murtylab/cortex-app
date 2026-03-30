import React, { useState, useEffect, useRef } from 'react';
import { Typography, Button, Radio } from 'antd';

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

import murtyBubbleImg from '../img/qualitative/bubble_heatmap_rankedBoth_train-murty185.png';
import nsdBubbleImg from '../img/qualitative/bubble_heatmap_rankedBoth_train-nsd_1000.png';



// constants
import {
  DATASET_OPTIONS,
  DATASET_OPTIONS_LESS,
  MURTY185_DATASET,
  NSD_DATASET,
  MODEL_OPTIONS,
} from './constants-scoreboard.jsx';




const { Title } = Typography;


const ScoreboardPageQualitative: React.FC = () => {
  const [training, setTraining] = useState('NSD');
  const [region, setRegion] = useState<string[]>(['Across Regions']);
  const [dataset, setDataset] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [chartType, setChartType] = useState('uni');
  const [rank, setRank] = useState('');
 

  // interaction variable for overview and details
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  
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



  const qualitativeImage =
  training === 'Murty185'
    ? murtyBubbleImg
    : training === 'NSD'
    ? nsdBubbleImg
    : null;

    
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
            {/* --- right（Chart / Image Area） --- */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                minWidth: 0,
                background: 'var(--background-color)',
                borderRadius: 8,
                padding: 16,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 12,
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

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  borderRadius: 8,
                  background: '#fff',
                  padding: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                }}
              >
                {qualitativeImage ? (
                  <div
                    style={{
                      height: '100%',
                      width: '100%',
                      overflowY: 'auto',
                      overflowX: 'auto',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        minHeight: 'max-content',
                        minWidth: 'max-content',
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '8px 24px',
                      }}
                    >
                      <img
                        src={qualitativeImage}
                        alt={
                          training === 'Murty185'
                            ? 'Murty185 qualitative result'
                            : 'NSD qualitative result'
                        }
                        style={{
                          display: 'block',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          minWidth: '900px',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      color: '#888',
                      fontSize: 14,
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  >
                    Please select either Murty185 or NSD to view the qualitative figure.
                  </div>
                )}
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

  );
};
export default ScoreboardPageQualitative;


