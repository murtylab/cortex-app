import type {
  EvidenceImage,
  EvidenceStats,
  EvidenceView,
  ModelRoiColumn,
  Roi,
  SelectedHeatmapCell,
  WideCsvRow,
} from '../types/data';
import { IMAGE_BASE_PATH } from './data';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNumericValue(value: string | number | undefined): number | null {
  if (isFiniteNumber(value)) {
    return value;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function median(values: number[]): number {
  const sortedValues = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
  }

  return sortedValues[midpoint];
}

function standardDeviation(values: number[], meanValue: number): number {
  if (values.length < 2) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function findModelRoiColumn(
  modelRoiColumns: ModelRoiColumn[],
  model: string,
  roi: Roi,
): ModelRoiColumn | null {
  return modelRoiColumns.find((column) => column.model === model && column.roi === roi) ?? null;
}

export function summarizeEvidence(values: number[]): EvidenceStats | null {
  if (values.length === 0) {
    return null;
  }

  const meanValue = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    max: Math.max(...values),
    min: Math.min(...values),
    mean: meanValue,
    median: median(values),
    standardDeviation: standardDeviation(values, meanValue),
  };
}

export function rankImagesByColumn(rows: WideCsvRow[], columnName: string): EvidenceImage[] {
  return rows
    .flatMap((row) => {
      const value = toNumericValue(row[columnName]);

      if (value === null || !row.image_name) {
        return [];
      }

      return {
        imageName: row.image_name,
        imageUrl: `${IMAGE_BASE_PATH}/${row.image_name}`,
        value,
        rank: 0,
      };
    })
    .sort((a, b) => b.value - a.value || a.imageName.localeCompare(b.imageName))
    .map((image, index) => ({
      ...image,
      rank: index + 1,
    }));
}

export function hasComparableData(
  model: string,
  roi: Roi,
  rows: WideCsvRow[],
  modelRoiColumns: ModelRoiColumn[],
  minimumValidValues = 1,
): boolean {
  const modelRoiColumn = findModelRoiColumn(modelRoiColumns, model, roi);

  if (!modelRoiColumn) {
    return false;
  }

  let validValueCount = 0;

  for (const row of rows) {
    if (toNumericValue(row[modelRoiColumn.columnName]) !== null) {
      validValueCount += 1;
    }

    if (validValueCount >= minimumValidValues) {
      return true;
    }
  }

  return false;
}

export function buildEvidenceView(
  selectedCell: SelectedHeatmapCell,
  rows: WideCsvRow[],
  modelRoiColumns: ModelRoiColumn[],
  imageLimit: number,
): EvidenceView | null {
  const modelRoiColumn = findModelRoiColumn(modelRoiColumns, selectedCell.model, selectedCell.roi);

  if (!modelRoiColumn) {
    return null;
  }

  const images = rankImagesByColumn(rows, modelRoiColumn.columnName);
  const stats = summarizeEvidence(images.map((image) => image.value));

  if (!stats) {
    return null;
  }

  return {
    columnName: modelRoiColumn.columnName,
    images,
    topImages: images.slice(0, imageLimit),
    bottomImages: images.slice(-imageLimit).reverse(),
    stats,
  };
}
