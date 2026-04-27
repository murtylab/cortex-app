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
    if (training === 'Murty185 VS NSD1000' && (option.value === 'murty185' || option.value === 'nsd_1000')) return false;
    // if (
    //   Array.isArray(region) &&
    //   (region.includes('ffa') || region.includes('eba')) &&
    //   (option.value === 'bonner_2021' || option.value === 'bold_5000')
    // )
    //   return false;
    // if (Array.isArray(region) && region.includes('eba') && (option.value === 'kingbaker_2019' || option.value === 'wardle_2020'))
    //   return false;
    // return true;
    const r = Array.isArray(region) ? region : [];
    if (r.length === 0 || r.includes('Across Regions') || r.includes('ppa')) {
      return true;
    }

    
    // if supported by FFA
    const isSupportedByFFA = !['bold_5000', 'bonner_2021'].includes(option.value);
    
    // if supported by PPA 
    const isSupportedByEBA = !['bold_5000', 'bonner_2021', 'kingbaker_2019', 'wardle_2020'].includes(option.value);

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
    <Accordion expanded={expanded}  onChange={onToggle}  disableGutters sx={{ bgcolor: 'transparent' }}>
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
        <Typography sx={{ fontWeight: 500, fontSize: '13px', color: 'var(--tungsten)' }}>Evaluation Dataset</Typography>
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
