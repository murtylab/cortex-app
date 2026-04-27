// chartselect.jsx
import React from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { CHART_TYPE_OPTIONS, RANK } from '../../constants-scoreboard';

const ChartSelect = ({ chartType, setChartType, rank, setRank, enable, showType = true }) => {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: 12,                
      width: "100%"            
    }}>
      
      {/* first group：Univariate vs Multivariate */}
      {showType && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: '11px', color: '#888', marginLeft: 2 }}>TYPE</div>
        <ButtonGroup size="small" fullWidth variant="outlined">
          {CHART_TYPE_OPTIONS.map((option) => (
            <Button
                key={option.value}
                onClick={() => setChartType(option.value)}
                variant={chartType === option.value ? "contained" : "outlined"}
                sx={{
                  fontSize: '12px',
                  padding: '4px 2px',
                  textTransform: 'none',

                  borderColor: "var(--tungsten)",
                  color: chartType === option.value
                    ? "white"
                    : "var(--tungsten)",

                  backgroundColor: chartType === option.value
                    ? "var(--tungsten)"
                    : "transparent",

                  // "&:hover": {
                  //   backgroundColor: "var(--accent-color)",
                  //   borderColor: "var(--tungsten)",
                  // }
                }}
              >
                 {option.label}
              </Button>
          ))}
        </ButtonGroup>
      </div>}

      {/* second group：rank */}
      {enable && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: '11px', color: '#888', marginLeft: 2 }}>RANKING</div>
          <ButtonGroup size="small" fullWidth variant="outlined">
            {RANK.map((option) => (
              <Button
                key={option.value}
                onClick={() => setRank(prev => prev === option.value ? "" : option.value)}
                variant={rank === option.value ? "contained" : "outlined"}
                // style={{ 
                //   fontSize: '12px', 
                //   padding: '4px 2px',
                //   textTransform: 'none'
                // }}
                sx={{
                  fontSize: '12px',
                  padding: '4px 2px',
                  textTransform: 'none',

                  borderColor: "var(--tungsten)",
                  color: rank === option.value
                    ? "white"
                    : "var(--tungsten)",

                  backgroundColor: rank === option.value
                    ? "var(--tungsten)"
                    : "transparent",

                  // "&:hover": {
                  //   backgroundColor: "var(--accent-color)",
                  //   borderColor: "var(--tungsten)",
                  // }
                }}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      )}
    </div>
  );
};

export default ChartSelect;