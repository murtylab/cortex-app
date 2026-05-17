import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Button, message, Steps, theme } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import { uploadImages } from './services/imageUploader.js';
import { SERVER_URL } from './services/config';
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
import {
  REGION_OPTIONS,
  MURTY185_INCLUDED_REGIONS,
  NSD_1000_INCLUDED_REGIONS,
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

const { Step } = Steps;
const SERVER_BASE_URL = SERVER_URL;

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
  },
});

const Stepper: React.FC = () => {
  const { token } = theme.useToken();
  const [current, setCurrent] = useState(0);
  const [predictstep, setPredictstep] = useState(1);



  //default settings
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
  const [insightRegionCache, setInsightRegionCache] = useState<Record<string, any>>({});


  // basic visulization and prediction states
  const [loading, setLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false); 

  // insight visulalization states
  const [showInsights, setShowInsights] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [selectedInsightRegions, setSelectedInsightRegions] = useState<string[]>(['ffa', 'eba', 'ppa']);

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
        if (resultsPreviewCollapsed) {
          const toggleAnimated = await pulseTutorialButton({
            selector: '[data-tutorial="lab-results-upload-preview-toggle"]',
            requestId,
          });
          if (!toggleAnimated || !(await waitForTutorialDelay(120, requestId))) {
            return;
          }

          setResultsPreviewCollapsed(false);
          if (!(await waitForTutorialDelay(260, requestId))) {
            return;
          }
        }

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

  const setResultsTutorialDemo = (mode: string = 'default') => {
    tutorialUploadDemoRequestRef.current += 1;
    const requestId = tutorialUploadDemoRequestRef.current;
    clearUploadDemoTimer();
    clearUploadDemoVisuals();
    captureOriginalResultsTutorialState();

    setCurrent(2);

    if (mode === 'default') {
      setTutorialHighlightedResultGroups(null);
      return;
    }

    startAnimatedResultsDemo({ requestId, mode });
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
    const movingItem = baseFiles.find((file) => file.groupKey === fromGroup);
    if (!movingItem) {
      return null;
    }

    return {
      fromGroup,
      toGroup,
      movingUid: movingItem.uid,
      previewSrc: movingItem.blobURL,
      demoFiles: baseFiles.map((file) =>
        file.uid === movingItem.uid ? { ...file, groupKey: toGroup } : { ...file }
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
    movingUid,
    targetGroup,
    previewSrc,
    commitState,
  }: {
    requestId: number;
    movingUid: string;
    targetGroup: string;
    previewSrc: string;
    commitState: () => void;
  }) =>
    new Promise<boolean>((resolve) => {
      clearUploadDemoVisuals();

      const sourceElement = Array.from(document.querySelectorAll('[data-tutorial-item-uid]')).find(
        (node) => node.getAttribute('data-tutorial-item-uid') === movingUid
      ) as HTMLElement | undefined;

      const targetElement = Array.from(document.querySelectorAll('[data-tutorial-group-key]')).find(
        (node) => node.getAttribute('data-tutorial-group-key') === targetGroup
      ) as HTMLElement | undefined;

      if (!sourceElement || !targetElement) {
        commitState();
        resolve(true);
        return;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
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
      preview.style.width = `${sourceRect.width}px`;
      preview.style.height = `${sourceRect.height}px`;
      preview.style.borderRadius = '12px';
      preview.style.overflow = 'hidden';
      preview.style.pointerEvents = 'none';
      preview.style.zIndex = '2147483646';
      preview.style.boxShadow = '0 18px 40px rgba(36, 31, 27, 0.24)';
      preview.style.background = 'rgba(255, 255, 255, 0.92)';
      preview.style.transition = 'opacity 180ms ease';
      preview.style.transform = 'translate3d(0, 0, 0) scale(1)';

      const previewImage = document.createElement('img');
      previewImage.src = previewSrc;
      previewImage.alt = '';
      previewImage.style.width = '100%';
      previewImage.style.height = '100%';
      previewImage.style.display = 'block';
      previewImage.style.objectFit = 'cover';
      preview.appendChild(previewImage);

      const previousSourceOpacity = sourceElement.style.opacity;
      const previousSourceTransition = sourceElement.style.transition;
      const previousTargetBoxShadow = targetElement.style.boxShadow;
      const previousTargetTransition = targetElement.style.transition;
      const previousTargetBorderColor = targetElement.style.borderColor;

      sourceElement.style.transition = 'opacity 180ms ease';
      sourceElement.style.opacity = '0.16';
      targetElement.style.transition = 'box-shadow 220ms ease, border-color 220ms ease';
      targetElement.style.boxShadow = '0 0 0 3px rgba(176, 132, 92, 0.42), 0 16px 36px rgba(74, 57, 42, 0.12)';
      targetElement.style.borderColor = 'rgba(176, 132, 92, 0.68)';

      document.body.appendChild(preview);

      let finishTimeout = 0;
      let cleanupTimeout = 0;

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

        preview.remove();
        sourceElement.style.opacity = previousSourceOpacity;
        sourceElement.style.transition = previousSourceTransition;
        targetElement.style.boxShadow = previousTargetBoxShadow;
        targetElement.style.transition = previousTargetTransition;
        targetElement.style.borderColor = previousTargetBorderColor;

        if (tutorialUploadDemoVisualCleanupRef.current === cleanup) {
          tutorialUploadDemoVisualCleanupRef.current = null;
        }
      };

      tutorialUploadDemoVisualCleanupRef.current = cleanup;

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
          movingUid: dragSpec.movingUid,
          targetGroup: dragSpec.toGroup,
          previewSrc: dragSpec.previewSrc,
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
          movingUid: dragSpec.movingUid,
          targetGroup: dragSpec.fromGroup,
          previewSrc: dragSpec.previewSrc,
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

  const next = () => setCurrent((prev) => prev + 1);
  const prev = () => setCurrent((prev) => prev - 1);

  const onChange = (value: number) => {
    setCurrent(value);
  };


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

 
const addIncomingFiles = (newFiles: File[]) => {
  if (!newFiles?.length) return;

  const nextAdd: PreviewFile[] = newFiles
    .filter((f) => f.type?.startsWith("image/"))
    .map((f) => {
      const ff = f as FileWithPath;
      const uid = buildOrgName(ff);
      const label = ff.webkitRelativePath?.split("/").pop() || ff.name;
      const groupKey = buildGroupKey(ff, 1);

      return {
        uid,
        label,
        groupKey,
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
  setPredictstep(1);
  setUploaderKey((k) => k + 1); 
  setPrestoreDataset(null);
};

const moveItemToGroup = (uid: string, toGroupKey: string) => {
  setFiles(prev => prev.map(f => (f.uid === uid ? { ...f, groupKey: toGroupKey } : f)));
  setFileMappings(prev => prev.map(f => (f.uid === uid ? { ...f, groupKey: toGroupKey } : f)));
  
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

  if (!prestoreDataset) return;
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
    if (current !== 2 || files.length === 0) return;

    const cached = getCachedResultByRegion(region);
    if (cached) return;

    setPredictionResult(null);
    setPredictstep(1);
    handlePrediction();
  }, [region, current, files.length, insightRegionCache]);

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
    setSelectedInsightRegions((prev) => {
      const kept = prev.filter((r) => availableInsightRegions.includes(r));
      if (kept.length > 0) return kept;
      return availableInsightRegions;
    });
  }, [availableInsightRegions]);

  const toggleInsightRegion = (targetRegion: string) => {
    setSelectedInsightRegions((prev) =>
      prev.includes(targetRegion)
        ? prev.filter((r) => r !== targetRegion)
        : [...prev, targetRegion]
    );
  };


  const handleGetInsights = async () => {
    if (selectedInsightRegions.length === 0) {
      message.warning("Select at least one ROI for insights.");
      return;
    }

    const missingRegions = selectedInsightRegions.filter(
      (r) => !getCachedResultByRegion(r)
    );

    if (missingRegions.length === 0) {
      setShowInsights(true);
      return;
    }

    setInsightLoading(true);
    try {
      await Promise.all(missingRegions.map((r) => insightPrediction(r)));
      setShowInsights(true);
    } catch (e) {
      console.error(e);
      message.error("Failed to load advanced insights.");
    } finally {
      setInsightLoading(false);
    }
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

    if (prestoreDataset) {
      const localResult = await loadPreloadedPredictionByRegion(
        prestoreDataset,
        targetRegion
      );

      if (localResult) {
        setPredictionResult(localResult);
        setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: localResult }));

        setPredictstep(2);
        message.success("Loaded precomputed prediction.");
        return true;
      }
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

 
      setPredictionResult(resultData);

      setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: resultData }));

      message.success("Prediction complete!");
      return true;
    } catch (e) {
      console.error(e);
      message.error("Prediction failed. Check server connection.");
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
    const localResult = await loadPreloadedPredictionByRegion(
      prestoreDataset,
      targetRegion
    );

    if (localResult) {
      setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: localResult }));

      return localResult;
    }
  }

  setInsightLoading(true);
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

    setInsightRegionCache((prev) => ({ ...prev, [targetRegion]: resultData }));

    return resultData;
  } finally {
    setInsightLoading(false);
  }
};

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
            <div data-tutorial="lab-upload-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="lab-upload-columns"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 220px',
                  gap: 16,
                  alignItems: 'stretch',
                }}
              >
                <div
                  data-tutorial="lab-upload-uploader"
                  className="lab-upload-column-panel"
                >
                  <Uploader
                    key={uploaderKey}
                    fillHeight
                    onAddFiles={(newFiles) => addIncomingFiles(newFiles)}
                  />
                </div>

                <div className="lab-upload-column-panel lab-preload-column-panel">
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, lineHeight: 1.35 }}>
                    Preloaded Datasets from Published Studies
                  </div>

                 <PreloadDatasetPicker
                  selectedKey={prestoreDataset}
                  isLoading={preloadLoading}
                  loadingKey={preloadLoadingKey}
                  onSelectDataset={(key: string | null) => {
                    if (!key) {
                      // 取消选择
                      setPrestoreDataset(null);
                      setPreloadLoading(false);
                      setPreloadLoadingKey(null);
                      setFiles([]);
                      setFileMappings([]);
                      setPredictionResult(null);
                      clearRegionPredictionCache();
                      setShowInsights(false);
                      setPredictstep(1);
                      return;
                    }

                    loadPrestoredDataset(key);
                  }}
                />

                {preloadLoading && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                    Loading stimuli...
                  </div>
                )}
                </div>
              </div>

              {isPreloadMode && <DatasetCardLab dataset={prestoreDataset} />}

              <div data-tutorial="lab-upload-images-panel">
                <ImagePreviewGroupedDnD
                  files={files}
                  title={inputMode === "preload" ? "Preloaded Images" : "Uploaded Images"}
                  groupDepth={1}
                  isPreload={isPreloadMode}
                  allowPreloadEditing={true}
                  tutorialCustomGroups={tutorialCustomGroups}
                  tutorialStateKey={tutorialUploadDemoMode}
                  onMoveItemToGroup={moveItemToGroup}
                  onRenameGroupKey={renameGroupKey}
                  onRemove={(uid: string) => removeOne(uid)}
                  onClear={() => clearAll()}
                  onClearGroup={(groupKey, uids) => clearGroup(uids)}
                  onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
                />
              </div>

              <div style={{ textAlign: 'right', color: 'black', fontWeight: 500 }}>
                📸 {files.length} images loaded
              </div>
            </div>
          ),
    },
    {
      title: 'Training Settings',
      content: (
        <div data-tutorial="lab-settings-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px'}}>
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
        <div data-tutorial="lab-results-panel" style={{ display: 'flex', flexDirection: 'column'}}>
          <RegionSelector
            region={region}
            setRegion={setRegion}
            dataset={dataset}
            tutorialRootKey="lab-results-region"
            activeTutorialKey="lab-results-region-active"
          />
          

          <ModelCard
            region={region}
            dataset={dataset}
            model={model}
          />

          <div data-tutorial="lab-results-upload-preview">
            <ImagePreviewGroupedDnD
              files={files}
              title="Uploaded Images Preview"
              groupDepth={1}
              isPreload={isPreloadMode}
              onMoveItemToGroup={moveItemToGroup}
              onRenameGroupKey={renameGroupKey}
              onRemove={(uid: string) => removeOne(uid)}
              onClear={() => clearAll()}
              onClearGroup={(groupKey, uids) => clearGroup(uids)}
              onGroupOrderChange={(order: string[]) => console.log("Group order:", order)}
              foldable={true}
              panelCollapsed={resultsPreviewCollapsed}
              onPanelCollapsedChange={setResultsPreviewCollapsed}
              tutorialCollapseToggleKey="lab-results-upload-preview-toggle"
              viewOnly={true}
            />
          </div>

          {predictionLoading && <LinearIndeterminate />} {/* add progress bar when predictionLoading is true */}
            <h3 style={{ textAlign: "left", color:"black", fontSize: "18px", marginBottom: "10px", marginTop: "40px"}}>
            <b>Univariate Analysis:</b> Predicted voxel average responses
            </h3>
            {barchartData.length > 0 && (
              <BarChart
                barChartData={barchartData}
                height={600}
                fileMappings={fileMappings}
                order={vizOrder}
                setOrder={setVizOrder}
                tutorialSelectedGroups={tutorialHighlightedResultGroups}
              />
            )}
            <h3 style={{ textAlign: "left", color:"black", fontSize: "18px", marginBottom: "6px", marginTop: "40px"}}><b>Multivariate Analysis:</b> Respresentational dissimilarity matrix (RDM) from predicted voxel responses</h3>
          {/* <Heatmap heatmapData={heatmapData} originalFilenames={originalFilenames} sortedFilenames={sortedFilenames} width={800} height={800} fileMappings={fileMappings}/> */}
          {barchartData.length <= 1 ? (
            <div style={{ textAlign: 'center', fontSize: '16px', color: '#888', fontStyle: 'italic' }}>
              RDM unavailable for one image. Please upload more than 2 images to see the visualization.
            </div>
          ) : (
            <Heatmap heatmapData={heatmapData} originalFilenames={originalFilenames} sortedFilenames={orderedFilenames} width={800} height={800} fileMappings={fileMappings} order={vizOrder} 
            />
          )}

          <div
            style={{
              marginTop: "32px",
              display: "flex",
              justifyContent: "left",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                textAlign: "left",
                color: "black",
                fontSize: "18px",
                margin: 0,
              }}
            >
              <b>Advanced Insights Across Regions</b>
            </h3>

            <Button
              data-tutorial="lab-results-get-insights"
              type="primary"
              onClick={handleGetInsights}
              loading={insightLoading}
              disabled={files.length === 0 || selectedInsightRegions.length === 0}
            >
              Get Insights
            </Button>
          </div>

          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'black' }}>ROI Selection:</span>
              <Button
                type="default"
                size="small"
                onClick={() => setSelectedInsightRegions(availableInsightRegions)}
              >
                Select All
              </Button>
              <Button
                type="default"
                size="small"
                onClick={() => setSelectedInsightRegions([])}
              >
                Clear
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableInsightRegions.map((r) => {
                const selected = selectedInsightRegions.includes(r);
                const label = REGION_OPTIONS.find((x) => x.value === r)?.label || r.toUpperCase();

                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleInsightRegion(r)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 16,
                      border: selected ? '1px solid var(--highlight-color-button)' : '1px solid #ccc',
                      background: selected ? 'var(--highlight-color-button)' : '#fff',
                      color: selected ? '#fff' : '#333',
                      padding: '4px 12px',
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {showInsights && (
            <div style={{ marginTop: "5px" }}>
              <BoxPlot
                regionDataMap={insightRegionDataMap}
                fileMappings={fileMappings}
                regionOrder={selectedInsightRegions}
                height={560}
              />
            </div>
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
        token: {
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
        components: {
          Steps: {
            colorPrimary: "var(--tungsten)", // Customize the primary color for Steps
          },
          Button: {
            colorPrimary: "var(--tungsten)",                 
            colorPrimaryHover: "var(--highlight-color-button)", 
            colorPrimaryActive: "var(--highlight-color-button)", 
          },
           Progress: {
            colorPrimary: "var(--highlight-color-button)",
          },
        },
      }}
    >
    <ThemeProvider theme={muiLabTheme}>
      <div data-tutorial="lab-stepper-nav">
        <Steps current={current} onChange={onChange}>
          {steps.map((item) => (
            <Step key={item.title} title={item.title} icon={item.icon} />
          ))}
        </Steps>
      </div>

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
            onClick={async () => {
              if (predictstep !== 1) {
                next();
                return;
              }

              const ok = await handlePrediction(region);
              if (ok) next();
            }}
            disabled={loading || predictionLoading || files.length === 0}
          >
            {loading || predictionLoading ? "Processing..." : "Check Prediction Results"}
          </Button>
        )}

        {current === steps.length - 1 && (
          <Button type="primary" onClick={downloadData} disabled={!currentRegionPredictionResult}>
            Download Data
          </Button>
        )}
      </div>
    </ThemeProvider>
    </ConfigProvider>
  </>
);
};

export default Stepper;
