export type CanvasCard = {
  id: string;
  historyId: number;
  type: string;
  order: string;
  width?: string;
  x?: number; y?: number; w?: number; h?: number;
  palette?: string; colorLow?: string; colorHigh?: string; background?: string;
  colorMin?: number; colorMax?: number;
  showTitle?: boolean; title?: string; showLegend?: boolean; showLabels?: boolean;
  groupFilter?: string[];
  excludedFilenames?: string[];
  highlightedFilenames?: string[];
  highlightColor?: string;
};
