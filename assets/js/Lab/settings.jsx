// Settings.jsx
import React from 'react';
import {
  FormGroup,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Typography,
  Select,
} from '@mui/material';

import {
  MODEL_OPTIONS,
  DATASET_OPTIONS,
  VOXEL_OPTIONS,
} from '../constants';

const Settings = ({
  model,
  setModel,
  dataset,
  setDataset,
  voxelOption,
  setVoxelOption,
  voxelNumber,
  setVoxelNumber,
  participantName,
  setParticipantName,
  variant = 'default',
}) => {
  const isLab = variant === 'lab';
  const isWholeBrain = variant === 'wholebrain';
  const locked = isWholeBrain;
  const accent = isLab ? 'var(--lab-accent, #4A2E5C)' : 'var(--solid-pink)';
  const hairline = isLab ? 'var(--lab-hairline, #D6D2C6)' : 'rgba(0,0,0,0.2)';
  const bg = isLab ? 'var(--lab-panel, #FBFAF6)' : 'var(--background-color)';

  const sharedSelectSx = {
    backgroundColor: bg,
    fontFamily: isLab ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
    fontSize: isLab ? 15 : undefined,
    fontWeight: isLab ? 500 : undefined,
    borderRadius: isLab ? '5px' : undefined,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: hairline,
      borderWidth: isLab ? '0.5px' : '1px',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: locked ? hairline : accent,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: locked ? hairline : accent,
      borderWidth: '1px',
    },
    '& .MuiSelect-select': {
      fontSize: isLab ? 15 : undefined,
    },
  };

  const disabledSelectSx = {
    ...sharedSelectSx,
    '& .MuiInputBase-input.Mui-disabled': {
      WebkitTextFillColor: '#888',
      opacity: 1,
      cursor: 'not-allowed',
    },
    '&.Mui-disabled': {
      backgroundColor: '#f0f0f0',
    },
  };

  const sharedLabelSx = {
    backgroundColor: bg,
    fontFamily: isLab ? "var(--lab-sans, 'Inter', sans-serif)" : undefined,
    fontSize: isLab ? '15px !important' : undefined,
    fontWeight: isLab ? 500 : undefined,
    '&.Mui-focused': {
      color: accent,
    },
  };

  const sharedMenuProps = {
    PaperProps: {
      sx: {
        '& .MuiMenuItem-root.Mui-selected': {
          backgroundColor: 'color-mix(in srgb, var(--solid-pink), transparent 80%)',
          color: 'var(--text-main)',
        },
        '& .MuiMenuItem-root.Mui-selected:hover': {
          backgroundColor: 'color-mix(in srgb, var(--solid-pink), transparent 72%)',
        },
      },
    },
  };

  const sharedTextFieldSx = {
    marginTop: 2,
    backgroundColor: bg,
    borderRadius: isLab ? '5px' : '4px',
    '& .MuiOutlinedInput-root': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: hairline,
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: accent,
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: accent,
      },
    },
  };

  return (
    <FormGroup
      sx={{
        gap: 1,
        padding: 0,
        margintop: 2,
        marginLeft: 0,
        backgroundColor: isLab ? 'transparent' : 'var(--background-color)',
        borderRadius: '8px',
        width: '100%',
        marginRight: '0 auto',
        flexDirection: { xs: 'column !important', md: 'row !important', lg: 'row !important', xl: 'row !important' }
      }}
    >
      {isLab ? (
        <Typography
          id="lab-advanced-settings-label"
          component="div"
          className="lab-eyebrow"
          sx={{ textAlign: 'center', mt: 1, px: 0, width: '100%' }}
        >
          Advanced settings
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ textAlign: 'left', color: 'black', mt: 1, px: 2 }}>
          Advanced Settings:
        </Typography>
      )}

      {/* Model Selection */}
      <FormControl data-tutorial="lab-settings-model" sx={{ m: 1, minWidth: 120, textAlign: 'left'}} fullWidth size="small">
        <InputLabel
          shrink={locked || undefined}
          sx={sharedLabelSx}
          id="model-select-label"
        >
          {isLab ? 'Base-model architecture' : 'Select a base-model architecture'}
        </InputLabel>
        <Select
          labelId="model-select-label"
          id="model-select"
          value={locked ? 'clip_rn50' : model}
          onChange={locked ? undefined : (e) => setModel(e.target.value)}
          disabled={locked}
          sx={locked ? disabledSelectSx : sharedSelectSx}
          MenuProps={sharedMenuProps}
        >
          {locked ? (
            <MenuItem value="clip_rn50">CLIP</MenuItem>
          ) : (
            [
              <MenuItem key="none" value="">
                <em>None</em>
              </MenuItem>,
              ...MODEL_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>

      {/* Dataset Selection */}
      <FormControl data-tutorial="lab-settings-training" sx={{ m: 1, minWidth: 120, textAlign: 'left'}} fullWidth size="small">
        <InputLabel
          shrink={locked || undefined}
          sx={sharedLabelSx}
          id="dataset-select-label"
        >
          {isLab ? 'fMRI mapping dataset' : 'Select the fMRI mapping dataset'}
        </InputLabel>
        <Select
          labelId="dataset-select-label"
          id="dataset-select"
          value={locked ? 'nsd_1000' : dataset}
          onChange={locked ? undefined : (e) => setDataset(e.target.value)}
          disabled={locked}
          sx={locked ? disabledSelectSx : sharedSelectSx}
          MenuProps={sharedMenuProps}
        >
          {locked ? (
            <MenuItem value="nsd_1000">NSD</MenuItem>
          ) : (
            [
              <MenuItem key="none" value="">
                <em>None</em>
              </MenuItem>,
              ...DATASET_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>

      {/* Voxel Selection — fixed display */}
      <FormControl sx={{ m: 1, minWidth: 120, textAlign: 'left' }} fullWidth size="small">
        <InputLabel shrink sx={sharedLabelSx} id="voxel-select-label">
          {isLab ? 'Voxels' : 'Select Voxels'}
        </InputLabel>
        <Select
          labelId="voxel-select-label"
          value={locked ? 'subject1' : 'all-participants'}
          disabled
          sx={disabledSelectSx}
        >
          {locked ? (
            <MenuItem value="subject1">subject1</MenuItem>
          ) : (
            <MenuItem value="all-participants">{isLab ? 'All participants' : 'All Participants'}</MenuItem>
          )}
        </Select>
      </FormControl>

    </FormGroup>
  );
};

export default Settings;
