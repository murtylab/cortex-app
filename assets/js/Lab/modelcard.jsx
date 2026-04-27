import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import { Typography, Link } from '@mui/material';
import { MODEL_OPTIONS, MODELCARD_INFO_LOOKUP } from '../constants';

const ModelCard = ({ region, dataset, model }) => {
  console.log("ModelCard: model:", model, "region:", region, "dataset:", dataset);

  const getInfo = (dataset, region, model) => {
    console.log(MODELCARD_INFO_LOOKUP[dataset]?.[region]?.[model]);
    return MODELCARD_INFO_LOOKUP[dataset]?.[region]?.[model] || { bestLayer: 'unknown', corrScore: 0 };
  };

  const modelMeta = MODEL_OPTIONS.find(option => option.value === model);
  const modelName = modelMeta?.label || model;
  const modelType = modelMeta?.type || 'Unknown Model Type';
  const cardUrl = `/model-pages/${model}.html`;

  const { bestLayer, corrScore } = getInfo(dataset, region, model);

  return (
    <Box sx={{ minWidth: 250, boxShadow: 3, borderRadius: 2, marginTop: 2 , marginBottom: 2}}>
      <Card variant="outlined" sx={{ borderRadius: 2, background: 'var(--background-color)'}}>
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Model Card
          </Typography>
          <Typography variant="h5" component="div">
            <Link href={cardUrl} underline="hover"
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
          <Typography variant="body2">
            The optimal model layer for the selected ROI({region.toUpperCase()}):{' '}
            <strong>{bestLayer}</strong>,
            with highest correlation raw score: <strong>{corrScore.toFixed(2)}</strong>,
            evaluated on the selected fMRI dataset: <strong>{dataset}</strong>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelCard;
