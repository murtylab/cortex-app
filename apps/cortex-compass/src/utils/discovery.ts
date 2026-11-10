import type {
  AggregateHeatmapCell,
  EvidenceImage,
  EvidenceView,
  JsonScoreObject,
  ModelRoiColumn,
  Roi,
  SelectedHeatmapCell,
  WideCsvRow,
} from '../types/data';
import { buildEvidenceView } from './evidence';

export type CellRecommendation = {
  cell: AggregateHeatmapCell;
  aggregateScoreDifference: number | null;
  topOverlapImages: EvidenceImage[];
  bottomOverlapImages: EvidenceImage[];
};

export type CompareNeighborRecommendation = {
  cell: AggregateHeatmapCell;
  overlapWithA: number;
  overlapWithB: number;
  combinedOverlap: number;
};

export type RoiPairModelSummary = {
  model: string;
  roiAScore: number;
  roiBScore: number;
  meanScore: number;
  gap: number;
};

export type RoiSimilarityPair = {
  id: string;
  roiA: Roi;
  roiB: Roi;
  correlation: number | null;
  sharedModels: number;
  sharedTopModels: RoiPairModelSummary[];
  divergentModels: RoiPairModelSummary[];
};

function absDifference(aValue: number | null, bValue: number | null): number | null {
  if (aValue === null || bValue === null) {
    return null;
  }

  return Math.abs(aValue - bValue);
}

function compareNullableNumbers(aValue: number | null, bValue: number | null): number {
  if (aValue === null && bValue === null) {
    return 0;
  }

  if (aValue === null) {
    return 1;
  }

  if (bValue === null) {
    return -1;
  }

  return aValue - bValue;
}

function intersectImages(referenceImages: EvidenceImage[], candidateImages: EvidenceImage[]): EvidenceImage[] {
  const candidateNames = new Set(candidateImages.map((image) => image.imageName));
  return referenceImages.filter((image) => candidateNames.has(image.imageName));
}

function buildCellRecommendation(
  selectedCell: SelectedHeatmapCell,
  candidateCell: AggregateHeatmapCell,
  topOverlapImages: EvidenceImage[] = [],
  bottomOverlapImages: EvidenceImage[] = [],
): CellRecommendation {
  return {
    cell: candidateCell,
    aggregateScoreDifference: absDifference(selectedCell.score, candidateCell.score),
    topOverlapImages,
    bottomOverlapImages,
  };
}

function compareOverlapRecommendations(a: CellRecommendation, b: CellRecommendation): number {
  const aCombinedOverlap = a.topOverlapImages.length + a.bottomOverlapImages.length;
  const bCombinedOverlap = b.topOverlapImages.length + b.bottomOverlapImages.length;

  return (
    bCombinedOverlap - aCombinedOverlap ||
    b.topOverlapImages.length - a.topOverlapImages.length ||
    compareNullableNumbers(a.aggregateScoreDifference, b.aggregateScoreDifference) ||
    a.cell.model.localeCompare(b.cell.model) ||
    a.cell.roi.localeCompare(b.cell.roi)
  );
}

export function findClosestCellsInRoi(
  selectedCell: SelectedHeatmapCell,
  cells: AggregateHeatmapCell[],
  limit = 4,
): CellRecommendation[] {
  return cells
    .filter((candidateCell) => candidateCell.id !== selectedCell.id && candidateCell.roi === selectedCell.roi && candidateCell.score !== null)
    .map((candidateCell) => buildCellRecommendation(selectedCell, candidateCell))
    .sort(
      (a, b) =>
        compareNullableNumbers(a.aggregateScoreDifference, b.aggregateScoreDifference) ||
        (b.cell.score ?? Number.NEGATIVE_INFINITY) - (a.cell.score ?? Number.NEGATIVE_INFINITY) ||
        a.cell.model.localeCompare(b.cell.model),
    )
    .slice(0, limit);
}

export function findSameModelAcrossRois(
  selectedCell: SelectedHeatmapCell,
  cells: AggregateHeatmapCell[],
): CellRecommendation[] {
  return cells
    .filter((candidateCell) => candidateCell.id !== selectedCell.id && candidateCell.model === selectedCell.model)
    .map((candidateCell) => buildCellRecommendation(selectedCell, candidateCell))
    .sort(
      (a, b) =>
        compareNullableNumbers(a.aggregateScoreDifference, b.aggregateScoreDifference) ||
        a.cell.roi.localeCompare(b.cell.roi),
    );
}

export function findMostOverlappingCells(
  selectedCell: SelectedHeatmapCell,
  selectedEvidence: EvidenceView | null,
  cells: AggregateHeatmapCell[],
  rows: WideCsvRow[],
  modelRoiColumns: ModelRoiColumn[],
  imageLimit: number,
  limit = 4,
): CellRecommendation[] {
  if (!selectedEvidence) {
    return [];
  }

  return cells
    .filter((candidateCell) => candidateCell.id !== selectedCell.id)
    .flatMap((candidateCell) => {
      const candidateEvidence = buildEvidenceView(candidateCell, rows, modelRoiColumns, imageLimit);
      if (!candidateEvidence) {
        return [];
      }

      const topOverlapImages = intersectImages(selectedEvidence.topImages, candidateEvidence.topImages);
      const bottomOverlapImages = intersectImages(selectedEvidence.bottomImages, candidateEvidence.bottomImages);

      if (topOverlapImages.length === 0 && bottomOverlapImages.length === 0) {
        return [];
      }

      return buildCellRecommendation(selectedCell, candidateCell, topOverlapImages, bottomOverlapImages);
    })
    .sort(compareOverlapRecommendations)
    .slice(0, limit);
}

