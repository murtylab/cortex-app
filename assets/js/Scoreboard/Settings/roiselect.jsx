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
import { ROI_OPTIONS } from '../../constants-scoreboard';

const ROISelect = ({ region, setRegion, dataset, setDataset, allowToggle, mode, training,expanded, onToggle, isVS }) => {
  // button logic group
  const ACROSS_VAL = 'Across Regions';
  const SPECIFIC_ROIS = ['ppa', 'ffa', 'eba'];

  const isEnabled = (option) => {
    const ds = Array.isArray(dataset) ? dataset : [];

    if (ds.length === 0) return true;

    // 2. 'Across Regions' (PPA) light all
    if (option.value === ACROSS_VAL || option.value === 'ppa') return true;

    // 3. ffa support list
    if (option.value === 'ffa') {
      
      return ds.some(d => !['bold_5000', 'bonner_2021'].includes(d));
    }

    // 4. eba support list
    if (option.value === 'eba') {
      
      const unsupportedForEBA = ['bold_5000', 'bonner_2021', 'kingbaker_2019', 'wardle_2020'];
      return ds.some(d => !unsupportedForEBA.includes(d));
    }

    return true;
  };


  // interactive logic
  const handleChange = (value) => {
    if (!isEnabled({ value })) return;

    setRegion((prev) => {
      // 
      const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      const isSelected = current.includes(value);
      
      let nextState = [];

      if (isVS) {
        return [value]; 
      }

      // 
      if (value === ACROSS_VAL) {
        if (isSelected) {
          // cancel the accross regions
          nextState = current.filter((v) => v !== value);
        } else {
          // clear all rois then selected accross regions
          nextState = [value];
        }
      } else if (SPECIFIC_ROIS.includes(value)) {
        if (isSelected) {
          // if it is roi then just cancel select
          nextState = current.filter((v) => v !== value);
        } else {
          // new roi then add it and cancel out accross rois
          const filtered = current.filter((v) => v !== ACROSS_VAL);
          nextState = [...filtered, value];
        }
      } else {
        // other
        nextState = isSelected 
          ? current.filter((v) => v !== value) 
          : [...current, value];
      }

      // non empty protect: always check across-region if it is empty
      if (nextState.length === 0) {
        return [ACROSS_VAL];
      }

      return nextState;
    });
  };


  const isChecked = (value) => Array.isArray(region) && region.includes(value);

  return (
    //defaultExpanded (disabled default expand)
    <Accordion  expanded={expanded}  onChange={onToggle}   disableGutters sx={{ bgcolor: 'transparent' }}> 
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: 'black' }} />}
        sx={{
          bgcolor: '#f5f5f5',
          borderRadius: 1,
          '&.Mui-expanded': { bgcolor: '#eaeaea' },
          minHeight: 40,
          px: 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 500, fontSize: '13px', color: 'var(--tungsten)' }}>Region of Interest</Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: 2 }}>
        <FormControl component="fieldset" variant="standard" sx={{ width: '100%' }}>
          <FormGroup sx={{ mt: 0.5 }}>
            {ROI_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={isChecked(option.value)}
                    onChange={() => handleChange(option.value)}
                    disabled={!isEnabled(option)}
                    sx={{
                      '&.Mui-checked': { color: '#615841' },
                      '&.Mui-disabled': { color: '#b0b0b0' },
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

export default ROISelect;