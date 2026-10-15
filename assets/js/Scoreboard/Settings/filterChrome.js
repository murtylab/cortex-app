export const filterAccordionSx = {
  bgcolor: 'transparent',
  boxShadow: 'none',
  border: '1px solid var(--tungsten)',
  borderRadius: '4px',
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: 0 },
};

export const filterSummarySx = {
  bgcolor: 'transparent',
  minHeight: 36,
  px: 1.25,
  '& .MuiAccordionSummary-content': { my: 0.75 },
  '&.Mui-expanded': {
    bgcolor: 'transparent',
    minHeight: 36,
  },
};

export const filterTitleSx = {
  fontWeight: 500,
  fontSize: '12px',
  fontFamily: "'Inter', system-ui, sans-serif",
  color: 'var(--tungsten)',
};

export const filterExpandIconSx = { color: 'var(--tungsten)', fontSize: 18 };
