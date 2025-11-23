import { Button } from "@coinbase/cdp-react/components/ui/Button";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEvmAddress, useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { useReadContract } from "../hooks/useReadContract";
import { type Address, encodeFunctionData, parseUnits } from "viem";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import FriendNameDisplay from "../friends/FriendNameDisplay";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";
import { baseSepolia, sepolia } from "viem/chains";
import { SplitModeSelector } from "./components/SplitModeSelector";
import { ParticipantAmountInput } from "./components/ParticipantAmountInput";
import { SplitSummaryBar } from "./components/SplitSummaryBar";
import { AiPanel } from "./components/AiPanel";
import type { ParsedReceipt, SplitResult } from "../services/aiService";

// USDC contract address on Base Sepolia
const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ERC20 ABI for transfer and transferFrom functions
const ERC20_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface AddExpenseProps { openTrigger?: number; isModal?: boolean }

function AddExpense({ openTrigger, isModal = false }: AddExpenseProps) {
  const { evmAddress: currentAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation } = useSendUserOperation();
  const [isOpen, setIsOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTrigger, setLastTrigger] = useState(0);
  const [selectedFriends, setSelectedFriends] = useState<Set<Address>>(new Set());
  const [friends, setFriends] = useState<Address[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [showFriendSuggestions, setShowFriendSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const friendInputRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [participantSplits, setParticipantSplits] = useState<Map<Address, number>>(new Map());
  const [selfSplit, setSelfSplit] = useState(0);
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [isClosingDrawer, setIsClosingDrawer] = useState(false);
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // AI Panel state (persists when drawer closes)
  const [aiImageData, setAiImageData] = useState<string | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string>('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiParsed, setAiParsed] = useState<ParsedReceipt | null>(null);
  const [aiSplitResult, setAiSplitResult] = useState<SplitResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPriorPlan, setAiPriorPlan] = useState<any>(null);

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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (friendInputRef.current && !friendInputRef.current.contains(target)) {
        setShowFriendSuggestions(false);
      }
    };

    if (showFriendSuggestions) {
      // Use a slight delay to allow click events on dropdown items to fire first
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFriendSuggestions]);

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    setShowSuccess(false);
    setSelectedFriends(new Set());
    setDescription("");
    setTotalAmount("");
    setSplitMode("equal");
    setSelfSplit(0);
    setParticipantSplits(new Map());
    closeAIDrawer();
  };

  const closeAIDrawer = useCallback(() => {
    requestAnimationFrame(() => {
      setIsClosingDrawer(true);
      setTimeout(() => {
        setShowAIOptions(false);
        setIsClosingDrawer(false);
        setDrawerDragY(0);
      }, 300); // Match animation duration
    });
  }, []);

  // Drag handlers for drawer
  const dragStartY = useRef(0);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartY.current = clientY;
    setDrawerDragY(0);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const deltaY = clientY - dragStartY.current;
    
    if (deltaY > 0) {
      setDrawerDragY(deltaY);
    } else {
      setDrawerDragY(0);
    }
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // If dragged more than 100px down, close the drawer
    if (drawerDragY > 100) {
      closeAIDrawer();
    } else {
      // Snap back
      setDrawerDragY(0);
    }
  }, [isDragging, drawerDragY, closeAIDrawer]);

  // Add global mouse/touch event listeners for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleDragMove(e);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleRemoveFriend = (friend: Address) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      next.delete(friend);
      return next;
    });
  };

  const handleAddFriend = (friend: Address) => {
    if (!selectedFriends.has(friend)) {
      setSelectedFriends(prev => new Set(prev).add(friend));
    }
    setFriendInput("");
    setShowFriendSuggestions(false);
    setHighlightedIndex(0);
  };

  // Store ENS names for filtering
  const [ensNameMap, setEnsNameMap] = useState<Map<Address, string>>(new Map());
  
  const handleEnsResolved = useCallback((address: Address, name: string | null) => {
    setEnsNameMap(prev => {
      const currentName = prev.get(address);
      // Only update if the name actually changed
      if (currentName === name) {
        return prev;
      }
      const next = new Map(prev);
      if (name) {
        next.set(address, name);
      } else {
        next.delete(address);
      }
      return next;
    });
  }, []);

  // Component to resolve ENS name for a friend (for filtering)
  const FriendEnsResolver = React.memo(({ address, onResolved }: { address: Address; onResolved: (address: Address, name: string | null) => void }) => {
    const { data: ensName } = useEnsNameOptimistic({
      address: address as `0x${string}` | undefined,
      l1ChainId: sepolia.id,
      l2ChainId: baseSepolia.id,
    });
    
    const prevEnsNameRef = useRef<string | null | undefined>(undefined);
    
    useEffect(() => {
      // Only call onResolved if the ENS name actually changed
      if (prevEnsNameRef.current !== ensName) {
        prevEnsNameRef.current = ensName;
        onResolved(address, ensName || null);
      }
    }, [ensName, address, onResolved]);
    
    return null;
  });

  // Filter friends based on input (address or ENS name)
  const filteredFriends = useMemo(() => {
    if (!friendInput.trim()) {
      // Show all unselected friends when input is empty
      return friends.filter(f => !selectedFriends.has(f));
    }
    const input = friendInput.toLowerCase().trim();
    // Remove 0x prefix from input if present for matching
    const inputWithoutPrefix = input.startsWith('0x') ? input.slice(2) : input;
    
    return friends.filter(f => {
      if (selectedFriends.has(f)) return false;
      const address = f.toLowerCase();
      // Remove 0x prefix for matching
      const addressWithoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
      // Match by address (partial match) - check both with and without 0x
      const addressMatch = address.includes(input) || addressWithoutPrefix.includes(inputWithoutPrefix);
      
      // Also match by ENS name if available
      const ensName = ensNameMap.get(f);
      const ensMatch = ensName ? ensName.toLowerCase().includes(input) : false;
      
      return addressMatch || ensMatch;
    });
  }, [friends, friendInput, selectedFriends, ensNameMap]);

  const handleFriendInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFriends.length > 0) {
        handleAddFriend(filteredFriends[highlightedIndex] || filteredFriends[0]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredFriends.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowFriendSuggestions(false);
    }
  };
  const updateParticipantAmount = (address: Address, amount: number) => { if (splitMode === "equal") return; setParticipantSplits(new Map(participantSplits.set(address, amount))); };
  const updateSelfAmount = (amount: number) => { if (splitMode === "equal") return; setSelfSplit(amount); };
  const handleApplyAIActions = (allocs: { address: string; amount: number }[], selfAmount?: number) => {
    // Allocation "address" may be an ENS name now. Resolve back to wallet addresses.
    const updatedMap = new Map<Address, number>(participantSplits);
    allocs.forEach(a => {
      const identifier = a.address.trim();
      let resolved: Address | undefined = undefined;
      if (identifier.startsWith('0x')) {
        resolved = identifier as Address;
      } else {
        // Find matching ENS entry
        for (const [addr, name] of ensNameMap.entries()) {
          if (name === identifier) { resolved = addr; break; }
        }
      }
      if (resolved && updatedMap.has(resolved)) {
        updatedMap.set(resolved, a.amount);
      }
    });
    setParticipantSplits(updatedMap);
    if (typeof selfAmount === 'number') setSelfSplit(selfAmount);
    setSplitMode('custom');
    closeAIDrawer();
  };
  const handleSaveExpense = async () => {
    if (selectedFriends.size === 0) { alert("Select at least one friend."); return; }
    if (!description.trim()) { alert("Enter description."); return; }
    const total = parseFloat(totalAmount); if (!total || total <= 0) { alert("Enter valid total."); return; }
    
    if (!canFinalize) {
      alert("Please complete the split before finalizing.");
      return;
    }

    const smartAccount = currentUser?.evmSmartAccounts?.[0];
    if (!smartAccount || !currentAddress) {
      alert("Smart account not available. Please ensure you're signed in.");
      return;
    }

    setIsFinalizing(true);

    try {
      // Note: The creator (first person) paid the receipt, so friends should pay them back.
      // However, we can only initiate transfers from the creator's account in a single transaction.
      // In a full implementation, friends would need to approve and transfer to the creator separately.
      // For now, we're using transferFrom where friends pull their share from the creator's approved balance.
      // This requires friends to have approved the creator first (which happens during friend request approval).
      
      // Create transferFrom calls - friends transfer their share TO the creator
      const calls = Array.from(selectedFriends).map((friendAddress) => {
        const amount = participantSplits.get(friendAddress) || 0;
        // USDC has 6 decimals
        const amountInWei = parseUnits(amount.toFixed(6), 6);
        
        // transferFrom(from, to, amount) - friend transfers to creator
        // The creator pulls the friend's share from the friend's account
        // This works because friends approved the creator during friend request approval
        const transferFromData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transferFrom",
          args: [friendAddress, currentAddress, amountInWei],
        });

        return {
          to: USDC_ADDRESS,
          value: 0n,
          data: transferFromData,
        };
      });

      // Execute all transfers in a single user operation
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls,
      });

      console.log("Expense finalized, friends paid creator:", {
        description,
        totalAmount: total,
        creator: currentAddress,
        selectedFriends: Array.from(selectedFriends),
        participantSplits: Object.fromEntries(participantSplits),
        selfSplit,
        userOperationHash: result.userOperationHash,
      });

      // Show success checkmark
      setShowSuccess(true);
      
      // Close modal after a short delay to show the checkmark
      setTimeout(() => {
        handleCancel();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to finalize expense:", err);
      alert(`Failed to finalize expense: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsFinalizing(false);
    }
  };

  const enteredTotal = parseFloat(totalAmount || "0") || 0;
  const totalFriends = Array.from(participantSplits.values()).reduce((s, v) => s + v, 0);
  const totalSplit = totalFriends + selfSplit;
  
  // Determine if we can finalize - split must be complete and match the total
  const canFinalize = 
    selectedFriends.size > 0 &&
    description.trim().length > 0 &&
    enteredTotal > 0 &&
    Math.abs(totalSplit - enteredTotal) < 0.01 && // Allow small floating point differences
    totalSplit > 0;

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
    <div className="card card--add-expense" style={{ maxWidth: "100%", height: isModal ? "auto" : "100vh", maxHeight: isModal ? "95vh" : "100vh", minHeight: isModal ? "85vh" : "100vh", display: "flex", flexDirection: "column", padding: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.25rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1a202c" }}>
        <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Add an expense</h2>
        <button onClick={(e) => handleCancel(e)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#1a202c", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0", paddingBottom: "180px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column" }}>
        <div className="flex-col-container" style={{ gap: "1.5rem", flex: 1 }}>
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <label style={{ fontSize: "0.75rem", letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>With you and:</label>
            {friends.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.75rem" }}>Add friends first to split expenses</p>
            ) : (
              <>
                <div ref={friendInputRef} style={{ position: "relative" }}>
                  {/* Resolve ENS names for all friends (hidden, for filtering) */}
                  {friends.slice(0, 50).map(friend => (
                    <FriendEnsResolver 
                      key={friend} 
                      address={friend} 
                      onResolved={handleEnsResolved} 
                    />
                  ))}
                  <input
                    type="text"
                    value={friendInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFriendInput(value);
                      setShowFriendSuggestions(true);
                      setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                      if (friends.length > 0) {
                        setShowFriendSuggestions(true);
                      }
                    }}
                    onKeyDown={handleFriendInputKeyDown}
                    placeholder="Type friend address or ENS name..."
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      backgroundColor: "#f1f5f9",
                      fontSize: "0.9rem",
                      color: "#1a202c",
                      outline: "none"
                    }}
                  />
                  {showFriendSuggestions && filteredFriends.length > 0 && (
                    <div 
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                        maxHeight: "200px",
                        overflowY: "auto",
                        zIndex: 10000
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {filteredFriends.map((friend, idx) => (
                        <button
                          key={friend}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddFriend(friend);
                          }}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            textAlign: "left",
                            backgroundColor: highlightedIndex === idx ? "#f1f5f9" : "#ffffff",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            color: "#1a202c",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                          }}
                        >
                          <FriendNameDisplay address={friend} />
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{friend.slice(0, 6)}...{friend.slice(-4)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedFriends.size > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {Array.from(selectedFriends).map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.7rem", borderRadius: "18px", border: "1px solid #1cc29f", backgroundColor: "#f0fdf4", fontSize: "0.7rem", color: "#1a202c", fontWeight: 500 }}>
                        <FriendNameDisplay address={f} />
                        <button
                          onClick={() => handleRemoveFriend(f)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#1cc29f", fontSize: "0.875rem", padding: 0, display: "flex", alignItems: "center" }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: "#f1f5f9" }}>
              <span style={{ fontSize: "1.5rem" }}>📝</span>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "#1a202c" }} />
            </div>
          </div>
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", backgroundColor: "#f1f5f9" }}>
              <span style={{ fontSize: "1.5rem" }}>💵</span>
              <input type="text" inputMode="decimal" value={totalAmount} onChange={e => { let raw = e.target.value; let cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./, "$1"); const parts = cleaned.split('.'); if (parts[1]) parts[1] = parts[1].slice(0,8); setTotalAmount(parts.join('.')); }} placeholder="0.00" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", fontWeight: 600, color: "#1a202c" }} />
            </div>
          </div>
          {selectedFriends.size > 0 && enteredTotal > 0 && (
            <div className="flex-col-container" style={{ gap: "0.75rem" }}>
              <SplitModeSelector mode={splitMode} onChange={setSplitMode} />
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>Split by exact amounts</p>
              {currentAddress && <ParticipantAmountInput address={currentAddress as Address} displayName="You" amount={selfSplit} disabled={splitMode === 'equal'} onChange={updateSelfAmount} />}
              {Array.from(selectedFriends).map(addr => (
                <ParticipantAmountInput key={addr} address={addr} amount={participantSplits.get(addr) || 0} disabled={splitMode === 'equal'} onChange={val => updateParticipantAmount(addr, val)} />
              ))}
              <SplitSummaryBar total={enteredTotal} allocated={totalSplit} mode={splitMode} />
            </div>
          )}
         </div>
       </div>
      {/* AI Drawer - Bottom Sheet */}
      {showAIOptions && currentAddress && (
        <>
          <div 
            className="ai-drawer-overlay"
            onClick={closeAIDrawer}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.15)",
              backdropFilter: "blur(4px)",
              zIndex: 1001,
              animation: isClosingDrawer ? "fadeOut 0.3s ease-out" : "fadeIn 0.2s ease-out",
              opacity: isClosingDrawer ? 0 : 1,
            }}
          />
          <div 
            className="ai-drawer"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: drawerDragY > 0 ? `calc(80px - ${drawerDragY}px)` : "80px",
              maxHeight: "calc(85vh - 80px)",
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              borderTopLeftRadius: "1.5rem",
              borderTopRightRadius: "1.5rem",
              zIndex: 1002,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)",
              animation: isClosingDrawer ? undefined : (showAIOptions ? "slideInUp 0.3s ease-out" : undefined),
              transform: isClosingDrawer ? "translateY(100%)" : (drawerDragY > 0 ? `translateY(${drawerDragY}px)` : undefined),
              transition: isClosingDrawer ? "transform 0.3s ease-out" : (drawerDragY === 0 ? "transform 0.1s ease-out" : undefined),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Full-width handle button at top */}
            <button
              onClick={closeAIDrawer}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "1rem 1.25rem",
                backgroundColor: "#f1f5f9",
                border: "none",
                borderBottom: "1px solid #e2e8f0",
                borderTopLeftRadius: "1.5rem",
                borderTopRightRadius: "1.5rem",
                cursor: isDragging ? "grabbing" : "grab",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "#1a202c",
                transition: "background-color 0.2s",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.backgroundColor = "#e2e8f0";
                }
              }}
              onMouseLeave={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                }
              }}
            >
              <span style={{ fontSize: "1rem" }}>▼</span>
              <span>🤖 AI-powered split</span>
              <span style={{ fontSize: "1rem" }}>▼</span>
            </button>
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
              <AiPanel
                mode={splitMode}
                participants={Array.from(selectedFriends).map(a => ({
                  ens: ensNameMap.get(a) || a,
                  owes: participantSplits.get(a) || 0,
                  paid: 0 // placeholder until UI captures actual contributions
                }))}
                selfAddress={currentAddress}
                onApplySplit={handleApplyAIActions}
                // Persisted state
                imageData={aiImageData}
                imageUrl={aiImageUrl}
                instructions={aiInstructions}
                parsed={aiParsed}
                splitResult={aiSplitResult}
                loading={aiLoading}
                error={aiError}
                priorPlan={aiPriorPlan}
                // State setters
                onImageDataChange={setAiImageData}
                onImageUrlChange={setAiImageUrl}
                onInstructionsChange={setAiInstructions}
                onParsedChange={setAiParsed}
                onSplitResultChange={setAiSplitResult}
                onLoadingChange={setAiLoading}
                onErrorChange={setAiError}
                onPriorPlanChange={setAiPriorPlan}
              />
            </div>
          </div>
        </>
      )}
      
      {/* AI-powered split button - Fixed above Finalize, under drawer when open */}
      {currentAddress && !showAIOptions && (
        <div style={{ 
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "80px",
          padding: 0,
          backgroundColor: "#ffffff",
          zIndex: 1001,
        }}>
          <button 
            onClick={() => {
              if (showAIOptions) {
                closeAIDrawer();
              } else {
                setShowAIOptions(true);
              }
            }} 
            style={{ 
              width: "100%",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "0.5rem",
              padding: "0.75rem 1.25rem", 
              backgroundColor: "#f1f5f9", 
              border: "1px solid #e2e8f0", 
              borderRadius: "0.5rem", 
              cursor: "pointer", 
              fontSize: "0.9rem", 
              fontWeight: 600, 
              letterSpacing: "0.5px", 
              color: "#1a202c",
              transition: "all 0.2s"
            }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                }}
          >
            <span style={{ fontSize: "1rem", transform: showAIOptions ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }}>▲</span>
            <span>🤖</span>
            <span style={{ textTransform: "uppercase" }}>AI-powered split</span>
            <span style={{ fontSize: "1rem", transform: showAIOptions ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }}>▲</span>
          </button>
        </div>
      )}
      
      {/* Finalize Button - Fixed above drawer */}
      <div style={{ 
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "1rem 1.25rem",
        borderTop: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        zIndex: 1003,
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)"
      }}>
        {showSuccess ? (
          <div             style={{
              width: "100%",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.5rem",
              background: "linear-gradient(135deg, #1cc29f 0%, #10b981 100%)",
              color: "#ffffff",
              fontSize: "0.9rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.3s",
            }}>
            <span style={{ fontSize: "1.25rem" }}>✓</span>
            <span>Expense Finalized!</span>
          </div>
        ) : (
          <button
            onClick={handleSaveExpense}
            disabled={!canFinalize || isFinalizing}
            style={{
              width: "100%",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: (canFinalize && !isFinalizing) ? "pointer" : "not-allowed",
              background: (canFinalize && !isFinalizing)
                ? "linear-gradient(135deg, #1cc29f 0%, #10b981 100%)" 
                : "#334155",
              color: (canFinalize && !isFinalizing) ? "#ffffff" : "#64748b",
              transition: "all 0.2s",
              opacity: (canFinalize && !isFinalizing) ? 1 : 0.5,
            }}
          >
            {isFinalizing ? "Finalizing..." : "Finalize"}
          </button>
        )}
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
