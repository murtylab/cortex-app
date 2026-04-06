import React from 'react';
import { Select, Typography } from 'antd';
import { ADVANCED_QUESTION } from '../../constants-scoreboard';

const { Text } = Typography;

const QuestionSelect = ({ value, onChange }) => {
  return (
    <div
      style={{
        flex: '0 0 auto',
        background: 'var(--background-color, #f7f7f4)',
        borderRadius: 8,
        border: '1px solid #e0ddd8',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: '#6b4a8c', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.03em' }}>
        Insight Question
      </Text>

      <Select
        value={value}
        onChange={onChange}
        placeholder="Select a question to analyze"
        style={{ width: '420px', fontFamily: "'Inter', system-ui, sans-serif" }}
        bordered={false}
        dropdownStyle={{ borderRadius: 8, fontFamily: "'Inter', system-ui, sans-serif" }}
        options={ADVANCED_QUESTION}
      />
    </div>
  );
};

export default QuestionSelect;