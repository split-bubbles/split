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
    <div style={{ marginTop: '16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '10px', fontSize: '14px', letterSpacing: '0.3px', color: '#1a202c', fontWeight: 500 }}>
        <span style={{ flex: 1 }}>{mode === 'equal' ? 'Split equally' : 'Custom amounts'}</span>
        <span style={{ whiteSpace: 'nowrap' }}>${allocated.toFixed(2)} of ${total.toFixed(2)}</span>
        <span style={{ color: remaining === 0 ? '#10b981' : '#f59e0b', whiteSpace: 'nowrap', fontWeight: 600 }}>{remaining === 0 ? '✓ Balanced' : `$${remaining.toFixed(2)} left`}</span>
      </div>
      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#16a34a,#10b981)', transition: 'width 0.25s' }} />
      </div>
    </div>
  );
};
