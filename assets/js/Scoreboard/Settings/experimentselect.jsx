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

function shortLabel(expKey) {
  // "berman_2017::main::PPA" → "berman_2017 [PPA]"
  const parts = expKey.split('::');
  const exp = parts[0] || expKey;
  const sub = parts[1] && parts[1] !== 'main' ? parts[1] : null;
  const roi = parts[2] && parts[2] !== 'ROI' ? parts[2] : null;
  let label = exp;
  if (sub) label += ` · ${sub}`;
  if (roi) label += ` [${roi}]`;
  return label;
}

const ExperimentSelect = ({ experiments, selectedExperiments, setSelectedExperiments, expanded, onToggle }) => {
  if (!experiments || experiments.length === 0) return null;

  const handleChange = (value) => {
    setSelectedExperiments(prev => {
      const current = Array.isArray(prev) ? prev : [];
      return current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
    });
  };

  const isChecked = (value) =>
    !Array.isArray(selectedExperiments) || selectedExperiments.length === 0
      ? false
      : selectedExperiments.includes(value);

  return (
    <Accordion expanded={expanded} onChange={onToggle} disableGutters sx={{ bgcolor: 'transparent' }}>
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
        <Typography sx={{ fontWeight: 500, fontSize: '13px', color: 'var(--tungsten)' }}>
          Experiment
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: 2 }}>
        <FormControl component="fieldset" variant="standard" sx={{ width: '100%' }}>
          <FormGroup sx={{ mt: 0.5 }}>
            {experiments.map((exp) => (
              <FormControlLabel
                key={exp}
                control={
                  <Checkbox
                    checked={isChecked(exp)}
                    onChange={() => handleChange(exp)}
                    sx={{ '&.Mui-checked': { color: 'rgb(118, 128, 145)' } }}
                  />
                }
                label={
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '11px', fontWeight: 400, color: 'var(--tungsten)' }}>
                    {shortLabel(exp)}
                  </span>
                }
              />
            ))}
          </FormGroup>
        </FormControl>
      </AccordionDetails>
    </Accordion>
  );
};

export default ExperimentSelect;
