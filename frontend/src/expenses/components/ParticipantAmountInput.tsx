import React from 'react';
import { useEnsNameOptimistic } from '../../hooks/useEnsNameOptimistic';
import { baseSepolia, sepolia } from 'viem/chains';

interface ParticipantAmountInputProps {
  address: string;
  displayName?: string;
  amount: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

export const ParticipantAmountInput: React.FC<ParticipantAmountInputProps> = ({ address, displayName, amount, disabled, onChange }) => {
  const { data: ensName } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  const displayText = displayName || ensName || `${address.slice(0,6)}...${address.slice(-4)}`;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <span style={{ color: '#1a202c', fontSize: '13px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
      <input
        type="number"
        value={amount}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '90px',
          padding: '6px 8px',
          background: disabled ? '#e2e8f0' : '#ffffff',
          color: '#1a202c',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '13px'
        }}
      />
    </div>
  );
};
