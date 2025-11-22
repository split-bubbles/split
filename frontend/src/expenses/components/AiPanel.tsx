import React, { useState } from 'react';
import { parseReceipt, splitExpense } from '../../services/aiService';
import type { ParsedReceipt, SplitResult } from '../../services/aiService';

interface AiPanelProps {
  total: number;
  mode: 'equal' | 'custom';
  participants: { address: string; amount: number }[];
  selfAddress: string;
  onApplySplit: (allocations: { address: string; amount: number }[], selfAmount?: number) => void;
}

export const AiPanel: React.FC<AiPanelProps> = ({ total, mode, participants, selfAddress, onApplySplit }) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!imageData) return;
    setLoading(true); setError(null); setSplitResult(null);
    try {
      const receipt = await parseReceipt(imageData);
      setParsed(receipt);
      console.log('Parsed receipt', receipt);
    } catch (e: any) {
      // Silent failure: log minimal and show soft message, keep UI usable
      console.warn('AI parse failed', e);
      setError('Unable to parse. Enter details manually.');
    } finally { setLoading(false); }
  }

  async function handleSplit() {
    if (!parsed) return;
    setLoading(true); setError(null);
    try {
      const res = await splitExpense({
        parsed,
        instructions,
        participants: participants.map(p => ({ address: p.address, amount: mode === 'custom' ? p.amount : undefined })),
        selfAddress
      });
      setSplitResult(res);
      onApplySplit(res.allocations, res.selfAmount);
    } catch (e: any) {
      console.warn('AI split failed', e);
      setError('AI split unavailable. Adjust amounts manually.');
    } finally { setLoading(false); }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{
      marginTop: '20px',
      padding: '16px',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,41,59,0.85))',
      border: '1px solid #334155',
      borderRadius: '12px'
    }}>
      <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '14px', letterSpacing: '0.5px', fontWeight: 600, color: '#e2e8f0' }}>AI Receipt Assist</h3>
      <input type="file" accept="image/*" onChange={onFileChange} style={{ marginBottom: '10px' }} />
      {imageData && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#94a3b8' }}>Image loaded ({(imageData.length/1024).toFixed(1)} KB)</div>
      )}
      <textarea
        placeholder="Add instructions (e.g. exclude tax, split appetizers)..."
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        style={{
          width: '100%',
          minHeight: '70px',
          background: '#0f172a',
          color: '#f1f5f9',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '8px',
          fontSize: '13px',
          resize: 'vertical',
          marginBottom: '10px'
        }}
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleParse}
          disabled={!imageData || loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: !imageData ? '#1e293b' : 'linear-gradient(135deg,#1e3a8a,#2563eb)',
            opacity: loading ? 0.7 : 1,
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '8px',
            cursor: !imageData ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            letterSpacing: '0.5px'
          }}
        >Parse Receipt</button>
        <button
          onClick={handleSplit}
          disabled={!parsed || loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: !parsed ? '#1e293b' : 'linear-gradient(135deg,#0d9488,#14b8a6)',
            opacity: loading ? 0.7 : 1,
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '8px',
            cursor: !parsed ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            letterSpacing: '0.5px'
          }}
        >AI Split</button>
      </div>
      {error && <div style={{ marginTop: '10px', color: '#f87171', fontSize: '12px' }}>{error}</div>}
      {parsed && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Parsed Items ({parsed.items.length})</div>
          <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '8px', padding: '8px', background: 'rgba(15,23,42,0.6)' }}>
            {parsed.items.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', padding: '2px 0' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{it.description}</span>
                <span>{it.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {splitResult && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>AI Allocations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {splitResult.allocations.map(a => (
              <div key={a.address} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#cbd5e1' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{a.address.slice(0,6)}...{a.address.slice(-4)}</span>
                <span>{a.amount.toFixed(2)}</span>
              </div>
            ))}
            {splitResult.selfAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#10b981' }}>
                <span>You</span>
                <span>{splitResult.selfAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
