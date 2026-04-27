import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { MODEL_OPTIONS } from '../../constants';
import { MODELCARD_INFO_LOOKUP } from '../../constants-scoreboard';

const ModelCardScoreboard = ({ region, dataset, model, evalDataset }) => {
  console.log("ModelCard: model:", model, "region:", region, "dataset:", dataset);
  console.log("evalDataset:", evalDataset);

  const getInfo = (datasets, regions, model) => {
    const datasetList = Array.isArray(datasets) ? datasets : [datasets];
    const regionList = Array.isArray(regions) ? regions : [regions];

    const results = [];

    datasetList.forEach((datasetItem) => {
      regionList.forEach((regionItem) => {
        if (regionItem === "Across Regions") {
          ["ppa", "ffa", "eba"].forEach((roi) => {
            const info =
              MODELCARD_INFO_LOOKUP[datasetItem]?.[roi]?.[model] || {
                bestLayer: "unknown",
                corrScore: 0,
              };

            results.push({
              dataset: datasetItem,
              region: roi,
              model,
              ...info,
            });
          });
        } else {
          const normalizedRegion = regionItem?.toLowerCase?.() || regionItem;

          const info =
            MODELCARD_INFO_LOOKUP[datasetItem]?.[normalizedRegion]?.[model] || {
              bestLayer: "unknown",
              corrScore: 0,
            };

          results.push({
            dataset: datasetItem,
            region: normalizedRegion,
            model,
            ...info,
          });
        }
      });
    });

    return results;
  };

  const modelMeta = MODEL_OPTIONS.find(option => option.value === model);
  const modelName = modelMeta?.label || model;
  const modelType = modelMeta?.type || 'Unknown Model Type';
  const cardUrl = `/model-pages/${model}.html`;

  const datasetList = Array.isArray(dataset) ? dataset : [dataset];
  const regionList = Array.isArray(region) ? region : [region];
  const evalDatasetList = Array.isArray(evalDataset) ? evalDataset : [evalDataset];

  const hasDataset = datasetList.filter(Boolean).length > 0;
  const hasRegion = regionList.filter(Boolean).length > 0;
  const hasEvalDataset = evalDatasetList.filter(Boolean).length > 0;

  const canShowLayerInfo = hasDataset && hasRegion && hasEvalDataset;

  const infoList = canShowLayerInfo ? getInfo(dataset, region, model) : [];

  const dedupedInfoList = Array.from(
    new Map(
      infoList.map((item) => [
        `${item.dataset}-${item.region}-${item.model}`,
        item,
      ])
    ).values()
  );

  let helperText = "";
  if (!canShowLayerInfo) {
    helperText =
      "Please select a region, a training dataset, and an evaluation dataset to view layer information.";
  }

  return (
    <Box sx={{ minWidth: 250, boxShadow: 3, borderRadius: 2, marginTop: 2 , marginBottom: 2}}>
      <Card
        variant="outlined"
        sx={{ borderRadius: 2, background: 'var(--background-color)' }}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Model Card
          </Typography>

          <Typography variant="h5" component="div">
            <Link
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{
                background: "var(--highlight-color)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {modelName}
            </Link>
          </Typography>

          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            {modelType}
          </Typography>

          {!canShowLayerInfo && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {helperText}
            </Typography>
          )}

          {canShowLayerInfo &&
            dedupedInfoList.map((item, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                The optimal model layer for the selected ROI ({String(item.region).toUpperCase()}):{' '}
                <strong>{item.bestLayer}</strong>, with highest correlation raw score:{' '}
                <strong>{Number(item.corrScore).toFixed(2)}</strong>, evaluated on the selected
                fMRI dataset: <strong>{item.dataset}</strong>
              </Typography>
            ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelCardScoreboard;