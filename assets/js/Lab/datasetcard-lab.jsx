import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { PRELOAD_DATASETS } from '../constants';

const DatasetCardLab = ({ dataset }) => {
  const { label, stimuli, paperLink, papername } = PRELOAD_DATASETS[dataset] || {
    label: dataset || 'Unknown Dataset',
    stimuli: 'No stimuli information available.',
    paperLink: '#',
    papername: 'Unknown Paper',
  };

  return (
    <Box className="lab-dataset-card-wrap" sx={{ marginTop: 2 }}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: '8px',
          boxShadow: 'none',
          border: '0.5px solid var(--lab-hairline, #D6D2C6)',
          background: 'var(--lab-panel, #FBFAF6)',
        }}
      >
        <CardContent className="lab-model-card lab-dataset-card">
          <p className="lab-section-label">Paper Card</p>
          <a
            className="lab-model-card-name"
            href={paperLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
          <p className="lab-model-card-type">{papername}</p>

          <div className="lab-dataset-card-body">
            <span className="lab-model-card-rank-scope">Stimuli</span>
            <p className="lab-dataset-card-stimuli">{stimuli}</p>
          </div>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatasetCardLab;
