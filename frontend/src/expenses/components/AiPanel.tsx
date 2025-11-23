import React, { useState } from 'react';
import { parseReceipt, splitExpense } from '../../services/aiService';
import type { ParsedReceipt, SplitResult } from '../../services/aiService';

interface AiPanelProps {
  mode: 'equal' | 'custom';
  participants: { ens: string; owes: number; paid?: number }[]; // participants now identified by ENS
  selfAddress: string;
  onApplySplit: (allocations: { address: string; amount: number }[], selfAmount?: number) => void;
  // Persisted state props (optional for backward compatibility)
  imageData?: string | null;
  imageUrl?: string;
  instructions?: string;
  parsed?: ParsedReceipt | null;
  splitResult?: SplitResult | null;
  loading?: boolean;
  error?: string | null;
  priorPlan?: any;
  // State setters
  onImageDataChange?: (value: string | null) => void;
  onImageUrlChange?: (value: string) => void;
  onInstructionsChange?: (value: string) => void;
  onParsedChange?: (value: ParsedReceipt | null) => void;
  onSplitResultChange?: (value: SplitResult | null) => void;
  onLoadingChange?: (value: boolean) => void;
  onErrorChange?: (value: string | null) => void;
  onPriorPlanChange?: (value: any) => void;
}

export const AiPanel: React.FC<AiPanelProps> = ({ 
  mode, 
  participants, 
  selfAddress, 
  onApplySplit,
  imageData: propImageData,
  imageUrl: propImageUrl,
  instructions: propInstructions,
  parsed: propParsed,
  splitResult: propSplitResult,
  loading: propLoading,
  error: propError,
  priorPlan: propPriorPlan,
  onImageDataChange,
  onImageUrlChange,
  onInstructionsChange,
  onParsedChange,
  onSplitResultChange,
  onLoadingChange,
  onErrorChange,
  onPriorPlanChange,
}) => {
  // Use props if provided, otherwise use local state
  const [localImageData, setLocalImageData] = useState<string | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string>('');
  const [localInstructions, setLocalInstructions] = useState('');
  const [localParsed, setLocalParsed] = useState<ParsedReceipt | null>(null);
  const [localSplitResult, setLocalSplitResult] = useState<SplitResult | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localPriorPlan, setLocalPriorPlan] = useState<any>(null);

  // Use controlled state if props are provided, otherwise use local state
  const imageData = propImageData !== undefined ? propImageData : localImageData;
  const imageUrl = propImageUrl !== undefined ? propImageUrl : localImageUrl;
  const instructions = propInstructions !== undefined ? propInstructions : localInstructions;
  const parsed = propParsed !== undefined ? propParsed : localParsed;
  const splitResult = propSplitResult !== undefined ? propSplitResult : localSplitResult;
  const loading = propLoading !== undefined ? propLoading : localLoading;
  const error = propError !== undefined ? propError : localError;
  const priorPlan = propPriorPlan !== undefined ? propPriorPlan : localPriorPlan;

  // Wrapper functions that update either parent state or local state
  const setImageData = (value: string | null) => {
    if (onImageDataChange) {
      onImageDataChange(value);
    } else {
      setLocalImageData(value);
    }
  };

  const setImageUrl = (value: string) => {
    if (onImageUrlChange) {
      onImageUrlChange(value);
    } else {
      setLocalImageUrl(value);
    }
  };

  const setInstructions = (value: string) => {
    if (onInstructionsChange) {
      onInstructionsChange(value);
    } else {
      setLocalInstructions(value);
    }
  };

  const setParsed = (value: ParsedReceipt | null) => {
    if (onParsedChange) {
      onParsedChange(value);
    } else {
      setLocalParsed(value);
    }
  };

  const setSplitResult = (value: SplitResult | null) => {
    if (onSplitResultChange) {
      onSplitResultChange(value);
    } else {
      setLocalSplitResult(value);
    }
  };

  const setLoading = (value: boolean) => {
    if (onLoadingChange) {
      onLoadingChange(value);
    } else {
      setLocalLoading(value);
    }
  };

  const setError = (value: string | null) => {
    if (onErrorChange) {
      onErrorChange(value);
    } else {
      setLocalError(value);
    }
  };

  const setPriorPlan = (value: any) => {
    if (onPriorPlanChange) {
      onPriorPlanChange(value);
    } else {
      setLocalPriorPlan(value);
    }
  };

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
        participants: participants.map(p => ({
          ens: p.ens,
          owes: mode === 'custom' ? p.owes : undefined,
          paid: p.paid
        })),
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
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px'
    }}>
      <h3 style={{ margin: 0, marginBottom: '12px', fontSize: '14px', letterSpacing: '0.5px', fontWeight: 600, color: '#1a202c' }}>AI Receipt Assist</h3>
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
              border: '2px dashed #e2e8f0',
              borderRadius: '10px',
              background: hasImage ? '#f1f5f9' : '#fafbfc',
              cursor: 'pointer'
            }}>
              {hasImage ? (
                <span style={{ fontSize: '11px', color: '#64748b' }}>Change Image</span>
              ) : (
                <>
                  <span style={{ fontSize: '26px' }}>🧾📄</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Browse receipt</span>
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
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#1a202c',
              fontSize: '12px'
            }}
          />
        </div>
        {hasImage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {imageData && <img src={imageData} alt="preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />}
            {!imageData && imageUrl && <img src={imageUrl} alt="preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />}
            <span style={{ fontSize: '11px', color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageUrl || 'Image loaded (' + (imageData ? (imageData.length/1024).toFixed(1)+' KB' : '') + ')'}</span>
            <button
              onClick={() => { setImageData(null); setImageUrl(''); setParsed(null); }}
              style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#ef4444', fontSize: '11px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}
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
          background: '#f1f5f9',
          color: '#1a202c',
          border: '1px solid #e2e8f0',
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
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Parsed Items ({parsed.items.length})</div>
          <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f1f5f9' }}>
            {parsed.items.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#1a202c', padding: '2px 0' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{it.description}</span>
                <span>{it.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {splitResult && (
        <div style={{ marginTop: '14px' }}>
          {(splitResult.summary || splitResult.notes) && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px 12px',
              background: '#f1f5f9', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px',
              fontSize: '12px', 
              color: '#1a202c',
              lineHeight: '1.5'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>AI Summary</div>
              <div>{splitResult.summary || splitResult.notes}</div>
            </div>
          )}
          {(splitResult.openQuestions && splitResult.openQuestions.length > 0) && (
            <div style={{ marginTop: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Open Questions</div>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#1a202c', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {splitResult.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
