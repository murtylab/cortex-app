import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { PRELOAD_DATASETS } from '../constants';

const DatasetCardLab = ({ dataset }) => {
  console.log("DatasetCardLab: dataset:", dataset);

  const getInfo = (datasetKey) => {
    return PRELOAD_DATASETS[datasetKey?.toLowerCase()] || {
      label: datasetKey || 'Unknown Dataset',
      stimuli: 'No stimuli information available.',
      expectation: 'No expected outcome available.',
      paperLink: '#',
      papername: 'Unknown Paper',
    };
  };

  const { label, stimuli, expectation, paperLink, papername } = getInfo(dataset);

  return (
    <Box sx={{ minWidth: 250, boxShadow: 3, borderRadius: 2, marginTop: 2 , marginBottom: 2 }}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          background: 'var(--background-color)',
        }}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Dataset Card
          </Typography>

          <Typography variant="h5" component="div">
            <Link href={paperLink} target="_blank" rel="noopener noreferrer" underline="hover"
              sx={{
              background: "var(--highlight-color)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            >
                {label}
            </Link>
           
          </Typography>

          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            Paper: {papername}
           
          </Typography>

          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            Stimuli: {stimuli}
          </Typography>

          <Typography variant="body2">
            Paper Expected Outcome: {expectation}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatasetCardLab;