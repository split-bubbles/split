import React from 'react';

interface SplitModeSelectorProps {
  mode: 'equal' | 'custom';
  onChange: (mode: 'equal' | 'custom') => void;
}

export const SplitModeSelector: React.FC<SplitModeSelectorProps> = ({ mode, onChange }) => {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
      <button
        onClick={() => onChange('equal')}
        style={{
          padding: '6px 12px',
          background: mode === 'equal' ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : '#1f2937',
          color: '#f1f5f9',
          border: '1px solid #334155',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          letterSpacing: '0.5px',
          transition: 'background 0.2s'
        }}
      >
        Split Equally
      </button>
      <button
        onClick={() => onChange('custom')}
        style={{
          padding: '6px 12px',
          background: mode === 'custom' ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : '#1f2937',
          color: '#f1f5f9',
          border: '1px solid #334155',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          letterSpacing: '0.5px',
          transition: 'background 0.2s'
        }}
      >
        Custom Split
      </button>
    </div>
  );
};
