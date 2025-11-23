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
          background: mode === 'equal' ? 'linear-gradient(135deg,#16a34a,#10b981)' : '#f1f5f9',
          color: mode === 'equal' ? '#ffffff' : '#1a202c',
          border: '1px solid #e2e8f0',
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
          background: mode === 'custom' ? 'linear-gradient(135deg,#16a34a,#10b981)' : '#f1f5f9',
          color: mode === 'custom' ? '#ffffff' : '#1a202c',
          border: '1px solid #e2e8f0',
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
