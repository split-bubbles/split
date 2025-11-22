import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { useState, useEffect } from "react";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useReadContract } from "../hooks/useReadContract";
import { type Address } from "viem";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import FriendNameDisplay from "../friends/FriendNameDisplay";
import { SplitModeSelector } from "./components/SplitModeSelector";
import { ParticipantAmountInput } from "./components/ParticipantAmountInput";
import { SplitSummaryBar } from "./components/SplitSummaryBar";
import { AiPanel } from "./components/AiPanel";

interface AddExpenseProps { openTrigger?: number; isModal?: boolean }

function AddExpense({ openTrigger, isModal = false }: AddExpenseProps) {
  const { evmAddress: currentAddress } = useEvmAddress();
  const [isOpen, setIsOpen] = useState(false);
  const [lastTrigger, setLastTrigger] = useState(0);
  const [selectedFriends, setSelectedFriends] = useState<Set<Address>>(new Set());
  const [friends, setFriends] = useState<Address[]>([]);
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [participantSplits, setParticipantSplits] = useState<Map<Address, number>>(new Map());
  const [selfSplit, setSelfSplit] = useState(0);
  const [showAIOptions, setShowAIOptions] = useState(false);

  const { data: contractFriends } = useReadContract({
    address: currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "getFriends",
    args: currentAddress ? [currentAddress] : undefined,
    query: { enabled: !!currentAddress, refetchInterval: 5000 }
  });
  useEffect(() => { if (contractFriends) setFriends(contractFriends as Address[]); }, [contractFriends]);

  useEffect(() => {
    if (splitMode === "equal" && totalAmount && selectedFriends.size > 0) {
      const total = parseFloat(totalAmount);
      if (!isNaN(total)) {
        const perPerson = total / (selectedFriends.size + 1);
        const map = new Map<Address, number>();
        selectedFriends.forEach(f => map.set(f, perPerson));
        setParticipantSplits(map);
        setSelfSplit(perPerson);
      }
    }
  }, [splitMode, totalAmount, selectedFriends]);

  useEffect(() => { 
    if (openTrigger && openTrigger > 0 && openTrigger !== lastTrigger) {
      setLastTrigger(openTrigger);
      setIsOpen(true);
    }
  }, [openTrigger, lastTrigger]);

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    setSelectedFriends(new Set());
    setDescription("");
    setTotalAmount("");
    setSplitMode("equal");
    setSelfSplit(0);
    setParticipantSplits(new Map());
    setShowAIOptions(false);
  };

  const handleToggleFriend = (friend: Address) => {
    setSelectedFriends(prev => { const next = new Set(prev); next.has(friend) ? next.delete(friend) : next.add(friend); return next; });
  };
  const updateParticipantAmount = (address: Address, amount: number) => { if (splitMode === "equal") return; setParticipantSplits(new Map(participantSplits.set(address, amount))); };
  const updateSelfAmount = (amount: number) => { if (splitMode === "equal") return; setSelfSplit(amount); };
  const handleApplyAIActions = (allocs: { address: string; amount: number }[], selfAmount?: number) => {
    const map = new Map<Address, number>();
    allocs.forEach(a => { const addr = a.address as Address; if (selectedFriends.has(addr)) map.set(addr, a.amount); });
    setParticipantSplits(map); if (typeof selfAmount === 'number') setSelfSplit(selfAmount); setSplitMode('custom');
  };
  const handleSaveExpense = () => {
    if (selectedFriends.size === 0) { alert("Select at least one friend."); return; }
    if (!description.trim()) { alert("Enter description."); return; }
    const total = parseFloat(totalAmount); if (!total || total <= 0) { alert("Enter valid total."); return; }
    console.log("Expense saved", { description, totalAmount: total, selectedFriends: Array.from(selectedFriends), splitMode, participantSplits: Object.fromEntries(participantSplits), selfSplit });
    alert("Expense recorded! (Pending on-chain implementation)"); handleCancel();
  };

  const enteredTotal = parseFloat(totalAmount || "0") || 0;
  const totalFriends = Array.from(participantSplits.values()).reduce((s, v) => s + v, 0);
  const totalSplit = totalFriends + selfSplit;

  if (!isOpen) {
    if (isModal) {
      return null; // Don't show anything in modal when closed
    }
    return (
      <>
        <div className="section-header"><h3>Create Expense</h3></div>
        <div className="card card--add-expense">
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>💸</span>
            <h2 className="card-title" style={{ marginBottom: "0.5rem" }}>New Expense</h2>
            <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>Split bills with friends using AI or manual entry</p>
            <Button type="button" onClick={() => setIsOpen(true)} className="tx-button" style={{ background: "linear-gradient(135deg,#0052FF,#3b82f6)", color: "white", fontSize: "1rem", fontWeight: 600, width: "100%", maxWidth: "300px" }}>✨ Start New Expense</Button>
          </div>
        </div>
      </>
    );
  }

  const content = (
    <div className="card card--add-expense" style={{ maxWidth: "100%", height: isModal ? "auto" : "100vh", maxHeight: isModal ? "90vh" : "100vh", display: "flex", flexDirection: "column", padding: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.25rem", borderBottom: "1px solid #334155", backgroundColor: "#0f172a", color: "#e2e8f0" }}>
        <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Add an expense</h2>
        <button onClick={(e) => handleCancel(e)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#e2e8f0", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", backgroundColor: "#0f172a" }}>
        <div className="flex-col-container" style={{ gap: "1.5rem" }}>
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <label style={{ fontSize: "0.75rem", letterSpacing: "0.5px", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>With you and:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {friends.length === 0 ? <p style={{ color: "#64748b", fontSize: "0.75rem" }}>Add friends first to split expenses</p> : friends.map(f => (
                <button key={f} onClick={() => handleToggleFriend(f)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.7rem", borderRadius: "18px", border: selectedFriends.has(f) ? "1px solid #1cc29f" : "1px solid #475569", backgroundColor: "#1e293b", cursor: "pointer", fontSize: "0.7rem", color: "#e2e8f0", fontWeight: 500 }}>
                  <FriendNameDisplay address={f} />{selectedFriends.has(f) && <span>✕</span>}
                </button>))}
            </div>
          </div>
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.85rem", border: "1px solid #334155", borderRadius: "0.5rem", backgroundColor: "#1e293b" }}>
              <span style={{ fontSize: "1.5rem" }}>📝</span>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "#f1f5f9" }} />
            </div>
          </div>
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.85rem", border: "1px solid #334155", borderRadius: "0.5rem", backgroundColor: "#1e293b" }}>
              <span style={{ fontSize: "1.5rem" }}>💵</span>
              <input type="text" inputMode="decimal" value={totalAmount} onChange={e => { let raw = e.target.value; let cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./, "$1"); const parts = cleaned.split('.'); if (parts[1]) parts[1] = parts[1].slice(0,8); setTotalAmount(parts.join('.')); }} placeholder="0.00" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "1.1rem", fontWeight: 600, color: "#f1f5f9" }} />
            </div>
          </div>
          {selectedFriends.size > 0 && enteredTotal > 0 && (
            <div className="flex-col-container" style={{ gap: "0.75rem" }}>
              <SplitModeSelector mode={splitMode} onChange={setSplitMode} />
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.5px", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Split by exact amounts</p>
              {currentAddress && <ParticipantAmountInput address={currentAddress as Address} displayName="You" amount={selfSplit} disabled={splitMode === 'equal'} onChange={updateSelfAmount} />}
              {Array.from(selectedFriends).map(addr => (
                <ParticipantAmountInput key={addr} address={addr} amount={participantSplits.get(addr) || 0} disabled={splitMode === 'equal'} onChange={val => updateParticipantAmount(addr, val)} />
              ))}
              <SplitSummaryBar total={enteredTotal} allocated={totalSplit} mode={splitMode} />
            </div>
          )}
          {currentAddress && (
            <div className="flex-col-container" style={{ gap: "0.75rem" }}>
              <button onClick={() => setShowAIOptions(!showAIOptions)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#e2e8f0" }}>
                <span>🤖 AI-powered split (Optional)</span><span>{showAIOptions ? "▼" : "▶"}</span>
              </button>
              {showAIOptions && (
                <AiPanel
                  total={enteredTotal}
                  mode={splitMode}
                  participants={Array.from(selectedFriends).map(a => ({ address: a, amount: participantSplits.get(a) || 0 }))}
                  selfAddress={currentAddress}
                  onApplySplit={handleApplyAIActions}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal && isOpen) {
    return (
      <div className="expense-modal-overlay" onClick={handleCancel}>
        <div className="expense-modal-content" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  if (!isModal) {
    return content;
  }

  return null;
}

export default AddExpense;
