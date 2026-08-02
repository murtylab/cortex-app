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
  const cardUrl = `/model-pages/${model}/`;

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

  const monoSx = { fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)", fontWeight: 600 };

  return (
    <Box sx={{ minWidth: 250, borderRadius: "8px", marginTop: 2, marginBottom: 2 }}>
      <Card
        variant="outlined"
        sx={{ borderRadius: "8px", boxShadow: "none", border: "1px solid var(--hairline-color, rgba(60,55,48,0.14))", background: 'var(--background-color)' }}
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
                fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)",
                fontWeight: 600,
                color: "var(--accent-color, #5b3a6e)",
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
                The optimal model layer for the selected ROI (<Box component="span" sx={monoSx}>{String(item.region).toUpperCase()}</Box>):{' '}
                <Box component="span" sx={monoSx}>{item.bestLayer}</Box>, with highest correlation raw score:{' '}
                <Box component="span" sx={monoSx}>{Number(item.corrScore).toFixed(2)}</Box>, evaluated on the selected
                fMRI dataset: <Box component="span" sx={monoSx}>{item.dataset}</Box>
              </Typography>
            ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelCardScoreboard;