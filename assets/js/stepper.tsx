import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, message, Spin } from 'antd';
import { Images } from 'lucide-react';
import { getFroiUserErrorMessage, runFroiPrediction, wrapPredictionResult } from './services/froiPredict.js';
import { ConfigProvider } from 'antd';
import { ThemeProvider, createTheme } from '@mui/material/styles';

//main component
import LinearIndeterminate from './Lab/linearprogessor.jsx';
import Uploader from './Lab/uploader.tsx';
import RegionSelector from './Lab/regionselector.jsx';
import Settings from './Lab/settings.jsx';
import ModelCard from './Lab/modelcard.jsx';

// image preview and grouping
import ImagePreviewGroupedDnD from './Lab/imagePreviewGrid.tsx';
import PreloadDatasetPicker from './Lab/preloadDatasetPicker.jsx';



// visualization graphics
import BarChart from './Lab/barchart.jsx';
import Heatmap from './Lab/heatmap.jsx';

import BoxPlot from './Lab/boxplot.jsx';

import DatasetCardLab from './Lab/datasetcard-lab.jsx';
import LabRoiViewer from './Lab/labRoiViewer.jsx';
import RoiInfoCard from './Lab/roiInfoCard.jsx';
import {
  REGION_OPTIONS,
  MURTY185_INCLUDED_REGIONS,
  NSD_1000_INCLUDED_REGIONS,
  regionSupportsMurty185,
} from './constants';



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

const useBarchartData = (predictionResult: any) => {
  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) {
      return [];
    }

    const data = predictionResult[0];

    if (!data.mean || !data.sem) {
      return [];
    }
    const processedData = Object.keys(data.mean).map((filename) => ({
      filename,
      mean: +data.mean[filename],
      sem: +data.sem[filename],
    }));

    return processedData;
  }, [predictionResult]);
};

const useHeatmapData = (predictionResult: any) => {
  return useMemo(() => {
    if (!predictionResult || !Array.isArray(predictionResult) || predictionResult.length === 0) {
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }
    const data = predictionResult[0];

    if (!data.rdm || !Array.isArray(data.rdm)) {
      return { heatmapData: [], originalFilenames: [], sortedFilenames: [] };
    }
    const rdm = data.rdm as number[][];
    const originalFilenames = Object.keys(data.mean || data.sem || {});

    const heatmapData = rdm.flatMap((row, i) =>
      row.map((value, j) => ({
        x: originalFilenames[i],
        y: originalFilenames[j],
        value
      }))
    );

    const sortedFilenames = [...originalFilenames];

    return { heatmapData, originalFilenames, sortedFilenames };
  }, [predictionResult]);
};


const PRELOADED_IMAGE_MODULES = import.meta.glob(
  "/assets/preload/**/*.{png,jpg,jpeg,webp}",
  { import: "default" }
) as Record<string, () => Promise<string>>;

const PRELOADED_JSON_MODULES = import.meta.glob(
  "/assets/preload/**/*.json",
  { import: "default" }
) as Record<string, () => Promise<any>>;

const muiLabTheme = createTheme({
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 500,
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: 13,
    },
  },
});

