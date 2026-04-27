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
import { MODEL_TYPE_OPTIONS } from '../../constants-scoreboard';

const ModelTypeSelect = ({
  modelType,
  setModelType,
  allowToggle,
  mode,
  expanded,
  onToggle,
}) => {
  const options = MODEL_TYPE_OPTIONS;

  const isEnabled = (option) => {
    return true;
  };

  const handleChange = (value) => {
    if (!isEnabled({ value })) return;
    setModelType((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value]
    );
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      sx={{ bgcolor: 'transparent' }}
    >
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
          Model Type
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pl: 2 }}>
        <FormControl component="fieldset" variant="standard" sx={{ width: '100%' }}>
          <FormGroup sx={{ gap: 0.5 }}>
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                sx={{ alignItems: 'flex-start', margin: 0 }}
                control={
                  <Checkbox
                    checked={Array.isArray(modelType) && modelType.includes(option.value)}
                    onChange={() => handleChange(option.value)}
                    disabled={!isEnabled(option)}
                    sx={{
                      padding: '6px',
                      marginRight: 1,
                      marginTop: '1px',
                      '&.Mui-checked': { color: 'rgb(129, 95, 117)' },
                      '&.Mui-disabled': { color: '#b0b0b0' },
                    }}
                  />
                }
                label={<span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '12px', fontWeight: 400, lineHeight: 1.3, marginTop: '2px', color: 'var(--tungsten)', display: 'inline-block' }}>{option.label}</span>}
              />
            ))}
          </FormGroup>
        </FormControl>
      </AccordionDetails>
    </Accordion>
  );
};

export default ModelTypeSelect;