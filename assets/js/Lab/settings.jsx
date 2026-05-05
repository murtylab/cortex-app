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
}) => {
  const sharedSelectSx = {
    backgroundColor: 'var(--background-color)',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(0,0,0,0.2)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--solid-pink)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'var(--solid-pink)',
      borderWidth: '1px',
    },
  };

  const sharedLabelSx = {
    backgroundColor: 'var(--background-color)',
    '&.Mui-focused': {
      color: 'var(--solid-pink)',
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
    backgroundColor: 'var(--background-color)',
    borderRadius: '4px',
    '& .MuiOutlinedInput-root': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgba(0,0,0,0.2)',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--solid-pink)',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--solid-pink)',
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
        backgroundColor: 'var(--background-color)',
        borderRadius: '8px',
        // width: { xs: '90%', sm: '50%', md: '30%', lg: '30%', xl: '30%' },
        width: '100%',
        marginRight: '0 auto',
        flexDirection: { xs: 'column !important', md: 'row !important', lg: 'row !important', xl: 'row !important' }
      }}
    >
      <Typography variant="body2" sx={{ textAlign: 'left', color: 'black', mt: 1, px: 2 }}>
        Advanced Settings:
      </Typography>

      {/* Model Selection */}
      <FormControl sx={{ m: 1, minWidth: 120, textAlign: 'left'}} fullWidth size="small">
        <InputLabel
          sx={sharedLabelSx}
          id="model-select-label"
        >
          Select a base-model architecture
        </InputLabel>
        <Select
          labelId="model-select-label"
          id="model-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          sx={sharedSelectSx}
          MenuProps={sharedMenuProps}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {MODEL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Dataset Selection */}
      <FormControl sx={{ m: 1, minWidth: 120, textAlign: 'left'}} fullWidth size="small">
        <InputLabel
          sx={sharedLabelSx}
          id="dataset-select-label"
        >
          Select the fMRI mapping dataset
        </InputLabel>
        <Select
          labelId="dataset-select-label"
          id="dataset-select"
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
          sx={sharedSelectSx}
          MenuProps={sharedMenuProps}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {DATASET_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Voxel Selection — fixed display */}
      <FormControl sx={{ m: 1, minWidth: 120, textAlign: 'left' }} fullWidth size="small">
        <InputLabel shrink sx={sharedLabelSx} id="voxel-select-label">
          Select Voxels
        </InputLabel>
        <Select
          labelId="voxel-select-label"
          value="all-participants"
          disabled
          sx={{
            ...sharedSelectSx,
            '& .MuiInputBase-input.Mui-disabled': {
              WebkitTextFillColor: 'var(--text-main)',
              opacity: 1,
            },
          }}
        >
          <MenuItem value="all-participants">All Participants</MenuItem>
        </Select>
      </FormControl>

    </FormGroup>
  );
};

export default Settings;