const Stepper: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [predictstep, setPredictstep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);



  //default settings
  const DEFAULT_REGION = "ffa";
  const DEFAULT_MODEL = "clip_rn50";
  const DEFAULT_DATASET = "nsd_1000";
  const DEFAULT_VOXEL = "all-participants";

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [dataset, setDataset] = useState(DEFAULT_DATASET);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const selectRegion = (nextRegion: string) => {
    setRegion(nextRegion);
    if (!regionSupportsMurty185(nextRegion) && dataset !== "nsd_1000") {
      setDataset("nsd_1000");
    }
  };
  const [voxelOption, setVoxelOption] = useState(DEFAULT_VOXEL);
  const [voxelNumber, setVoxelNumber] = useState("");
  const [paper, setPaper] = useState("");
  const [participantName, setParticipantName] = useState("");

  const [uploaderKey, setUploaderKey] = useState(0);


  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [fileMappings, setFileMappings] = useState<PreviewFile[]>([]);

  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [insightRegionCache, setInsightRegionCache] = useState<Record<string, any>>({});


  // basic visulization and prediction states
  const [loading, setLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false); 

  // insight visulalization states
  const [showInsights, setShowInsights] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [selectedInsightRegions, setSelectedInsightRegions] = useState<string[]>([DEFAULT_REGION]);

  //visualization
  const [vizOrder, setVizOrder] = useState("group");
  const [resultsPreviewCollapsed, setResultsPreviewCollapsed] = useState(true);

  // prestore dataset
  const[prestoreDataset, setPrestoreDataset] = useState<string | null>(null);
  const [preloadLoading, setPreloadLoading] = useState(false);
  const [preloadLoadingKey, setPreloadLoadingKey] = useState<string | null>(null);
  const isPreloadMode = !!prestoreDataset;
  const inputMode = isPreloadMode ? "preload" : "upload";
  const tutorialOriginalUploadStateRef = useRef<{ files: PreviewFile[]; prestoreDataset: string | null } | null>(null);
  const tutorialRezaBaselineRef = useRef<PreviewFile[] | null>(null);
  const tutorialUploadDemoTimerRef = useRef<number | null>(null);
  const tutorialUploadDemoAnimationFrameRef = useRef<number | null>(null);
  const tutorialUploadDemoAnimationsRef = useRef<Animation[]>([]);
  const tutorialUploadDemoVisualCleanupRef = useRef<(() => void) | null>(null);
  const tutorialUploadDemoRequestRef = useRef(0);
  const tutorialOriginalResultsStateRef = useRef<{
    vizOrder: string;
    previewCollapsed: boolean;
    chatbotOpen: boolean;
    chatbotTransform: string;
  } | null>(null);
  const [tutorialCustomGroups, setTutorialCustomGroups] = useState<string[] | null>(null);
  const [tutorialHighlightedResultGroups, setTutorialHighlightedResultGroups] = useState<string[] | null>(null);
  const [tutorialUploadDemoMode, setTutorialUploadDemoMode] = useState<string | null>(null);

  const clonePreviewFiles = (items: PreviewFile[]) => items.map((item) => ({ ...item }));

  const clearUploadDemoTimer = () => {
    if (tutorialUploadDemoTimerRef.current !== null) {
      window.clearTimeout(tutorialUploadDemoTimerRef.current);
      tutorialUploadDemoTimerRef.current = null;
    }
  };

  const clearUploadDemoVisuals = () => {
    if (tutorialUploadDemoAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(tutorialUploadDemoAnimationFrameRef.current);
      tutorialUploadDemoAnimationFrameRef.current = null;
    }

    tutorialUploadDemoAnimationsRef.current.forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        // Ignore animations that are already finished.
      }
    });
    tutorialUploadDemoAnimationsRef.current = [];

    tutorialUploadDemoVisualCleanupRef.current?.();
    tutorialUploadDemoVisualCleanupRef.current = null;
  };

  const trackUploadDemoAnimation = (animation: Animation | null) => {
    if (!animation) {
      return null;
    }

    tutorialUploadDemoAnimationsRef.current.push(animation);
    animation.finished
      .catch(() => undefined)
      .finally(() => {
        tutorialUploadDemoAnimationsRef.current = tutorialUploadDemoAnimationsRef.current.filter(
          (entry) => entry !== animation
        );
      });

    return animation;
  };

  const syncUploadTutorialState = (
    nextFiles: PreviewFile[],
    datasetKey: string | null,
    nextTutorialGroups: string[] = [],
    nextDemoMode: string | null = null
  ) => {
    const clonedFiles = clonePreviewFiles(nextFiles);

    setFiles(clonedFiles);
    setFileMappings(clonePreviewFiles(clonedFiles));
    setPrestoreDataset(datasetKey);
    setPreloadLoading(false);
    setPreloadLoadingKey(null);
    setPredictionResult(null);
    clearRegionPredictionCache();
    setShowInsights(false);
    setPredictstep(1);
    setTutorialCustomGroups(nextTutorialGroups);
    setTutorialUploadDemoMode(nextDemoMode);
  };

  const captureOriginalUploadTutorialState = () => {
    if (tutorialOriginalUploadStateRef.current) {
      return;
    }

    tutorialOriginalUploadStateRef.current = {
      files: clonePreviewFiles(files),
      prestoreDataset,
    };
  };

  const restoreOriginalUploadTutorialState = () => {
    const originalState = tutorialOriginalUploadStateRef.current;
    if (!originalState) {
      syncUploadTutorialState([], null, []);
      return;
    }

    syncUploadTutorialState(originalState.files, originalState.prestoreDataset, []);
  };

  const resetUploadTutorialState = () => {
    tutorialUploadDemoRequestRef.current += 1;
    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    restoreOriginalUploadTutorialState();
    tutorialOriginalUploadStateRef.current = null;
    tutorialRezaBaselineRef.current = null;
    setTutorialCustomGroups(null);
    setTutorialUploadDemoMode(null);
  };

  const captureOriginalResultsTutorialState = () => {
    if (tutorialOriginalResultsStateRef.current) {
      return;
    }

    tutorialOriginalResultsStateRef.current = {
      vizOrder,
      previewCollapsed: resultsPreviewCollapsed,
      chatbotOpen: isChatbotOpen(),
      chatbotTransform: getChatbotElements().container?.style.transform || '',
    };
  };

  const restoreOriginalResultsTutorialState = () => {
    setTutorialHighlightedResultGroups(null);

    const originalState = tutorialOriginalResultsStateRef.current;
    if (!originalState) {
      return;
    }

    setVizOrder(originalState.vizOrder);
    setResultsPreviewCollapsed(originalState.previewCollapsed);
    setChatbotVisibility(originalState.chatbotOpen);
    setChatbotTransform(originalState.chatbotTransform);
  };

  const resetResultsTutorialState = () => {
    restoreOriginalResultsTutorialState();
    tutorialOriginalResultsStateRef.current = null;
  };

  const escapeTutorialSelectorValue = (value: string) => {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }

    return value.replace(/"/g, '\\"');
  };

  const getChatbotElements = () => {
    const container = document.getElementById('cortex-chatbot-container');
    const toggle = document.getElementById('cortex-chatbot-toggle');
    const input = document.getElementById('cortex-chatbot-input');

    return {
      container: container instanceof HTMLElement ? container : null,
      toggle: toggle instanceof HTMLElement ? toggle : null,
      input: input instanceof HTMLElement ? input : null,
    };
  };

  const getChatbotWidgetApi = () => {
    const api = (window as any).cortexChatbotWidget;
    if (!api || typeof api !== 'object') {
      return null;
    }

    return api;
  };

  const isChatbotOpen = () => {
    const api = getChatbotWidgetApi();
    if (api && typeof api.isOpen === 'function') {
      return !!api.isOpen();
    }

    const { container } = getChatbotElements();
    return !!container && window.getComputedStyle(container).display !== 'none';
  };

  const setChatbotTransform = (transformValue: string) => {
    const { container } = getChatbotElements();
    if (!container) {
      return false;
    }

    container.style.transform = transformValue || 'translate(0px, 0px)';
    return true;
  };

  const resetChatbotPosition = () => {
    const api = getChatbotWidgetApi();
    if (api && typeof api.resetPosition === 'function') {
      api.resetPosition();
      return true;
    }

    return setChatbotTransform('translate(0px, 0px)');
  };

  const setChatbotVisibility = (open: boolean, options: { resetPosition?: boolean } = {}) => {
    const api = getChatbotWidgetApi();
    if (api) {
      if (open && typeof api.open === 'function') {
        api.open({ resetPosition: Boolean(options.resetPosition) });
        return true;
      }

      if (!open && typeof api.close === 'function') {
        api.close();
        return true;
      }
    }

    const { container, toggle } = getChatbotElements();
    if (!container || !toggle) {
      return false;
    }

    if (open && options.resetPosition) {
      resetChatbotPosition();
    }

    container.style.display = open ? 'flex' : 'none';
    toggle.style.display = open ? 'none' : 'inline-flex';
    return true;
  };

  const startAnimatedResultsDemo = ({
    requestId,
    mode,
  }: {
    requestId: number;
    mode: string;
  }) => {
    clearUploadDemoTimer();
    clearUploadDemoVisuals();

    const runSequence = async () => {
      if (tutorialUploadDemoRequestRef.current !== requestId) {
        return;
      }

      setCurrent(2);
      setShowResults(true);
      setTutorialHighlightedResultGroups(null);

      if (mode === 'region') {
        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-region-active"]',
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.2)',
        });
        return;
      }

      if (mode === 'model-card') {
        const cardAnimated = await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-model-card"]',
          requestId,
          accentColor: 'rgba(176, 132, 92, 0.18)',
        });
        if (!cardAnimated || !(await waitForTutorialDelay(140, requestId))) {
          return;
        }

        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-model-card-link"]',
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.18)',
        });
        return;
      }

      if (mode === 'preview') {
        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-upload-preview"]',
          requestId,
          accentColor: 'rgba(170, 139, 89, 0.2)',
        });
        return;
      }

      if (mode === 'ranking') {
        setVizOrder('group');
        if (!(await waitForTutorialDelay(120, requestId))) {
          return;
        }

        const orderAnimated = await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-barchart-order"]',
          requestId,
          accentColor: 'rgba(176, 132, 92, 0.2)',
        });
        if (!orderAnimated || !(await waitForTutorialDelay(140, requestId))) {
          return;
        }

        setVizOrder('ranking');
        if (!(await waitForTutorialDelay(260, requestId))) {
          return;
        }

        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-barchart-panel"]',
          requestId,
          accentColor: 'rgba(176, 132, 92, 0.16)',
        });
        return;
      }

      if (mode === 'highlight-group') {
        const groups = getSortedGroupKeys(files);
        const highlightedGroup = groups[0] ?? null;

        setVizOrder('ranking');
        if (!(await waitForTutorialDelay(180, requestId))) {
          return;
        }

        const controlsAnimated = await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-barchart-highlight"]',
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.18)',
        });
        if (!controlsAnimated || !highlightedGroup || !(await waitForTutorialDelay(120, requestId))) {
          return;
        }

        setTutorialHighlightedResultGroups([highlightedGroup]);
        if (!(await waitForTutorialDelay(220, requestId))) {
          return;
        }

        const highlightedGroupSelector = `[data-tutorial-result-group="${escapeTutorialSelectorValue(highlightedGroup)}"]`;
        const groupAnimated = await pulseTutorialSurface({
          selector: highlightedGroupSelector,
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.2)',
        });
        if (!groupAnimated || !(await waitForTutorialDelay(120, requestId))) {
          return;
        }

        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-barchart-panel"]',
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.14)',
        });
        return;
      }

      if (mode === 'insights') {
        const buttonAnimated = await pulseTutorialButton({
          selector: '[data-tutorial="lab-results-get-insights"]',
          requestId,
        });
        if (!buttonAnimated || !(await waitForTutorialDelay(120, requestId))) {
          return;
        }

        await pulseTutorialSurface({
          selector: '[data-tutorial="lab-results-get-insights"]',
          requestId,
          accentColor: 'rgba(170, 139, 89, 0.18)',
        });
        return;
      }

      if (mode === 'chatbot') {
        resetChatbotPosition();

        if (!isChatbotOpen()) {
          const toggleAnimated = await pulseTutorialButton({
            selector: '#cortex-chatbot-toggle',
            requestId,
          });
          if (!toggleAnimated || !(await waitForTutorialDelay(120, requestId))) {
            return;
          }

          setChatbotVisibility(true, { resetPosition: true });
          if (!(await waitForTutorialDelay(220, requestId))) {
            return;
          }
        }

        const panelAnimated = await pulseTutorialSurface({
          selector: '#cortex-chatbot-container',
          requestId,
          accentColor: 'rgba(196, 116, 144, 0.18)',
        });
        if (!panelAnimated || !(await waitForTutorialDelay(120, requestId))) {
          return;
        }

        await pulseTutorialSurface({
          selector: '#cortex-chatbot-input',
          requestId,
          accentColor: 'rgba(176, 132, 92, 0.18)',
        });
      }
    };

    tutorialUploadDemoTimerRef.current = window.setTimeout(() => {
      tutorialUploadDemoTimerRef.current = null;
      runSequence();
    }, 180);
  };

  const buildTutorialPredictionFromFiles = (items: PreviewFile[]) => {
    const keys = items.map((file) => file.serverKey || file.label || file.uid);
    const groups = items.map((file) => file.groupKey || "Ungrouped");
    const uniqueGroups = Array.from(new Set(groups));
    const groupScore = Object.fromEntries(
      uniqueGroups.map((group, index) => [group, 0.82 - index * 0.16])
    );

    const mean: Record<string, number> = {};
    const sem: Record<string, number> = {};
    keys.forEach((key, index) => {
      const base = groupScore[groups[index]] ?? 0.4;
      mean[key] = Number((base + ((index % 5) - 2) * 0.035).toFixed(3));
      sem[key] = 0.04;
    });

    const rdm = keys.map((leftKey, i) =>
      keys.map((rightKey, j) => (i === j ? 0 : Number(Math.abs(mean[leftKey] - mean[rightKey]).toFixed(3))))
    );

    return [{ mean, sem, rdm }];
  };

  const ensureTutorialResultsReady = async () => {
    let items = files;
    if (!items.length) {
      items = await loadPrestoredDataset("reza", { silent: true });
    }
    if (!items.length) {
      return;
    }

    let result = null;
    if (prestoreDataset) {
      result = wrapPredictionResult(
        await loadPreloadedPredictionByRegion(prestoreDataset, region)
      );
    }
    if (!result) {
      result = buildTutorialPredictionFromFiles(items);
    }

    setPredictionResult(result);
    setInsightRegionCache((prev) => ({ ...prev, [region]: result }));
    setShowResults(true);
  };

  const setResultsTutorialDemo = (mode: string = 'default') => {
    tutorialUploadDemoRequestRef.current += 1;
    const requestId = tutorialUploadDemoRequestRef.current;
    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    captureOriginalResultsTutorialState();

    setCurrent(2);
    void ensureTutorialResultsReady().then(() => {
      if (tutorialUploadDemoRequestRef.current !== requestId) {
        return;
      }
      if (mode === 'default') {
        setTutorialHighlightedResultGroups(null);
        return;
      }
      startAnimatedResultsDemo({ requestId, mode });
    });
  };

  const startLoopingUploadDemo = ({
    requestId,
    mode,
    baseFiles,
    demoFiles,
    baseGroups = [],
    demoGroups = [],
  }: {
    requestId: number;
    mode: string;
    baseFiles: PreviewFile[];
    demoFiles: PreviewFile[];
    baseGroups?: string[];
    demoGroups?: string[];
  }) => {
    clearUploadDemoTimer();
    clearUploadDemoVisuals();

    const loop = (delayMs: number, showDemoFrame: boolean) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(() => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        syncUploadTutorialState(
          showDemoFrame ? demoFiles : baseFiles,
          'reza',
          showDemoFrame ? demoGroups : baseGroups,
          mode
        );

        loop(showDemoFrame ? 2400 : 1800, !showDemoFrame);
      }, delayMs);
    };

    syncUploadTutorialState(baseFiles, 'reza', baseGroups, mode);
    loop(1600, true);
  };

  const getSortedGroupKeys = (items: PreviewFile[]) =>
    Array.from(new Set(items.map((file) => file.groupKey).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    );

  const getClearGroupDemoSpec = (baseFiles: PreviewFile[]) => {
    const groups = getSortedGroupKeys(baseFiles);
    if (groups.length < 2) {
      return null;
    }

    const clearedGroup = groups[0];
    return {
      clearedGroup,
      demoFiles: baseFiles.filter((file) => file.groupKey !== clearedGroup).map((file) => ({ ...file })),
    };
  };

  const getDragDemoSpec = (baseFiles: PreviewFile[]) => {
    const groups = getSortedGroupKeys(baseFiles);
    if (groups.length < 2) {
      return null;
    }

    const fromGroup = groups[0];
    const toGroup = groups[1];
    const movingItems = baseFiles.filter((file) => file.groupKey === fromGroup).slice(0, 3);
    if (!movingItems.length) {
      return null;
    }

    const movingUids = movingItems.map((item) => item.uid);
    const movingUidSet = new Set(movingUids);

    return {
      fromGroup,
      toGroup,
      movingUids,
      previewSrcs: movingItems.map((item) => item.blobURL),
      demoFiles: baseFiles.map((file) =>
        movingUidSet.has(file.uid) ? { ...file, groupKey: toGroup } : { ...file }
      ),
    };
  };

  const waitForTutorialElement = (selector: string, requestId: number, timeoutMs = 1800) =>
    new Promise<HTMLElement | null>((resolve) => {
      const startedAt = window.performance.now();

      const check = () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          resolve(null);
          return;
        }

        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) {
          resolve(element);
          return;
        }

        if (window.performance.now() - startedAt >= timeoutMs) {
          resolve(null);
          return;
        }

        window.setTimeout(check, 40);
      };

      check();
    });

  const pulseTutorialButton = async ({
    selector,
    requestId,
  }: {
    selector: string;
    requestId: number;
  }) => {
    const button = await waitForTutorialElement(selector, requestId, 800);
    if (!button || tutorialUploadDemoRequestRef.current !== requestId) {
      return false;
    }

    const animation = trackUploadDemoAnimation(
      button.animate(
        [
          {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(176, 132, 92, 0)',
            backgroundColor: 'rgba(255, 255, 255, 1)',
          },
          {
            transform: 'scale(0.97)',
            boxShadow: '0 0 0 10px rgba(176, 132, 92, 0.18)',
            backgroundColor: 'rgba(247, 240, 232, 1)',
          },
          {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(176, 132, 92, 0)',
            backgroundColor: 'rgba(255, 255, 255, 1)',
          },
        ],
        {
          duration: 840,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    );

    try {
      await animation?.finished;
    } catch {
      return false;
    }

    return tutorialUploadDemoRequestRef.current === requestId;
  };

  const waitForTutorialDelay = (delayMs: number, requestId: number) =>
    new Promise<boolean>((resolve) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(() => {
        tutorialUploadDemoTimerRef.current = null;
        resolve(tutorialUploadDemoRequestRef.current === requestId);
      }, delayMs);
    });

  const pulseTutorialSurface = async ({
    selector,
    requestId,
    accentColor = 'rgba(176, 132, 92, 0.2)',
  }: {
    selector: string;
    requestId: number;
    accentColor?: string;
  }) => {
    const element = await waitForTutorialElement(selector, requestId, 900);
    if (!element || tutorialUploadDemoRequestRef.current !== requestId) {
      return false;
    }

    const animation = trackUploadDemoAnimation(
      element.animate(
        [
          {
            transform: 'translateY(0) scale(1)',
            boxShadow: '0 0 0 0 rgba(176, 132, 92, 0)',
            filter: 'brightness(1)',
          },
          {
            transform: 'translateY(-3px) scale(1.01)',
            boxShadow: `0 0 0 12px ${accentColor}, 0 18px 34px rgba(74, 57, 42, 0.14)`,
            filter: 'brightness(1.03)',
          },
          {
            transform: 'translateY(0) scale(1)',
            boxShadow: '0 0 0 0 rgba(176, 132, 92, 0)',
            filter: 'brightness(1)',
          },
        ],
        {
          duration: 1080,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    );

    try {
      await animation?.finished;
    } catch {
      return false;
    }

    return tutorialUploadDemoRequestRef.current === requestId;
  };

  const startAnimatedSettingsDemo = ({ requestId }: { requestId: number }) => {
    clearUploadDemoTimer();
    clearUploadDemoVisuals();

    const runSequence = async () => {
      if (tutorialUploadDemoRequestRef.current !== requestId) {
        return;
      }

      const regionAnimated = await pulseTutorialSurface({
        selector: '[data-tutorial="lab-settings-region-active"]',
        requestId,
        accentColor: 'rgba(196, 116, 144, 0.2)',
      });
      if (!regionAnimated || !(await waitForTutorialDelay(420, requestId))) {
        return;
      }

      const modelAnimated = await pulseTutorialSurface({
        selector: '[data-tutorial="lab-settings-model"]',
        requestId,
        accentColor: 'rgba(176, 132, 92, 0.2)',
      });
      if (!modelAnimated || !(await waitForTutorialDelay(420, requestId))) {
        return;
      }

      const trainingAnimated = await pulseTutorialSurface({
        selector: '[data-tutorial="lab-settings-training"]',
        requestId,
        accentColor: 'rgba(170, 139, 89, 0.2)',
      });
      if (!trainingAnimated || !(await waitForTutorialDelay(1850, requestId))) {
        return;
      }

      runSequence();
    };

    tutorialUploadDemoTimerRef.current = window.setTimeout(() => {
      tutorialUploadDemoTimerRef.current = null;
      runSequence();
    }, 1200);
  };

  const animateGroupEntrance = async ({
    requestId,
    groupKey,
  }: {
    requestId: number;
    groupKey: string;
  }) => {
    const selector = `[data-tutorial-group-key="${groupKey}"]`;
    const groupElement = await waitForTutorialElement(selector, requestId, 1400);
    if (!groupElement || tutorialUploadDemoRequestRef.current !== requestId) {
      return false;
    }

    const animation = trackUploadDemoAnimation(
      groupElement.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(18px) scale(0.96)',
            filter: 'blur(2px)',
          },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)',
          },
        ],
        {
          duration: 1080,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    );

    try {
      await animation?.finished;
    } catch {
      return false;
    }

    return tutorialUploadDemoRequestRef.current === requestId;
  };

  const animateGroupExit = async ({
    requestId,
    groupKey,
  }: {
    requestId: number;
    groupKey: string;
  }) => {
    const selector = `[data-tutorial-group-key="${groupKey}"]`;
    const groupElement = await waitForTutorialElement(selector, requestId, 800);
    if (!groupElement || tutorialUploadDemoRequestRef.current !== requestId) {
      return false;
    }

    const animation = trackUploadDemoAnimation(
      groupElement.animate(
        [
          {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)',
          },
          {
            opacity: 0,
            transform: 'translateY(-12px) scale(0.96)',
            filter: 'blur(2px)',
          },
        ],
        {
          duration: 1040,
          easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
          fill: 'forwards',
        }
      )
    );

    try {
      await animation?.finished;
    } catch {
      return false;
    }

    return tutorialUploadDemoRequestRef.current === requestId;
  };

  const playTutorialDragTransition = ({
    requestId,
    movingUids,
    targetGroup,
    previewSrcs,
    commitState,
  }: {
    requestId: number;
    movingUids: string[];
    targetGroup: string;
    previewSrcs: string[];
    commitState: () => void;
  }) =>
    new Promise<boolean>((resolve) => {
      clearUploadDemoVisuals();

      const sourceElements = movingUids
        .map((uid) =>
          Array.from(document.querySelectorAll('[data-tutorial-item-uid]')).find(
            (node) => node.getAttribute('data-tutorial-item-uid') === uid
          )
        )
        .filter((node): node is HTMLElement => node instanceof HTMLElement);

      const targetElement = Array.from(document.querySelectorAll('[data-tutorial-group-key]')).find(
        (node) => node.getAttribute('data-tutorial-group-key') === targetGroup
      ) as HTMLElement | undefined;

      if (!sourceElements.length || !targetElement) {
        commitState();
        resolve(true);
        return;
      }

      const sourceElement = sourceElements[0];
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const stackOffset = sourceElements.length > 1 ? 7 : 0;
      const durationMs = 2500;
      let targetLeft = targetRect.left + 24;
      let targetTop = targetRect.top + 82;

      targetLeft = Math.min(targetLeft, targetRect.right - sourceRect.width - 18);
      targetTop = Math.min(targetTop, targetRect.bottom - sourceRect.height - 18);
      targetLeft = Math.max(targetRect.left + 12, targetLeft);
      targetTop = Math.max(targetRect.top + 18, targetTop);

      const deltaX = targetLeft - sourceRect.left;
      const deltaY = targetTop - sourceRect.top;

      const preview = document.createElement('div');
      preview.setAttribute('data-tutorial-drag-preview', 'true');
      preview.style.position = 'fixed';
      preview.style.left = `${sourceRect.left}px`;
      preview.style.top = `${sourceRect.top}px`;
      preview.style.width = `${sourceRect.width + stackOffset * (previewSrcs.length - 1)}px`;
      preview.style.height = `${sourceRect.height + stackOffset * (previewSrcs.length - 1)}px`;
      preview.style.pointerEvents = 'none';
      preview.style.zIndex = '2147483646';
      preview.style.transition = 'opacity 180ms ease';
      preview.style.transform = 'translate3d(0, 0, 0) scale(1)';

      previewSrcs.forEach((src, index) => {
        const card = document.createElement('div');
        card.style.position = 'absolute';
        card.style.left = `${index * stackOffset}px`;
        card.style.top = `${index * stackOffset}px`;
        card.style.width = `${sourceRect.width}px`;
        card.style.height = `${sourceRect.height}px`;
        card.style.borderRadius = '12px';
        card.style.overflow = 'hidden';
        card.style.boxShadow = '0 18px 40px rgba(36, 31, 27, 0.24)';
        card.style.background = 'rgba(255, 255, 255, 0.92)';
        card.style.transform = `rotate(${index * 3 - Math.min(3, previewSrcs.length - 1)}deg)`;
        card.style.zIndex = String(index + 1);

        const previewImage = document.createElement('img');
        previewImage.src = src;
        previewImage.alt = '';
        previewImage.style.width = '100%';
        previewImage.style.height = '100%';
        previewImage.style.display = 'block';
        previewImage.style.objectFit = 'cover';
        card.appendChild(previewImage);
        preview.appendChild(card);
      });

      if (previewSrcs.length > 1) {
        const badge = document.createElement('div');
        badge.textContent = String(previewSrcs.length);
        badge.style.position = 'absolute';
        badge.style.right = '-6px';
        badge.style.top = '-8px';
        badge.style.minWidth = '28px';
        badge.style.height = '28px';
        badge.style.padding = '0 8px';
        badge.style.borderRadius = '999px';
        badge.style.background = 'rgba(33, 31, 28, 0.92)';
        badge.style.color = '#fff';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontFamily = "var(--lab-mono, 'IBM Plex Mono', monospace)";
        badge.style.fontSize = '13px';
        badge.style.fontWeight = '600';
        badge.style.zIndex = '20';
        preview.appendChild(badge);
      }

      const previousSourceStyles = sourceElements.map((element) => ({
        element,
        opacity: element.style.opacity,
        transition: element.style.transition,
        border: element.style.border,
        boxShadow: element.style.boxShadow,
        background: element.style.background,
      }));
      const previousTargetBoxShadow = targetElement.style.boxShadow;
      const previousTargetTransition = targetElement.style.transition;
      const previousTargetBorderColor = targetElement.style.borderColor;

      sourceElements.forEach((element) => {
        element.style.transition = 'opacity 180ms ease, box-shadow 180ms ease, border-color 180ms ease';
        element.style.border = '2px solid #5B7CFA';
        element.style.boxShadow = '0 0 0 1px rgba(91, 124, 250, 0.25)';
        element.style.background = 'rgba(91, 124, 250, 0.08)';
      });
      targetElement.style.transition = 'box-shadow 220ms ease, border-color 220ms ease';
      targetElement.style.boxShadow = '0 0 0 3px rgba(176, 132, 92, 0.42), 0 16px 36px rgba(74, 57, 42, 0.12)';
      targetElement.style.borderColor = 'rgba(176, 132, 92, 0.68)';

      let finishTimeout = 0;
      let cleanupTimeout = 0;
      let selectTimeout = 0;
      let previewMounted = false;

      const cleanup = () => {
        if (tutorialUploadDemoAnimationFrameRef.current !== null) {
          window.cancelAnimationFrame(tutorialUploadDemoAnimationFrameRef.current);
          tutorialUploadDemoAnimationFrameRef.current = null;
        }

        if (finishTimeout) {
          window.clearTimeout(finishTimeout);
        }
        if (cleanupTimeout) {
          window.clearTimeout(cleanupTimeout);
        }
        if (selectTimeout) {
          window.clearTimeout(selectTimeout);
        }

        if (previewMounted) {
          preview.remove();
        }
        previousSourceStyles.forEach(({ element, opacity, transition, border, boxShadow, background }) => {
          element.style.opacity = opacity;
          element.style.transition = transition;
          element.style.border = border;
          element.style.boxShadow = boxShadow;
          element.style.background = background;
        });
        targetElement.style.boxShadow = previousTargetBoxShadow;
        targetElement.style.transition = previousTargetTransition;
        targetElement.style.borderColor = previousTargetBorderColor;

        if (tutorialUploadDemoVisualCleanupRef.current === cleanup) {
          tutorialUploadDemoVisualCleanupRef.current = null;
        }
      };

      tutorialUploadDemoVisualCleanupRef.current = cleanup;

      const startFlight = () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          cleanup();
          resolve(false);
          return;
        }

        sourceElements.forEach((element) => {
          element.style.opacity = '0.16';
        });
        document.body.appendChild(preview);
        previewMounted = true;

        const easeOutQuart = (value: number) => 1 - Math.pow(1 - value, 4);
        const animationStart = window.performance.now();

        const stepAnimation = (now: number) => {
          if (tutorialUploadDemoRequestRef.current !== requestId) {
            cleanup();
            resolve(false);
            return;
          }

          const progress = Math.min(1, (now - animationStart) / durationMs);
          const eased = easeOutQuart(progress);
          const currentX = deltaX * eased;
          const currentY = deltaY * eased;
          const currentScale = 1 - 0.04 * eased;

          preview.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${currentScale})`;

          if (progress < 1) {
            tutorialUploadDemoAnimationFrameRef.current = window.requestAnimationFrame(stepAnimation);
            return;
          }

          tutorialUploadDemoAnimationFrameRef.current = null;
          commitState();
          preview.style.opacity = '0';

          cleanupTimeout = window.setTimeout(() => {
            cleanup();
            resolve(true);
          }, 180);
        };

        tutorialUploadDemoAnimationFrameRef.current = window.requestAnimationFrame(stepAnimation);
      };

      selectTimeout = window.setTimeout(startFlight, previewSrcs.length > 1 ? 560 : 0);
    });

  const startAnimatedDragUploadDemo = ({
    requestId,
    mode,
    baseFiles,
  }: {
    requestId: number;
    mode: string;
    baseFiles: PreviewFile[];
  }) => {
    const dragSpec = getDragDemoSpec(baseFiles);
    if (!dragSpec) {
      startLoopingUploadDemo({
        requestId,
        mode,
        baseFiles,
        demoFiles: clonePreviewFiles(baseFiles),
      });
      return;
    }

    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    syncUploadTutorialState(baseFiles, 'reza', [], mode);

    const queueForward = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const completed = await playTutorialDragTransition({
          requestId,
          movingUids: dragSpec.movingUids,
          targetGroup: dragSpec.toGroup,
          previewSrcs: dragSpec.previewSrcs,
          commitState: () => {
            syncUploadTutorialState(dragSpec.demoFiles, 'reza', [], mode);
          },
        });

        if (!completed || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        queueBackward(2400);
      }, delayMs);
    };

    const queueBackward = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const completed = await playTutorialDragTransition({
          requestId,
          movingUids: dragSpec.movingUids,
          targetGroup: dragSpec.fromGroup,
          previewSrcs: dragSpec.previewSrcs,
          commitState: () => {
            syncUploadTutorialState(baseFiles, 'reza', [], mode);
          },
        });

        if (!completed || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        queueForward(1950);
      }, delayMs);
    };

    queueForward(1600);
  };

  const startAnimatedAddGroupUploadDemo = ({
    requestId,
    mode,
    baseFiles,
  }: {
    requestId: number;
    mode: string;
    baseFiles: PreviewFile[];
  }) => {
    const tutorialGroupKey = 'Tutorial Group';
    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    syncUploadTutorialState(baseFiles, 'reza', [], mode);

    const queueShow = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const pulsed = await pulseTutorialButton({
          selector: '[data-tutorial="lab-upload-add-group"]',
          requestId,
        });
        if (!pulsed || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        syncUploadTutorialState(baseFiles, 'reza', [tutorialGroupKey], mode);
        const animated = await animateGroupEntrance({ requestId, groupKey: tutorialGroupKey });
        if (!animated || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        queueHide(2550);
      }, delayMs);
    };

    const queueHide = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const animated = await animateGroupExit({ requestId, groupKey: tutorialGroupKey });
        if (!animated || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        syncUploadTutorialState(baseFiles, 'reza', [], mode);
        queueShow(2100);
      }, delayMs);
    };

    queueShow(1550);
  };

  const startAnimatedClearGroupUploadDemo = ({
    requestId,
    mode,
    baseFiles,
  }: {
    requestId: number;
    mode: string;
    baseFiles: PreviewFile[];
  }) => {
    const clearSpec = getClearGroupDemoSpec(baseFiles);
    if (!clearSpec) {
      startLoopingUploadDemo({
        requestId,
        mode,
        baseFiles,
        demoFiles: clonePreviewFiles(baseFiles),
      });
      return;
    }

    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    syncUploadTutorialState(baseFiles, 'reza', [], mode);

    const queueClear = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const pulsed = await pulseTutorialButton({
          selector: '[data-tutorial="lab-upload-clear-group"]',
          requestId,
        });
        if (!pulsed || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        const animated = await animateGroupExit({ requestId, groupKey: clearSpec.clearedGroup });
        if (!animated || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        syncUploadTutorialState(clearSpec.demoFiles, 'reza', [], mode);
        queueRestore(2550);
      }, delayMs);
    };

    const queueRestore = (delayMs: number) => {
      tutorialUploadDemoTimerRef.current = window.setTimeout(async () => {
        if (tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        syncUploadTutorialState(baseFiles, 'reza', [], mode);
        const animated = await animateGroupEntrance({ requestId, groupKey: clearSpec.clearedGroup });
        if (!animated || tutorialUploadDemoRequestRef.current !== requestId) {
          return;
        }

        queueClear(2100);
      }, delayMs);
    };

    queueClear(1550);
  };

  useEffect(() => {
    return () => {
      tutorialUploadDemoRequestRef.current += 1;
      clearUploadDemoTimer();
      clearUploadDemoVisuals();
    };
  }, []);

  const buildDragDemoFiles = (baseFiles: PreviewFile[]) => {
    return getDragDemoSpec(baseFiles)?.demoFiles ?? clonePreviewFiles(baseFiles);
  };

  const buildClearGroupDemoFiles = (baseFiles: PreviewFile[]) => {
    return getClearGroupDemoSpec(baseFiles)?.demoFiles ?? clonePreviewFiles(baseFiles);
  };

  useEffect(() => {
    const tutorialApi = {
      setStep: (stepIndex: number) => {
        if (!Number.isInteger(stepIndex)) return;

        tutorialUploadDemoRequestRef.current += 1;
        clearUploadDemoTimer();
        clearUploadDemoVisuals();
        setTutorialHighlightedResultGroups(null);

        const safeStep = Math.max(0, Math.min(stepIndex, 2));
        setCurrent(safeStep);
        if (safeStep === 2) setShowResults(true);
      },
      loadDataset: async (datasetKey: string) => {
        if (!datasetKey) return;
        if (prestoreDataset === datasetKey || preloadLoadingKey === datasetKey) return;
        await loadPrestoredDataset(datasetKey, { silent: true });
      },
      setUploadDemo: async (mode: string) => {
        tutorialUploadDemoRequestRef.current += 1;
        const requestId = tutorialUploadDemoRequestRef.current;
        clearUploadDemoTimer();
        clearUploadDemoVisuals();
        setTutorialHighlightedResultGroups(null);

        setCurrent(0);
        captureOriginalUploadTutorialState();

        if (mode === 'restore-original') {
          restoreOriginalUploadTutorialState();
          setTutorialUploadDemoMode(mode);
          return;
        }

        let baseFiles = tutorialRezaBaselineRef.current ? clonePreviewFiles(tutorialRezaBaselineRef.current) : null;
        if (!baseFiles || baseFiles.length === 0) {
          const loadedFiles = await loadPrestoredDataset('reza', { silent: true });
          if (tutorialUploadDemoRequestRef.current !== requestId) {
            return;
          }
          baseFiles = loadedFiles.length ? clonePreviewFiles(loadedFiles) : [];
        }

        if (!baseFiles.length) {
          return;
        }

        if (mode === 'reza-base') {
          syncUploadTutorialState(baseFiles, 'reza', [], mode);
          return;
        }

        if (mode === 'drag-demo') {
          startAnimatedDragUploadDemo({
            requestId,
            mode,
            baseFiles,
          });
          return;
        }

        if (mode === 'add-group-demo') {
          startAnimatedAddGroupUploadDemo({
            requestId,
            mode,
            baseFiles,
          });
          return;
        }

        if (mode === 'clear-group-demo') {
          startAnimatedClearGroupUploadDemo({
            requestId,
            mode,
            baseFiles,
          });
        }
      },
      playSettingsDemo: () => {
        tutorialUploadDemoRequestRef.current += 1;
        const requestId = tutorialUploadDemoRequestRef.current;
        clearUploadDemoTimer();
        clearUploadDemoVisuals();
        setTutorialHighlightedResultGroups(null);

        setCurrent(1);
        startAnimatedSettingsDemo({ requestId });
      },
      setResultsDemo: (mode: string) => {
        setResultsTutorialDemo(mode);
      },
      resetUploadDemo: () => {
        resetUploadTutorialState();
      },
      resetResultsDemo: () => {
        resetResultsTutorialState();
      },
    };

    (window as any).cortexLabTutorial = tutorialApi;

    return () => {
      if ((window as any).cortexLabTutorial === tutorialApi) {
        delete (window as any).cortexLabTutorial;
      }
    };
  }, [files, prestoreDataset, preloadLoadingKey, resultsPreviewCollapsed, vizOrder]);

const clearRegionPredictionCache = () => {
  setInsightRegionCache({});
};

const allInsightRegionValues = REGION_OPTIONS.map((r) => r.value);

const getAvailableInsightRegionsByDataset = (datasetName: string) => {
  if (datasetName === 'murty185') return MURTY185_INCLUDED_REGIONS;
  if (datasetName === 'nsd_1000') return NSD_1000_INCLUDED_REGIONS;
  return allInsightRegionValues;
};

const getPreloadedPredictionLoaderByRegion = (
  datasetKey: string,
  targetRegion: string
) => {
  const path = `/assets/preload/${datasetKey}/data/${model}_${dataset}_${targetRegion}.json`;

  const allKeys = Object.keys(PRELOADED_JSON_MODULES);

  const matchedKey = allKeys.find(
    (k) =>
      normalizePath(k).replace(/\s+/g, "") ===
      normalizePath(path).replace(/\s+/g, "")
  );

  if (!matchedKey) return null;

  return PRELOADED_JSON_MODULES[matchedKey];
};

const loadPreloadedPredictionByRegion = async (
  datasetKey: string,
  targetRegion: string
) => {
  const loader = getPreloadedPredictionLoaderByRegion(datasetKey, targetRegion);
  if (!loader) return null;
  return await loader();
};


const loadPrestoredDataset = async (datasetKey: string, options: { silent?: boolean } = {}) => {
  setPreloadLoading(true);
  setPreloadLoadingKey(datasetKey);
  setPrestoreDataset(datasetKey);

  const matchedEntries = Object.entries(PRELOADED_IMAGE_MODULES)
    .filter(([fullPath]) => {
      const normalized = normalizePath(fullPath).replace(/\s+/g, "");
      const match = normalized.match(/\/preload\/([^/]+)\/images\/(.+)$/i);
      if (!match) return false;

      const datasetFromPath = match[1].toLowerCase();
      return datasetFromPath === datasetKey.toLowerCase();
    })
    .sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

  if (matchedEntries.length === 0) {
    if (!options.silent) {
      message.warning(`No images found for ${datasetKey}`);
    }
    setFiles([]);
    setFileMappings([]);
    setPreloadLoading(false);
    setPreloadLoadingKey(null);
    return [];
  }

  try {
    const preloadFiles: PreviewFile[] = await Promise.all(
      matchedEntries.map(async ([fullPath, loader], index) => {
        const normalized = normalizePath(fullPath).replace(/\s+/g, "");
        const match = normalized.match(/\/images\/(.+)$/i);
        const relativePath = match?.[1] || "";
        const parts = relativePath.split("/").filter(Boolean);

        const filename = parts[parts.length - 1] || `image_${index}.jpg`;
        const groupKey = parts.length > 1 ? parts[0] : "Ungrouped";

        // 关键：和 preload json 的 key 保持完全一致
        const canonicalKey = `${datasetKey}__${groupKey}__${filename}`;

        const ext = getExt(filename).toLowerCase();
        const mime =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";

        const url = await loader();
        const blob = await fetch(url).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
          return r.blob();
        });

        const realFile = new File([blob], filename, {
          type: blob.type || mime,
        }) as FileWithPath;

        Object.defineProperty(realFile, "webkitRelativePath", {
          value: relativePath,
          writable: false,
          configurable: true,
        });

        return {
          uid: canonicalKey,
          blobURL: url,
          file: realFile,
          label: filename,
          groupKey,
          serverKey: canonicalKey,
        };
      })
    );

    setFiles(preloadFiles);
    setFileMappings(preloadFiles);
    if (datasetKey.toLowerCase() === 'reza') {
      tutorialRezaBaselineRef.current = clonePreviewFiles(preloadFiles);
    }

    setPredictionResult(null);
    clearRegionPredictionCache();
    setShowInsights(false);
    setPredictstep(1);

    // Keep preload fast: only load image stimuli now.
    // Predictions should still come from backend when user proceeds.
    setPredictstep(1);

    if (!options.silent) {
      message.success(`${datasetKey} loaded`);
    }
    return preloadFiles;
  } catch (err) {
    console.error(err);
    if (!options.silent) {
      message.error(`Failed to load dataset ${datasetKey}`);
    }
    return [];
  } finally {
    setPreloadLoading(false);
    setPreloadLoadingKey(null);
  }
};

 
const addIncomingFiles = (newFiles: File[], groupKey?: string) => {
  if (!newFiles?.length) return;

  const nextAdd: PreviewFile[] = newFiles
    .filter((f) => f.type?.startsWith("image/"))
    .map((f) => {
      const ff = f as FileWithPath;
      const uid = buildOrgName(ff);
      const label = ff.webkitRelativePath?.split("/").pop() || ff.name;
      const assignedGroup = groupKey || buildGroupKey(ff, 1);

      return {
        uid,
        label,
        groupKey: assignedGroup,
        file: ff,
        blobURL: URL.createObjectURL(ff),
      };
    });

  setFiles((prev) => {
    const base = prestoreDataset ? [] : prev;
    const existing = new Set(base.map((x) => x.uid));
    const deduped = nextAdd.filter((x) => !existing.has(x.uid));
    const next = [...base, ...deduped];

    setFileMappings(next);
    setPredictionResult(null);
    clearRegionPredictionCache();
    setShowInsights(false);
    setPredictstep(1);
    setShowResults(false);
    setPrestoreDataset(null);

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
    setShowInsights(false);
    setShowResults(false);
    setPrestoreDataset(null);

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
    setShowInsights(false);
    setShowResults(false);
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
  setShowInsights(false);
  setShowResults(false);
  setPredictstep(1);
  setUploaderKey((k) => k + 1); 
  setPrestoreDataset(null);
};

const moveItemToGroup = (uid: string | string[], toGroupKey: string) => {
  const uids = new Set(Array.isArray(uid) ? uid : [uid]);
  setFiles(prev => prev.map(f => (uids.has(f.uid) ? { ...f, groupKey: toGroupKey } : f)));
  setFileMappings(prev => prev.map(f => (uids.has(f.uid) ? { ...f, groupKey: toGroupKey } : f)));
};

const renameGroupKey = (oldKey: string, newKey: string) => {
  setFiles(prev => prev.map(f => (f.groupKey === oldKey ? { ...f, groupKey: newKey } : f)));
  setFileMappings(prev => prev.map(f => (f.groupKey === oldKey ? { ...f, groupKey: newKey } : f)));
}


useEffect(() => {
  setPredictionResult(null);
  setPredictstep(1);
  clearRegionPredictionCache();
  setShowInsights(false);
  setShowResults(false);
  setPredictError(null);
}, [
  model,
  dataset,
  voxelOption,
  voxelNumber,
  paper,
  participantName,
  prestoreDataset,
  region,
]);

  useEffect(() => {
    if (import.meta.env.DEV) console.log("🔄 predictionResult updated:", predictionResult);
  }, [predictionResult]);

  const getCachedResultByRegion = (targetRegion: string) => {
    return insightRegionCache[targetRegion] ?? null;
  };

  const currentRegionPredictionResult = useMemo(() => {
    return getCachedResultByRegion(region) ?? predictionResult;
  }, [region, insightRegionCache, predictionResult]);

  useEffect(() => {
    const cachedRegions = Object.keys(insightRegionCache);

    const selectedCache = getCachedResultByRegion(region);
    const usingCache = selectedCache === currentRegionPredictionResult && !!selectedCache;
    const usingLatestPrediction =
      predictionResult === currentRegionPredictionResult && !usingCache;

    let source = "none";
    if (usingCache) source = `${region} cache`;
    else if (usingLatestPrediction) source = "predictionResult fallback";

    if (import.meta.env.DEV) {
      console.log("========== REGION DEBUG ==========");
      console.log("current region:", region);
      console.log("cached regions:", cachedRegions);
      console.log("selected cache for current region:", selectedCache);
      console.log("predictionResult:", predictionResult);
      console.log("currentRegionPredictionResult:", currentRegionPredictionResult);
      console.log("currentRegionPredictionResult source:", source);
      console.log("==================================");
    }
  }, [
    region,
    predictionResult,
    insightRegionCache,
    currentRegionPredictionResult,
  ]);

  const availableInsightRegions = useMemo(() => {
    const included = getAvailableInsightRegionsByDataset(dataset);
    return allInsightRegionValues.filter((r) => included.includes(r));
  }, [dataset]);

  useEffect(() => {
    if (!regionSupportsMurty185(region) && dataset === "murty185") {
      setDataset("nsd_1000");
    }
  }, [region, dataset]);

  // Bottom Across-regions selection follows the top ROI selector.
  useEffect(() => {
    if (availableInsightRegions.includes(region)) {
      setSelectedInsightRegions([region]);
      return;
    }
    setSelectedInsightRegions(
      availableInsightRegions.length > 0 ? [availableInsightRegions[0]] : []
    );
  }, [region, availableInsightRegions]);

  const toggleInsightRegion = (targetRegion: string) => {
    setSelectedInsightRegions((prev) =>
      prev.includes(targetRegion)
        ? prev.filter((r) => r !== targetRegion)
        : [...prev, targetRegion]
    );
  };

  const insightRegionDataMap = useMemo(() => {
    return selectedInsightRegions.reduce((acc, r) => {
      const cached = getCachedResultByRegion(r);
      if (cached) acc[r] = cached;
      return acc;
    }, {} as Record<string, any>);
  }, [selectedInsightRegions, insightRegionCache]);

  const handlePrediction = async (targetRegion = region): Promise<boolean> => {
    if (files.length === 0) {
      message.error("No files uploaded. Please upload files first.");
      return false;
    }

    if (!targetRegion || !dataset || !model) {
      message.error("Select an fROI, mapping dataset, and model before running inference.");
      return false;
    }

    setPredictError(null);

    if (prestoreDataset) {
      const localResult = wrapPredictionResult(
        await loadPreloadedPredictionByRegion(prestoreDataset, targetRegion)
      );

      if (localResult) {
        setPredictionResult(localResult);
        setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: localResult }));

        setPredictstep(2);
        setShowResults(true);
        message.success("Loaded precomputed prediction.");
        return true;
      }
    }

    setPredictionLoading(true);

    try {
      const uploadFiles = files.map((x) => {
        if (!x.file) {
          throw new Error(`Missing file data for ${x.label || x.uid}`);
        }
        const ext = getExt(x.file.name || x.label || "");
        const newName = `${safe(x.uid)}${ext}`;
        return new File([x.file], newName, { type: x.file.type || "image/jpeg" });
      });

      const { resultData, serverKeys } = await runFroiPrediction({
        uploadFiles,
        region: targetRegion,
        dataset,
        model,
      });

      setFiles((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));
      setFileMappings((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));
      setPredictionResult(resultData);
      setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: resultData }));
      setPredictError(null);
      setShowResults(true);
      message.success("Prediction complete!");
      return true;
    } catch (e: any) {
      console.error("fROI prediction failed", e);
      const text = getFroiUserErrorMessage(e);
      setPredictError(text);
      message.error(text);
      return false;
    } finally {
      setPredictionLoading(false);
      setLoading(false);
      setPredictstep(2);
    }
  };

  const insightPrediction = async (targetRegion: string) => {
    const cached = getCachedResultByRegion(targetRegion);
    if (cached) return cached;

    if (prestoreDataset) {
      const localResult = wrapPredictionResult(
        await loadPreloadedPredictionByRegion(prestoreDataset, targetRegion)
      );

      if (localResult) {
        setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: localResult }));
        return localResult;
      }
    }

    const uploadFiles = files.map((x) => {
      const ext = getExt(x.file.name);
      const newName = `${safe(x.uid)}${ext}`;
      return new File([x.file], newName, { type: x.file.type });
    });

    const { resultData, serverKeys } = await runFroiPrediction({
      uploadFiles,
      region: targetRegion,
      dataset,
      model,
    });

    setFiles((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));
    setFileMappings((prev) => prev.map((x, i) => ({ ...x, serverKey: serverKeys[i] })));
    setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: resultData }));
    return resultData;
  };

  // Auto-load and show insights whenever the selection is ready (no Get Insights button).
  useEffect(() => {
    if (!showResults || files.length === 0 || !currentRegionPredictionResult) return;
    if (selectedInsightRegions.length === 0) {
      setShowInsights(false);
      setInsightLoading(false);
      return;
    }

    const missingRegions = selectedInsightRegions.filter(
      (r) => !getCachedResultByRegion(r)
    );

    if (missingRegions.length === 0) {
      setShowInsights(true);
      setInsightLoading(false);
      return;
    }

    // Main prediction owns the active ROI; only fetch it here as a fallback.
    const activeMissing = missingRegions.includes(region);
    const extraMissing = missingRegions.filter((r) => r !== region);
    const regionsToFetch = [
      ...extraMissing,
      ...(!predictionLoading && activeMissing ? [region] : []),
    ];

    if (regionsToFetch.length === 0) {
      setInsightLoading(true);
      setShowInsights(false);
      return;
    }

    let cancelled = false;

    const loadInsights = async () => {
      setInsightLoading(true);
      setShowInsights(false);
      try {
        await Promise.all(regionsToFetch.map((r) => insightPrediction(r)));
        if (cancelled) return;

        const stillMissing = selectedInsightRegions.some(
          (r) => !getCachedResultByRegion(r)
        );
        if (!stillMissing) {
          setShowInsights(true);
          setInsightLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          message.error(getFroiUserErrorMessage(e));
          setInsightLoading(false);
        }
      }
    };

    loadInsights();
    return () => {
      cancelled = true;
    };
  }, [
    showResults,
    currentRegionPredictionResult,
    files.length,
    selectedInsightRegions,
    insightRegionCache,
    predictionLoading,
    region,
    prestoreDataset,
    dataset,
    model,
  ]);

  // Sync lab state for chatbot
  useEffect(() => {
    (window as any).cortexLabState = {
      region,
      model,
      dataset,
      voxelOption,
      prestoreDataset,
      step: current,
      filesCount: files.length,
      hasPrediction: !!currentRegionPredictionResult,
    };
  }, [region, model, dataset, voxelOption, prestoreDataset, current, files.length, currentRegionPredictionResult]);

  const barchartData = useBarchartData(currentRegionPredictionResult);

  const { heatmapData, originalFilenames } = useHeatmapData(currentRegionPredictionResult);

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
  
  const runInference = async () => {
    const ok = await handlePrediction(region);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return ok;
  };

 return (
  <>
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontSize: 14,
          colorPrimary: "var(--tungsten, #424242)",
          borderRadius: 5,
        },
        components: {
          Button: {
            colorPrimary: "var(--tungsten, #424242)",
            colorPrimaryHover: "var(--highlight-color-button)",
            colorPrimaryActive: "var(--highlight-color-button)",
            fontWeight: 500,
            controlHeight: 36,
          },
          Progress: {
            colorPrimary: "var(--highlight-color-button)",
          },
        },
      }}
    >
    <ThemeProvider theme={muiLabTheme}>
      <div className="lab-workspace">
        <aside
          className="lab-settings-rail"
          data-tutorial="lab-stepper-nav"
        >
          <div data-tutorial="lab-settings-panel" className="lab-settings-rail-inner">
            <RegionSelector
              region={region}
              setRegion={selectRegion}
              dataset={dataset}
              variant="lab"
              tutorialRootKey="lab-settings-region"
              activeTutorialKey="lab-results-region-active"
            />
            <Settings
              variant="lab"
              region={region}
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
            <ModelCard
              variant="lab"
              region={region}
              dataset={dataset}
              model={model}
            />
          </div>
        </aside>

        <div className="lab-main-column">
          <div className="lab-roi-stage">
            <LabRoiViewer region={region} />
            <RoiInfoCard region={region} />
          </div>

          <div data-tutorial="lab-upload-panel" className="lab-stimuli-canvas">
            <div
              data-tutorial="lab-upload-uploader"
              className="lab-upload-column-panel"
            >
              <div className="lab-section-label" style={{ marginBottom: 10 }}>
                Upload stimuli
              </div>
              <Uploader
                key={uploaderKey}
                onAddFiles={(newFiles) => addIncomingFiles(newFiles)}
              />
            </div>

            <div className="lab-preload-inline">
              <div className="lab-section-label" style={{ marginBottom: 8 }}>
                Or load a published dataset
              </div>
              <PreloadDatasetPicker
                layout="row"
                selectedKey={prestoreDataset}
                isLoading={preloadLoading}
                loadingKey={preloadLoadingKey}
                onSelectDataset={(key: string | null) => {
                  if (!key) {
                    setPrestoreDataset(null);
                    setPreloadLoading(false);
                    setPreloadLoadingKey(null);
                    setFiles([]);
                    setFileMappings([]);
                    setPredictionResult(null);
                    clearRegionPredictionCache();
                    setShowInsights(false);
                    setShowResults(false);
                    setPredictstep(1);
                    return;
                  }

                  loadPrestoredDataset(key);
                }}
              />
              {preloadLoading && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
                    color: "var(--lab-muted, #8A8378)",
                  }}
                >
                  Loading stimuli…
                </div>
              )}
            </div>

            {isPreloadMode && <DatasetCardLab dataset={prestoreDataset} />}

            <div data-tutorial="lab-upload-images-panel">
              <div data-tutorial="lab-results-upload-preview">
                <ImagePreviewGroupedDnD
                  files={files}
                  variant="lab"
                  eyebrow="Uploaded stimuli"
                  title={inputMode === "preload" ? "Preloaded Images" : "Uploaded Images"}
                  groupDepth={1}
                  isPreload={isPreloadMode}
                  allowPreloadEditing={true}
                  tutorialCustomGroups={tutorialCustomGroups}
                  tutorialStateKey={tutorialUploadDemoMode}
                  onMoveItemToGroup={moveItemToGroup}
                  onRenameGroupKey={renameGroupKey}
                  onAddExternalFiles={(incoming, groupKey) => addIncomingFiles(incoming, groupKey)}
                  onRemove={(uid: string) => removeOne(uid)}
                  onClear={() => clearAll()}
                  onClearGroup={(groupKey, uids) => clearGroup(uids)}
                  onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
                />
              </div>
            </div>

            <div className="lab-run-row">
              <div style={{ color: 'var(--lab-secondary, #57534A)', fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Images size={16} strokeWidth={1.5} aria-hidden="true" color="currentColor" />
                <span className="lab-mono-num" style={{ fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)", fontWeight: 500 }}>{files.length}</span>
                <span>images loaded</span>
              </div>
              <Button
                type="primary"
                data-tutorial="lab-run-inference"
                onClick={runInference}
                disabled={loading || predictionLoading || files.length === 0}
              >
                {loading || predictionLoading ? "Processing..." : "Run Inference"}
              </Button>
            </div>
            {predictError && (
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  border: "0.5px solid var(--lab-hairline, #D6D2C6)",
                  borderRadius: 8,
                  background: "var(--lab-panel, #FBFAF6)",
                  color: "var(--lab-text, #211F1C)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  textAlign: "left",
                }}
              >
                {predictError}
              </div>
            )}
          </div>

          {(showResults || predictionLoading || !!currentRegionPredictionResult) && (
            <div
              ref={resultsRef}
              data-tutorial="lab-results-panel"
              className="lab-results-panel"
              style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}
            >
              <div className="lab-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                <div>
                  <span className="lab-section-label">Prediction results</span>
                  <h3 className="lab-heading">Readout for {region?.toUpperCase()}</h3>
                </div>
                <Button type="primary" onClick={downloadData} disabled={!currentRegionPredictionResult}>
                  Download data
                </Button>
              </div>

              {predictionLoading && <LinearIndeterminate />}
              <div className="lab-section-header">
                <span className="lab-eyebrow">Univariate analysis</span>
                <h3 className="lab-heading">Predicted voxel average responses</h3>
              </div>
                {barchartData.length > 0 && (
                  <BarChart
                    barChartData={barchartData}
                    height={600}
                    fileMappings={fileMappings}
                    order={vizOrder}
                    setOrder={setVizOrder}
                    tutorialSelectedGroups={tutorialHighlightedResultGroups}
                    labChart
                  />
                )}
              <div className="lab-section-header">
                <span className="lab-eyebrow">Multivariate analysis</span>
                <h3 className="lab-heading">Representational dissimilarity matrix (RDM) from predicted voxel responses</h3>
              </div>
              {barchartData.length <= 1 ? (
                <div style={{ textAlign: 'left', fontSize: '14px', color: 'var(--lab-muted, #8A8378)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  RDM unavailable for one image. Please upload more than 2 images to see the visualization.
                </div>
              ) : (
                <Heatmap
                  heatmapData={heatmapData}
                  originalFilenames={originalFilenames}
                  sortedFilenames={orderedFilenames}
                  width={800}
                  height={800}
                  fileMappings={fileMappings}
                  order={vizOrder}
                  labChart
                />
              )}

              <div
                className="lab-section-header"
                data-tutorial="lab-results-get-insights"
              >
                <span className="lab-eyebrow">Advanced insights</span>
                <h3 className="lab-heading">Across regions</h3>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
                    color: 'var(--lab-text, #211F1C)',
                  }}
                >
                  ROI selection
                </span>

                {availableInsightRegions.map((r) => {
                  const selected = selectedInsightRegions.includes(r);
                  const label = REGION_OPTIONS.find((x) => x.value === r)?.label || r.toUpperCase();

                  return (
                    <label
                      key={r}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        padding: '4px 8px',
                        borderRadius: '5px',
                        border: selected
                          ? '1px solid rgba(107, 99, 88, 0.35)'
                          : '1px solid transparent',
                        background: selected
                          ? 'rgba(247, 242, 238, 0.95)'
                          : 'transparent',
                        boxShadow: 'none',
                        opacity:
                          selectedInsightRegions.length > 0 && !selected ? 0.55 : 1,
                        transition: 'all 220ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleInsightRegion(r)}
                      />
                      <span
                        style={{
                          fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
                          fontSize: '12px',
                          fontWeight: 400,
                          color: 'var(--lab-text, #211F1C)',
                        }}
                      >
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {insightLoading && (
                <div
                  style={{
                    marginTop: 16,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    minHeight: 120,
                    color: 'var(--lab-secondary, #57534A)',
                  }}
                >
                  <Spin size="large" />
                  <span style={{ fontSize: 13, fontFamily: "var(--lab-sans, 'Inter', sans-serif)" }}>
                    Loading cross-region insights…
                  </span>
                </div>
              )}

              {!insightLoading && showInsights && (
                <div style={{ marginTop: "5px" }}>
                  <BoxPlot
                    regionDataMap={insightRegionDataMap}
                    fileMappings={fileMappings}
                    regionOrder={selectedInsightRegions}
                    height={560}
                    labChart
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
    </ConfigProvider>
  </>
);
};

export default Stepper;
