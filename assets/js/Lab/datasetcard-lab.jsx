import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { PRELOAD_DATASETS } from '../constants';

const DatasetCardLab = ({ dataset }) => {
  const getInfo = (datasetKey) => {
    return PRELOAD_DATASETS[datasetKey] || {
      label: datasetKey || 'Unknown Dataset',
      stimuli: 'No stimuli information available.',
      expectation: 'No expected outcome available.',
      paperLink: '#',
      papername: 'Unknown Paper',
    };
  };

  const { label, stimuli, paperLink, papername } = getInfo(dataset);
  const monoSx = {
    fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
    fontWeight: 400,
  };

  return (
    <Box sx={{ minWidth: 250, borderRadius: '8px', marginTop: 2, marginBottom: 2 }}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: '8px',
          boxShadow: 'none',
          border: '0.5px solid var(--lab-hairline, #D6D2C6)',
          background: 'var(--lab-panel, #FBFAF6)',
        }}
      >
        <CardContent>
          <Typography
            sx={{
              fontSize: 13,
              fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
              fontWeight: 400,
              color: 'var(--lab-secondary, #57534A)',
            }}
            gutterBottom
          >
            Dataset Card
          </Typography>

          <Typography variant="h5" component="div">
            <Link
              href={paperLink}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{
                fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
                fontWeight: 400,
                background: 'var(--highlight-color)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {label}
            </Link>
          </Typography>

          <Typography
            sx={{
              mb: 1.5,
              fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--lab-secondary, #57534A)',
            }}
          >
            Paper: {papername}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.6,
              color: 'var(--lab-text, #211F1C)',
            }}
          >
            Stimuli: <Box component="span" sx={monoSx}>{stimuli}</Box>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatasetCardLab;