export function findSharedCompareNeighbors(
  cellA: SelectedHeatmapCell,
  evidenceA: EvidenceView | null,
  cellB: SelectedHeatmapCell,
  evidenceB: EvidenceView | null,
  cells: AggregateHeatmapCell[],
  rows: WideCsvRow[],
  modelRoiColumns: ModelRoiColumn[],
  imageLimit: number,
  limit = 5,
): CompareNeighborRecommendation[] {
  if (!evidenceA || !evidenceB) {
    return [];
  }

  return cells
    .filter((candidateCell) => candidateCell.id !== cellA.id && candidateCell.id !== cellB.id)
    .flatMap((candidateCell) => {
      const candidateEvidence = buildEvidenceView(candidateCell, rows, modelRoiColumns, imageLimit);
      if (!candidateEvidence) {
        return [];
      }

      const overlapWithA =
        intersectImages(evidenceA.topImages, candidateEvidence.topImages).length +
        intersectImages(evidenceA.bottomImages, candidateEvidence.bottomImages).length;
      const overlapWithB =
        intersectImages(evidenceB.topImages, candidateEvidence.topImages).length +
        intersectImages(evidenceB.bottomImages, candidateEvidence.bottomImages).length;
      const combinedOverlap = overlapWithA + overlapWithB;

      if (combinedOverlap === 0) {
        return [];
      }

      return {
        cell: candidateCell,
        overlapWithA,
        overlapWithB,
        combinedOverlap,
      };
    })
    .sort(
      (a, b) =>
        b.combinedOverlap - a.combinedOverlap ||
        Math.min(b.overlapWithA, b.overlapWithB) - Math.min(a.overlapWithA, a.overlapWithB) ||
        (b.cell.score ?? Number.NEGATIVE_INFINITY) - (a.cell.score ?? Number.NEGATIVE_INFINITY) ||
        a.cell.model.localeCompare(b.cell.model),
    )
    .slice(0, limit);
}

function finiteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pearsonCorrelation(aValues: number[], bValues: number[]): number | null {
  if (aValues.length < 2 || bValues.length !== aValues.length) {
    return null;
  }

  const aMean = aValues.reduce((sum, value) => sum + value, 0) / aValues.length;
  const bMean = bValues.reduce((sum, value) => sum + value, 0) / bValues.length;

  let numerator = 0;
  let aDenominator = 0;
  let bDenominator = 0;

  for (let index = 0; index < aValues.length; index += 1) {
    const aCentered = aValues[index] - aMean;
    const bCentered = bValues[index] - bMean;
    numerator += aCentered * bCentered;
    aDenominator += aCentered * aCentered;
    bDenominator += bCentered * bCentered;
  }

  if (aDenominator === 0 || bDenominator === 0) {
    return null;
  }

  return numerator / Math.sqrt(aDenominator * bDenominator);
}

export function buildRoiSimilarityPairs(scores: JsonScoreObject, rois: Roi[], models: string[]): RoiSimilarityPair[] {
  const pairs: RoiSimilarityPair[] = [];

  for (let aIndex = 0; aIndex < rois.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < rois.length; bIndex += 1) {
      const roiA = rois[aIndex];
      const roiB = rois[bIndex];
      const sharedScores = models
        .flatMap((model) => {
          const roiAScore = scores[roiA]?.[model];
          const roiBScore = scores[roiB]?.[model];

          if (!finiteScore(roiAScore) || !finiteScore(roiBScore)) {
            return [];
          }

          return {
            model,
            roiAScore,
            roiBScore,
            meanScore: (roiAScore + roiBScore) / 2,
            gap: Math.abs(roiAScore - roiBScore),
          };
        });

      const correlation = pearsonCorrelation(
        sharedScores.map((score) => score.roiAScore),
        sharedScores.map((score) => score.roiBScore),
      );

      pairs.push({
        id: `${roiA}__${roiB}`,
        roiA,
        roiB,
        correlation,
        sharedModels: sharedScores.length,
        sharedTopModels: [...sharedScores]
          .sort((a, b) => b.meanScore - a.meanScore || a.model.localeCompare(b.model))
          .slice(0, 3),
        divergentModels: [...sharedScores]
          .sort((a, b) => b.gap - a.gap || a.model.localeCompare(b.model))
          .slice(0, 3),
      });
    }
  }

  return pairs.sort(
    (a, b) =>
      (b.correlation ?? Number.NEGATIVE_INFINITY) - (a.correlation ?? Number.NEGATIVE_INFINITY) ||
      b.sharedModels - a.sharedModels,
  );
}
