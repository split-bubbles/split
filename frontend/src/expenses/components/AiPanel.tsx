import React, { useState } from 'react';
import { parseReceipt, splitExpense } from '../../services/aiService';
import type { ParsedReceipt, SplitResult } from '../../services/aiService';

interface AiPanelProps {
  mode: 'equal' | 'custom';
  participants: { address: string; amount: number }[];
  selfAddress: string;
  onApplySplit: (allocations: { address: string; amount: number }[], selfAmount?: number) => void;
}

export const AiPanel: React.FC<AiPanelProps> = ({ mode, participants, selfAddress, onApplySplit }) => {
  const [imageData, setImageData] = useState<string | null>(null); // base64
  const [imageUrl, setImageUrl] = useState<string>('');
  const [instructions, setInstructions] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorPlan, setPriorPlan] = useState<any>(null);

  async function handleUnifiedSplit() {
    if (participants.length === 0) return; // nothing to split
    setLoading(true); setError(null); setSplitResult(null);
    let effectiveParsed: ParsedReceipt | null = parsed;
    // If we have an image and haven't parsed yet, attempt parse first
    if (!effectiveParsed && (imageData || imageUrl)) {
      try {
        effectiveParsed = await parseReceipt(imageData ? { base64Image: imageData } : { imageUrl });
        setParsed(effectiveParsed);
      } catch (e: any) {
        console.error('Cannot parse image', e);
        setError(e.message || 'Failed to parse receipt image.');
        setLoading(false);
        return; // Abort split if parse failed
      }
    }
    try {
      const res = await splitExpense({
        parsed: effectiveParsed || { items: [] },
        instructions,
        participants: participants.map(p => ({ address: p.address, amount: mode === 'custom' ? p.amount : undefined })),
        selfAddress,
        priorPlan
      });
      setSplitResult(res);
      onApplySplit(res.allocations, res.selfAmount);
      setPriorPlan(res.rawPlan);
      setError(null); // Clear any previous errors
    } catch (e: any) {
      console.error('Unified AI split failed', e);
      setError(e.message || 'AI split failed. Please try again or adjust amounts manually.');
    } finally { setLoading(false); }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  }

  const hasImage = !!imageData || !!imageUrl;

  return (
    <div style={{
      marginTop: '20px',
      padding: '16px',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,41,59,0.85))',
      border: '1px solid #334155',
      borderRadius: '12px'
    }}>
      <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '14px', letterSpacing: '0.5px', fontWeight: 600, color: '#e2e8f0' }}>AI Receipt Assist</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <label htmlFor="ai-upload" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '14px 10px',
              border: '2px dashed #475569',
              borderRadius: '10px',
              background: hasImage ? 'rgba(15,23,42,0.6)' : 'rgba(30,41,59,0.4)',
              cursor: 'pointer'
            }}>
              {hasImage ? (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Change Image</span>
              ) : (
                <>
                  <span style={{ fontSize: '26px' }}>🧾📄</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Browse receipt</span>
                </>
              )}
              <input id="ai-upload" type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
            </label>
          </div>
          <input
            type="text"
            placeholder="Or paste image URL"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '12px'
            }}
          />
        </div>
        {hasImage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {imageData && <img src={imageData} alt="preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155' }} />}
            {!imageData && imageUrl && <img src={imageUrl} alt="preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155' }} />}
            <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageUrl || 'Image loaded (' + (imageData ? (imageData.length/1024).toFixed(1)+' KB' : '') + ')'}</span>
            <button
              onClick={() => { setImageData(null); setImageUrl(''); setParsed(null); }}
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#f87171', fontSize: '11px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
            >✕ Remove</button>
          </div>
        )}
      </div>
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
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={handleUnifiedSplit}
          disabled={loading || participants.length === 0 || !!error}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'linear-gradient(90deg,#16a34a,#0d9488)',
            boxShadow: '0 0 0 1px #0d9488, 0 4px 12px -2px rgba(13,148,136,0.4)',
            opacity: loading ? 0.75 : 1,
            color: '#f1f5f9',
            fontWeight: 600,
            border: 'none',
            borderRadius: '10px',
            cursor: loading || participants.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            letterSpacing: '0.5px'
          }}
        >{loading ? 'Working...' : priorPlan ? '♻️ Refine Split' : '✨ AI Split'}</button>
        {loading && (
          <div style={{ width: 24, height: 24, position: 'relative' }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              border: '3px solid #0d9488', borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite'
            }} />
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
          {(splitResult.openQuestions && splitResult.openQuestions.length > 0) && (
            <div style={{ marginTop: '10px', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '8px', padding: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Open Questions</div>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {splitResult.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
          {splitResult.summary && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>Summary: {splitResult.summary}</div>
          )}
        </div>
      )}
    </div>
  );
};
