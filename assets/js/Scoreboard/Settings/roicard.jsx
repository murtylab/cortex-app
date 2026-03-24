import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { ROICARD_OPTIONS, ROICARD_INFO_LOOKUP } from '../../constants-scoreboard';

const ROICard = ({ region }) => {
  console.log("ROICard: region:", region);

  const getInfo = (roi) => {
    return (
      ROICARD_INFO_LOOKUP[roi] || {
        description: "No description available.",
        cardUrl: "#",
      }
    );
  };

  const roiMeta = ROICARD_OPTIONS.find(option => option.value === region);
  const roiName = roiMeta?.label || region?.toUpperCase() || "ROI";

  const { description, cardUrl } = getInfo(region);

  return (
    <Box sx={{ minWidth: 300, boxShadow: 3, borderRadius: 2, my: 2}}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            ROI Card
          </Typography>

          <Typography variant="h5" component="div">
            <Link href={cardUrl} target="_blank" rel="noopener noreferrer" underline="hover">
              {roiName}
            </Link>
          </Typography>

          <Typography sx={{ mt: 1 }} variant="body2">
            {description}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ROICard;