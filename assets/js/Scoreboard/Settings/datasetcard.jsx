import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { DATASETCARD_OPTIONS, DATASETCARD_INFO_LOOKUP } from '../../constants-scoreboard';

const DatasetCard = ({ dataset }) => {
  console.log("DatasetCard: dataset:", dataset);

  const getInfo = (dataset) => {
    return DATASETCARD_INFO_LOOKUP[dataset] || { category: '', size: 'unknown', subjects: 0, description: '', cardUrl: '#' };
  };

  const datasetMeta = DATASETCARD_OPTIONS.find(option => option.value === dataset);
  const datasetName = datasetMeta?.label || dataset;

  const { category, size, subjects, description, cardUrl } = getInfo(dataset);

  return (
    <Box sx={{ minWidth: 250, boxShadow: 3, borderRadius: 2, my: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Dataset Card
          </Typography>
          <Typography variant="h5" component="div">
            <Link href={cardUrl} target="_blank" rel="noopener noreferrer" underline="hover">
              {datasetName}
            </Link>
          </Typography>
{/*           <Typography sx={{ mb: 1.5 }} color="text.secondary">
            Category: {category}  
          </Typography> */}
          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            Stimuli Num: {size} with {subjects} Subjects
          </Typography>
          <Typography variant="body2">
            {description || "No description available."}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatasetCard;