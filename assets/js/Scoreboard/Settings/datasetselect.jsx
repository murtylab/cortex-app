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
import { filterAccordionSx, filterExpandIconSx, filterSummarySx, filterTitleSx } from './filterChrome';
import {
  DATASET_OPTIONS,
  DATASET_OPTIONS_LESS,
  MURTY185_DATASET,
  NSD_DATASET,
} from '../../constants-scoreboard';

const DatasetSelect = ({ dataset, setDataset, training, region, allowToggle, mode, expanded, onToggle }) => {
  const options = mode === 4 ? DATASET_OPTIONS_LESS : DATASET_OPTIONS;

  const isEnabled = (option) => {
    if (training === 'Murty185' && !MURTY185_DATASET.includes(option.value)) return false;
    if (training === 'NSD' && !NSD_DATASET.includes(option.value)) return false;
    if (training === 'Murty185 VS NSD1000' && (option.value === 'murty185' || option.value === 'nsd1000')) return false;
    // if (
    //   Array.isArray(region) &&
    //   (region.includes('ffa') || region.includes('eba')) &&
    //   (option.value === 'bonner' || option.value === 'bold5000')
    // )
    //   return false;
    // if (Array.isArray(region) && region.includes('eba') && (option.value === 'kingbaker' || option.value === 'wardle'))
    //   return false;
    // return true;
    const r = Array.isArray(region) ? region : [];
    if (r.length === 0 || r.includes('Across Regions') || r.includes('ppa')) {
      return true;
    }

    
    // if supported by FFA
    const isSupportedByFFA = !['bold5000', 'bonner'].includes(option.value);
    
    // if supported by PPA 
    const isSupportedByEBA = !['bold5000', 'bonner', 'kingbaker', 'wardle'].includes(option.value);

    // or logic
    
    const hasFFA = r.includes('ffa');
    const hasEBA = r.includes('eba');

    return (hasFFA && isSupportedByFFA) || (hasEBA && isSupportedByEBA);
  };

  const handleChange = (value) => {
    if (!isEnabled({ value })) return;
    setDataset((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value]
    );
  };

  return (
    //defaultExpanded (disabled default expand)
    <Accordion expanded={expanded} onChange={onToggle} disableGutters elevation={0} sx={filterAccordionSx}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={filterExpandIconSx} />}
        sx={filterSummarySx}
      >
        <Typography sx={filterTitleSx}>Evaluation Dataset</Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: 2 }}>
        <FormControl component="fieldset" variant="standard" sx={{ width: '100%' }}>
          <FormGroup>
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={Array.isArray(dataset) && dataset.includes(option.value)}
                    onChange={() => handleChange(option.value)}
                    disabled={!isEnabled(option)}
                    sx={{
                      '&.Mui-checked': { color: 'rgb(111, 126, 121)' },
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

export default DatasetSelect;
