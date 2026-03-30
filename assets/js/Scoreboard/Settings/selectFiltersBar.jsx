import React from 'react';
import { Tag } from 'antd';

const SelectedFiltersBar = ({ training, region, dataset, modelType, clearSingle, onTagClick }) => {
  const selected = [];

  // order: training region dataset
  if (training) selected.push({ key: 'training', label: training, color: 'rgb(45, 53, 67)' });

  if (Array.isArray(region) && region.length > 0) {
    region.forEach((r) => {
      selected.push({ key: `region-${r}`, label: r.toUpperCase(), color: '#615841' });
    });
  }

  if (Array.isArray(dataset) && dataset.length > 0) {
    dataset.forEach((r) => {
      selected.push({ key: `dataset-${r}`, label: r.toUpperCase(), color: 'rgb(111, 126, 121)' });
    });
  }

  if (Array.isArray(modelType) && modelType.length > 0) {
    modelType.forEach((m) => {
      selected.push({ key: `modelType-${m}`, label: m.toUpperCase(), color: 'rgb(129, 95, 117)' });
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0,
        padding: '0',
        minHeight: 30, 
        alignItems: 'center',
      }}
    >
      {selected.map((item) => (
        <Tag
          key={item.key}
          color={item.color}
          closable
          // 点击 Tag 主体时，根据 key 的前缀判断展开哪个面板
          onClick={() => {
            const type = item.key.startsWith('region') ? 'region' : 
                         item.key.startsWith('dataset') ? 'dataset' : 'training';
            onTagClick(type);
          }}
          onClose={(e) => {
            e.stopPropagation();
            // region/ dataset support single remove
            if (item.key.startsWith('region-')) {
              const r = item.key.replace('region-', '');
              clearSingle('region', r);
            } 
            else if (item.key.startsWith('dataset-')) {
              const r = item.key.replace('dataset-', '');
              clearSingle('dataset', r);
            } else {
              clearSingle(item.key);
            }
          }}
          style={{
            borderRadius: 20,
            padding: '4px 12px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.95em',
          }}
        >
          {item.label}
        </Tag>
      ))}
    </div>
  );
};

export default SelectedFiltersBar;
