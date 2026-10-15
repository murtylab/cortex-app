import React from 'react';
import { Button } from 'antd';

const FilterSectionHeader = ({ hasFilters, onReset }) => (
  <div style={{ marginTop: 14 }}>
    <div
      style={{
        height: 1,
        background: 'rgba(66, 66, 66, 0.18)',
        margin: '0 2px 10px',
      }}
    />
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#888',
          marginLeft: 2,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        FILTER
      </div>
      <Button
        type="text"
        disabled={!hasFilters}
        onClick={onReset}
        size="small"
        style={{
          padding: '2px 8px',
          fontSize: '11px',
          fontFamily: "'Inter', system-ui, sans-serif",
          color: hasFilters ? 'var(--tungsten)' : '#bbb',
          border: `1px solid ${hasFilters ? 'var(--tungsten)' : '#ddd'}`,
          borderRadius: 6,
          height: 'auto',
          lineHeight: '18px',
        }}
      >
        Reset filters
      </Button>
    </div>
  </div>
);

export default FilterSectionHeader;
