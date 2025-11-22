import React from 'react';

interface ParticipantAmountInputProps {
  address: string;
  displayName?: string;
  amount: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

export const ParticipantAmountInput: React.FC<ParticipantAmountInputProps> = ({ address, displayName, amount, disabled, onChange }) => {
  const short = displayName || `${address.slice(0,6)}...${address.slice(-4)}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(30,41,59,0.6)', border: '1px solid #334155', borderRadius: '8px' }}>
      <span style={{ color: '#e2e8f0', fontSize: '13px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short}</span>
      <input
        type="number"
        value={amount}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '90px',
          padding: '6px 8px',
          background: disabled ? 'rgba(51,65,85,0.4)' : '#0f172a',
          color: '#f1f5f9',
          border: '1px solid #475569',
          borderRadius: '6px',
          fontSize: '13px'
        }}
      />
    </div>
  );
};
