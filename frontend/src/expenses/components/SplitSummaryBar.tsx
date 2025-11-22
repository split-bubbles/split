import React from 'react';

interface SplitSummaryBarProps {
  total: number;
  allocated: number;
  mode: 'equal' | 'custom';
}

export const SplitSummaryBar: React.FC<SplitSummaryBarProps> = ({ total, allocated, mode }) => {
  const remaining = total - allocated;
  const pct = total > 0 ? Math.min(100, Math.max(0, (allocated / total) * 100)) : 0;
  return (
    <div style={{ marginTop: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid #334155', borderRadius: '10px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', letterSpacing: '0.5px', color: '#cbd5e1' }}>
        <span>Mode: {mode === 'equal' ? 'Equal' : 'Custom'}</span>
        <span>Allocated: {allocated.toFixed(2)} / {total.toFixed(2)}</span>
        <span style={{ color: remaining === 0 ? '#10b981' : '#f59e0b' }}>{remaining === 0 ? 'Balanced' : `Remaining: ${remaining.toFixed(2)}`}</span>
      </div>
      <div style={{ height: '8px', background: '#1e293b', borderRadius: '6px', overflow: 'hidden', border: '1px solid #475569' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#2563eb,#1e3a8a)', transition: 'width 0.25s' }} />
      </div>
    </div>
  );
};
