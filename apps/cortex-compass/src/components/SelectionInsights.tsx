import { useMemo } from 'react';
import type { AggregateHeatmapCell, EvidenceView, ModelRoiColumn, SelectedHeatmapCell, WideCsvRow } from '../types/data';
import {
  type CellRecommendation,
  findClosestCellsInRoi,
  findMostOverlappingCells,
  findSameModelAcrossRois,
} from '../utils/discovery';
import { inferModelCategory } from '../utils/modelTags';

type SelectionInsightsProps = {
  selectedCell: SelectedHeatmapCell;
  evidenceView: EvidenceView | null;
  heatmapCells: AggregateHeatmapCell[];
  rows: WideCsvRow[];
  modelRoiColumns: ModelRoiColumn[];
  imageLimit: number;
  onSelectCell: (cell: SelectedHeatmapCell) => void;
};

function formatScore(score: number | null): string {
  return score === null ? 'Unavailable' : score.toFixed(3);
}

function formatDifference(value: number | null): string {
  if (value === null) {
    return 'Unavailable';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function overlapSummary(recommendation: CellRecommendation): string | null {
  const summaries: string[] = [];

  if (recommendation.topOverlapImages.length > 0) {
    summaries.push(`${recommendation.topOverlapImages.length} shared top`);
  }

  if (recommendation.bottomOverlapImages.length > 0) {
    summaries.push(`${recommendation.bottomOverlapImages.length} shared bottom`);
  }

  return summaries.length > 0 ? summaries.join(' • ') : null;
}

function sharedImageSnippet(recommendation: CellRecommendation): string | null {
  const names = [...recommendation.topOverlapImages, ...recommendation.bottomOverlapImages]
    .map((image) => image.imageName)
    .filter((name, index, collection) => collection.indexOf(name) === index)
    .slice(0, 2);

  return names.length > 0 ? names.join(', ') : null;
}

function RecommendationList({
  title,
  subtitle,
  recommendations,
  onSelectCell,
}: {
  title: string;
  subtitle: string;
  recommendations: CellRecommendation[];
  onSelectCell: (cell: SelectedHeatmapCell) => void;
}) {
  return (
    <section className="insight-section" aria-label={title}>
      <div className="insight-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{recommendations.length} cells</span>
      </div>
      {recommendations.length === 0 ? (
        <p className="compare-empty">No matching cells were available for this view.</p>
      ) : (
        <div className="discovery-list">
          {recommendations.map((recommendation) => {
            const overlap = overlapSummary(recommendation);
            const sharedImages = sharedImageSnippet(recommendation);

            return (
              <button
                key={recommendation.cell.id}
                type="button"
                className="discovery-card"
                onClick={() => onSelectCell(recommendation.cell)}
              >
                <div className="discovery-card-header">
                  <strong>
                    {recommendation.cell.roi} / {recommendation.cell.model}
                  </strong>
                  <span className="model-tag">{inferModelCategory(recommendation.cell.model)}</span>
                </div>
                <div className="discovery-badge-row">
                  <span>Score {formatScore(recommendation.cell.score)}</span>
                  <span>Δ {formatDifference(recommendation.aggregateScoreDifference)}</span>
                  {overlap && <span>{overlap}</span>}
                </div>
                {sharedImages && <p>Shared images: {sharedImages}</p>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SelectionInsights({
  selectedCell,
  evidenceView,
  heatmapCells,
  rows,
  modelRoiColumns,
  imageLimit,
  onSelectCell,
}: SelectionInsightsProps) {
  const scoredCellsInRoi = useMemo(
    () => heatmapCells.filter((cell) => cell.roi === selectedCell.roi && cell.score !== null),
    [heatmapCells, selectedCell.roi],
  );
  const topMean = evidenceView ? mean(evidenceView.topImages.map((image) => image.value)) : null;
  const bottomMean = evidenceView ? mean(evidenceView.bottomImages.map((image) => image.value)) : null;
  const contrast = topMean !== null && bottomMean !== null ? topMean - bottomMean : null;
  const roiPercentile =
    selectedCell.rankWithinRoi !== null && scoredCellsInRoi.length > 0
      ? ((scoredCellsInRoi.length - selectedCell.rankWithinRoi + 1) / scoredCellsInRoi.length) * 100
      : null;

  const closestInRoi = useMemo(
    () => findClosestCellsInRoi(selectedCell, heatmapCells),
    [heatmapCells, selectedCell],
  );
  const sameModelAcrossRois = useMemo(
    () => findSameModelAcrossRois(selectedCell, heatmapCells),
    [heatmapCells, selectedCell],
  );
  const overlappingCells = useMemo(
    () => findMostOverlappingCells(selectedCell, evidenceView, heatmapCells, rows, modelRoiColumns, imageLimit),
    [evidenceView, heatmapCells, imageLimit, modelRoiColumns, rows, selectedCell],
  );

  // UI removed as per requirements
  return null;
}
