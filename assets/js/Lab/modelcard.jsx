import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { MODEL_OPTIONS, MODELCARD_INFO_LOOKUP } from '../constants';

const ModelCard = ({ region, dataset, model, variant = 'default' }) => {
  const modelMeta = MODEL_OPTIONS.find(option => option.value === model);
  const modelName = modelMeta?.label || model;
  const modelType = modelMeta?.type || 'Unknown Model Type';
  const cardUrl = `/model-pages/${model}/`;

  const info = MODELCARD_INFO_LOOKUP[dataset]?.[region]?.[model];
  const { bestLayer = 'unknown', corrScore = 0 } = info || {
    bestLayer: 'unknown',
    corrScore: 0,
  };

  const isLab = variant === 'lab';
  const monoSx = isLab
    ? {
        fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
        fontWeight: 400,
      }
    : {
        fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)",
        fontWeight: 500,
      };
  const monoNumSx = isLab
    ? {
        fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
        fontWeight: 500,
      }
    : monoSx;

  return (
    <Box
      data-tutorial="lab-results-model-card"
      sx={{ minWidth: 250, borderRadius: '8px', marginTop: 2, marginBottom: 2 }}
    >
      <Card
        variant="outlined"
        sx={{
          borderRadius: '8px',
          boxShadow: 'none',
          border: isLab
            ? '0.5px solid var(--lab-hairline, #D6D2C6)'
            : '1px solid var(--hairline-color, rgba(60,55,48,0.14))',
          background: isLab
            ? 'var(--lab-panel, #FBFAF6)'
            : 'var(--background-color)',
        }}
      >
        <CardContent>
          <Typography
            sx={{
              fontSize: isLab ? 13 : 14,
              fontFamily: isLab ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
              fontWeight: isLab ? 400 : undefined,
              color: isLab ? 'var(--lab-secondary, #57534A)' : undefined,
            }}
            color={isLab ? undefined : 'text.secondary'}
            gutterBottom
          >
            Model Card
          </Typography>
          <Typography variant="h5" component="div">
            <Link
              data-tutorial="lab-results-model-card-link"
              href={cardUrl}
              underline="hover"
              sx={{
                fontFamily: isLab
                  ? "var(--lab-mono, 'IBM Plex Mono', monospace)"
                  : "var(--mono-font, 'IBM Plex Mono', monospace)",
                fontWeight: isLab ? 400 : 500,
                ...(isLab
                  ? {
                      background: 'var(--highlight-color)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }
                  : {
                      color: 'var(--accent-color, #5b3a6e)',
                    }),
              }}
            >
              {modelName}
            </Link>
          </Typography>
          <Typography
            sx={{
              mb: 1.5,
              fontFamily: isLab ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
              fontSize: isLab ? 13 : undefined,
              fontWeight: isLab ? 400 : undefined,
              color: isLab ? 'var(--lab-secondary, #57534A)' : undefined,
            }}
            color={isLab ? undefined : 'text.secondary'}
          >
            {modelType}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: isLab ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
              fontSize: isLab ? 14 : undefined,
              fontWeight: isLab ? 400 : undefined,
              lineHeight: isLab ? 1.6 : undefined,
              color: isLab ? 'var(--lab-text, #211F1C)' : undefined,
            }}
          >
            The optimal model layer for the selected ROI(
            <Box component="span" sx={monoSx}>{region.toUpperCase()}</Box>
            ):{' '}
            <Box component="span" sx={monoSx}>{bestLayer}</Box>,
            with highest correlation raw score:{' '}
            <Box component="span" sx={monoNumSx}>{Number(corrScore).toFixed(2)}</Box>,
            evaluated on the selected fMRI dataset:{' '}
            <Box component="span" sx={monoSx}>{dataset}</Box>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelCard;
