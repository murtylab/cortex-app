import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Checkbox,
  FormControl,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TRAINING_OPTIONS, TRAINING_OPTIONS_VS } from '../../constants-scoreboard';
import { filterAccordionSx, filterExpandIconSx, filterSummarySx, filterTitleSx } from './filterChrome';


const TrainingSelect = ({ training, setTraining, dataset, vsOption, expanded, onToggle }) => {
  
  // if vs option
  const isVSMode = !!vsOption;

  const options = isVSMode ?  TRAINING_OPTIONS_VS :TRAINING_OPTIONS ;

  const handleChange = (value) => {
    if (isVSMode) return;
    // must keep at least one selected
    setTraining((prev) => (prev === value ? prev : value));
  };

  return (
    //defaultExpanded (disabled default expand)
    <Accordion expanded={expanded} onChange={onToggle} disableGutters elevation={0} sx={filterAccordionSx}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={filterExpandIconSx} />}
        sx={filterSummarySx}
      >
        <Typography sx={filterTitleSx}>Training Dataset</Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: 2 }}>
        <FormControl component="fieldset" variant="standard" sx={{ width: '100%' }}>
          <FormGroup>
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    // is VS, mandatory select
                    checked={isVSMode ? true : training === option.value}
                    onChange={() => handleChange(option.value)}
                    // if VS, selected and blackout
                    disabled={isVSMode}
                    sx={{
                      '&.Mui-checked': { color: 'rgb(118, 128, 145)' },
                      '&.Mui-disabled': { 
                        color: isVSMode ? 'rgb(118, 128, 145)' : 'inherit',
                        opacity: isVSMode ? 0.8 : 1 
                      },
                    }}
                  />
                }
                label={<span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '12px', fontWeight: 400, color: 'var(--tungsten)' }}>{option.label}</span>}
              />
            ))}
          </FormGroup>
        </FormControl>
      </AccordionDetails>
    </Accordion>
  );
};

export default TrainingSelect;