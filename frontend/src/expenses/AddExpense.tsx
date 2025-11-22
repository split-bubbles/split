import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { useState, useEffect } from "react";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useReadContract } from "../hooks/useReadContract";
import { type Address } from "viem";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import FriendNameDisplay from "../friends/FriendNameDisplay";

type Step = "select-friends" | "expense-details" | "review";

interface ExpenseItem {
  name: string;
  price: number;
}

interface Receipt {
  currency?: string;
  total?: number;
  subtotal?: number;
  tax?: number;
  tip?: number;
  items?: ExpenseItem[];
}

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api";

/**
 * Component for adding a new expense
 */
interface AddExpenseProps {
  openTrigger?: number; // increments externally to request opening
}

function AddExpense({ openTrigger }: AddExpenseProps) {
  const { evmAddress: currentAddress } = useEvmAddress();
  
  // Navigation state
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("select-friends");
  
  // Step 1: Friend selection
  const [selectedFriends, setSelectedFriends] = useState<Set<Address>>(new Set());
  const [friends, setFriends] = useState<Address[]>([]);
  
  // Step 2: Expense details
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  
  // AI interaction
  const [aiInstructions, setAiInstructions] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  
  // Step 3: Split details
  const [splitMode, setSplitMode] = useState<"even" | "ai" | "custom">("even");
  const [participantSplits, setParticipantSplits] = useState<Map<Address, number>>(new Map());
  
  // Read friends from contract
  const { data: contractFriends } = useReadContract({
    address: currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "getFriends",
    args: currentAddress ? [currentAddress] : undefined,
    query: {
      enabled: !!currentAddress,
      refetchInterval: 5000,
    },
  });

  useEffect(() => {
    if (contractFriends) {
      setFriends(contractFriends as Address[]);
    }
  }, [contractFriends]);

  // Calculate even split whenever total or friends change
  useEffect(() => {
    if (splitMode === "even" && totalAmount && selectedFriends.size > 0) {
      const total = parseFloat(totalAmount);
      if (!isNaN(total)) {
        const perPerson = total / (selectedFriends.size + 1); // +1 for current user
        const newSplits = new Map<Address, number>();
        selectedFriends.forEach(friend => {
          newSplits.set(friend, perPerson);
        });
        setParticipantSplits(newSplits);
      }
    }
  }, [splitMode, totalAmount, selectedFriends]);

  const handleAddExpense = () => {
    setIsOpen(true);
    setCurrentStep("select-friends");
  };

  // Open when external trigger changes
  useEffect(() => {
    if (openTrigger !== undefined && openTrigger > 0) {
      // Only auto-open if currently closed
      if (!isOpen) {
        setIsOpen(true);
        setCurrentStep("select-friends");
      }
    }
  }, [openTrigger, isOpen]);

  const handleCancel = () => {
    setIsOpen(false);
    setCurrentStep("select-friends");
    setSelectedFriends(new Set());
    setDescription("");
    setTotalAmount("");
    setReceipt(null);
    setUploadedImage(null);
    setItems([]);
    setAiInstructions("");
    setAiError("");
    setAiSuggestion(null);
    setSplitMode("even");
    setParticipantSplits(new Map());
  };

  const handleToggleFriend = (friendAddress: Address) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendAddress)) {
        newSet.delete(friendAddress);
      } else {
        newSet.add(friendAddress);
      }
      return newSet;
    });
  };

  const handleContinueFromFriends = () => {
    if (selectedFriends.size === 0) {
      alert("Please select at least one friend to split the expense with.");
      return;
    }
    setCurrentStep("expense-details");
  };

  const handleBackToFriends = () => {
    setCurrentStep("select-friends");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setAiError("Please upload an image file");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      
      // Auto-parse receipt with AI
      await parseReceiptWithAI(base64);
    };
    reader.onerror = () => {
      setAiError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const parseReceiptWithAI = async (base64Image: string) => {
    setIsLoadingAI(true);
    setAiError("");
    
    try {
      const response = await fetch(`${API_BASE_URL}/reciepts/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to parse receipt");
      }

      setReceipt(data.receipt);
      if (data.receipt.total) {
        setTotalAmount(data.receipt.total.toString());
      }
      if (data.receipt.items) {
        setItems(data.receipt.items);
      }
    } catch (error: any) {
      console.error("Receipt parsing error:", error);
      setAiError(error.message || "Failed to parse receipt. You can still enter details manually.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const splitWithAI = async () => {
    if (!aiInstructions.trim()) {
      setAiError("Please provide instructions for how to split the expense");
      return;
    }

    setIsLoadingAI(true);
    setAiError("");

    try {
      const participants = Array.from(selectedFriends).map(addr => ({
        ens: addr,
        paid: 0,
      }));

      const receiptData = receipt || {
        total: parseFloat(totalAmount) || 0,
        items: items.length > 0 ? items : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/reciepts/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt: receiptData,
          instructions: aiInstructions,
          participants,
          priorPlan: aiSuggestion || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to split expense");
      }

      setAiSuggestion(data.split);
      
      // Apply AI suggestions to participant splits
      if (data.split.participants) {
        const newSplits = new Map<Address, number>();
        data.split.participants.forEach((p: any) => {
          const address = p.ens as Address;
          if (selectedFriends.has(address)) {
            newSplits.set(address, p.owes || 0);
          }
        });
        setParticipantSplits(newSplits);
        setSplitMode("ai");
      }
    } catch (error: any) {
      console.error("AI split error:", error);
      setAiError(error.message || "Failed to split with AI. You can adjust amounts manually.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const addItem = () => {
    setItems([...items, { name: "", price: 0 }]);
  };

  const updateItem = (index: number, field: "name" | "price", value: string | number) => {
    const newItems = [...items];
    if (field === "price") {
      newItems[index][field] = typeof value === "number" ? value : parseFloat(value) || 0;
    } else {
      newItems[index][field] = value as string;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateParticipantAmount = (address: Address, amount: string) => {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed)) {
      const newSplits = new Map(participantSplits);
      newSplits.set(address, parsed);
      setParticipantSplits(newSplits);
      if (splitMode === "even") {
        setSplitMode("custom");
      }
    }
  };

  const handleContinueToReview = () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      alert("Please enter a valid total amount");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a description for the expense");
      return;
    }
    setCurrentStep("review");
  };

  const handleBackToDetails = () => {
    setCurrentStep("expense-details");
  };

  const handleConfirmExpense = () => {
    // TODO: Implement blockchain transaction to record expense
    console.log("Expense confirmed:", {
      description,
      totalAmount: parseFloat(totalAmount),
      selectedFriends: Array.from(selectedFriends),
      participantSplits: Object.fromEntries(participantSplits),
      receipt,
      items,
    });
    alert("Expense recorded! (Transaction implementation pending)");
    handleCancel();
  };

  const totalSplit = Array.from(participantSplits.values()).reduce((sum, amount) => sum + amount, 0);
  const currentUserOwes = parseFloat(totalAmount) - totalSplit;
  const isBalanced = Math.abs(currentUserOwes) < 0.01; // Allow small rounding errors

  if (!isOpen) {
    return (
      <>
        <div className="section-header">
          <h3>Create Expense</h3>
        </div>
        <div className="card card--add-expense">
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>💸</span>
            <h2 className="card-title" style={{ marginBottom: "0.5rem" }}>New Expense</h2>
            <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Split bills with friends using AI or manual entry
            </p>
            <Button
              type="button"
              onClick={handleAddExpense}
              className="tx-button"
              style={{
                background: "linear-gradient(135deg, #0052FF 0%, #3b82f6 100%)",
                color: "white",
                fontSize: "1rem",
                fontWeight: "600",
                width: "100%",
                maxWidth: "300px",
              }}
            >
              ✨ Start New Expense
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Step 1: Friend Selection
  if (currentStep === "select-friends") {
    return (
      <div className="card card--add-expense">
        <h2 className="card-title">👥 Select Friends</h2>
        <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.9rem", margin: "-0.5rem 0 0.5rem" }}>Step 1 of 3</p>
        
        <div className="flex-col-container" style={{ gap: "1rem" }}>
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
              Select Friends to Split With
            </h3>
            
            {friends.length === 0 ? (
              <p style={{ color: "#666", fontSize: "0.875rem" }}>
                You don't have any friends yet. Add friends first to split expenses with them.
              </p>
            ) : (
              <div className="flex-col-container" style={{ gap: "0.5rem" }}>
                {friends.map((friendAddress) => (
                  <label
                    key={friendAddress}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                      backgroundColor: selectedFriends.has(friendAddress) ? "#f0f7ff" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriends.has(friendAddress)}
                      onChange={() => handleToggleFriend(friendAddress)}
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        cursor: "pointer",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <FriendNameDisplay address={friendAddress} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selectedFriends.size > 0 && (
              <p style={{ fontSize: "0.875rem", color: "#666", margin: "0.5rem 0" }}>
                Selected: {selectedFriends.size} friend{selectedFriends.size !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={handleCancel}
              className="tx-button"
              style={{
                flex: 1,
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                backgroundColor: "white",
                color: "#333",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleContinueFromFriends}
              disabled={selectedFriends.size === 0}
              className="tx-button"
              style={{
                flex: 1,
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: selectedFriends.size === 0 ? "#ccc" : "#0052FF",
                color: "white",
                fontSize: "1rem",
                cursor: selectedFriends.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Expense Details
  if (currentStep === "expense-details") {
    return (
      <div className="card card--add-expense expense-details" style={{ maxWidth: "100%" }}>
        <h2 className="card-title">📝 Expense Details</h2>
        <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.9rem", margin: "-0.5rem 0 0.5rem" }}>Step 2 of 3 - Add details manually or use AI</p>
        
        <div className="flex-col-container" style={{ gap: "1.5rem" }}>
          {/* Basic Info */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <label style={{ fontWeight: "500" }}>Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Dinner at restaurant"
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* Receipt Upload */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <label style={{ fontWeight: "500" }}>Receipt (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{
                padding: "0.5rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
              }}
            />
            {uploadedImage && (
              <img
                src={uploadedImage}
                alt="Receipt preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "300px",
                  objectFit: "contain",
                  borderRadius: "0.5rem",
                  border: "1px solid #ccc",
                }}
              />
            )}
            {isLoadingAI && (
              <p style={{ color: "#0052FF", fontSize: "0.875rem" }}>
                🤖 AI is analyzing your receipt...
              </p>
            )}
          </div>

          {/* Total Amount */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <label style={{ fontWeight: "500" }}>Total Amount (USDC) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                fontSize: "1rem",
              }}
            />
          </div>

          {/* Items (Optional) */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontWeight: "500" }}>Items (Optional)</label>
              <button
                type="button"
                onClick={addItem}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #0052FF",
                  backgroundColor: "white",
                  color: "#0052FF",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                + Add Item
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="Item name"
                  style={{
                    flex: 2,
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #ccc",
                    fontSize: "0.875rem",
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.price}
                  onChange={(e) => updateItem(index, "price", e.target.value)}
                  placeholder="0.00"
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #ccc",
                    fontSize: "0.875rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #ccc",
                    backgroundColor: "white",
                    color: "#666",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* AI Split Assistant */}
          <div className="flex-col-container" style={{ gap: "0.75rem", padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "0.5rem" }}>
            <label style={{ fontWeight: "500" }}>🤖 AI Split Assistant (Optional)</label>
            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
              Tell the AI how to split the expense. Example: "Alice and Bob each had a burger, I had the pasta"
            </p>
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder="Describe who ordered what..."
              rows={3}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={splitWithAI}
              disabled={!aiInstructions.trim() || isLoadingAI}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: !aiInstructions.trim() || isLoadingAI ? "#ccc" : "#0052FF",
                color: "white",
                cursor: !aiInstructions.trim() || isLoadingAI ? "not-allowed" : "pointer",
              }}
            >
              {isLoadingAI ? "AI is thinking..." : "Split with AI"}
            </button>
            {aiError && (
              <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: 0 }}>
                {aiError}
              </p>
            )}
            {aiSuggestion && (
              <div style={{ padding: "0.75rem", backgroundColor: "#e0f2fe", borderRadius: "0.5rem" }}>
                <p style={{ fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.5rem" }}>
                  AI Suggestion:
                </p>
                <p style={{ fontSize: "0.875rem", margin: 0 }}>
                  {aiSuggestion.summary || "Split calculated"}
                </p>
              </div>
            )}
          </div>

          {/* Split Preview */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontWeight: "500" }}>Split Preview</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setSplitMode("even")}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: splitMode === "even" ? "2px solid #0052FF" : "1px solid #ccc",
                    backgroundColor: splitMode === "even" ? "#f0f7ff" : "white",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Even Split
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("custom")}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: splitMode === "custom" ? "2px solid #0052FF" : "1px solid #ccc",
                    backgroundColor: splitMode === "custom" ? "#f0f7ff" : "white",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Custom
                </button>
              </div>
            </div>
            
            {/* You (current user) */}
            <div style={{ padding: "0.75rem", backgroundColor: "#fef3c7", borderRadius: "0.5rem" }}>
              <p style={{ fontSize: "0.875rem", fontWeight: "500", margin: 0 }}>
                You: ${currentUserOwes.toFixed(2)}
              </p>
            </div>

            {/* Friends */}
            {Array.from(selectedFriends).map((friendAddress) => (
              <div
                key={friendAddress}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #ccc",
                }}
              >
                <div style={{ flex: 1 }}>
                  <FriendNameDisplay address={friendAddress} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={participantSplits.get(friendAddress) || 0}
                  onChange={(e) => updateParticipantAmount(friendAddress, e.target.value)}
                  disabled={splitMode === "even"}
                  style={{
                    width: "100px",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #ccc",
                    fontSize: "0.875rem",
                    textAlign: "right",
                  }}
                />
                <span style={{ fontSize: "0.875rem" }}>USDC</span>
              </div>
            ))}

            {!isBalanced && (
              <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: "0.5rem 0" }}>
                ⚠️ Total split (${totalSplit.toFixed(2)}) doesn't match expense amount (${totalAmount})
              </p>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleBackToFriends}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                backgroundColor: "white",
                color: "#333",
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinueToReview}
              style={{
                flex: 2,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#0052FF",
                color: "white",
                cursor: "pointer",
              }}
            >
              Review & Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Review & Confirm
  if (currentStep === "review") {
    return (
      <div className="card card--add-expense review-screen">
        <h2 className="card-title">✅ Review & Confirm</h2>
        <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.9rem", margin: "-0.5rem 0 0.5rem" }}>Step 3 of 3 - Final review</p>
        
        <div className="flex-col-container" style={{ gap: "1.5rem" }}>
          {/* Summary */}
          <div className="flex-col-container" style={{ gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "500" }}>Summary</h3>
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              <strong>Description:</strong> {description}
            </p>
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              <strong>Total:</strong> ${parseFloat(totalAmount).toFixed(2)} USDC
            </p>
            {items.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <strong style={{ fontSize: "0.875rem" }}>Items:</strong>
                <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                  {items.map((item, i) => (
                    <li key={i} style={{ fontSize: "0.875rem" }}>
                      {item.name}: ${item.price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Split Breakdown */}
          <div className="flex-col-container" style={{ gap: "0.75rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "500" }}>Split Breakdown</h3>
            
            <div style={{ padding: "0.75rem", backgroundColor: "#fef3c7", borderRadius: "0.5rem" }}>
              <p style={{ fontSize: "0.875rem", fontWeight: "500", margin: 0 }}>
                You: ${currentUserOwes.toFixed(2)} USDC
              </p>
            </div>

            {Array.from(selectedFriends).map((friendAddress) => (
              <div
                key={friendAddress}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #ccc",
                }}
              >
                <FriendNameDisplay address={friendAddress} />
                <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                  ${(participantSplits.get(friendAddress) || 0).toFixed(2)} USDC
                </span>
              </div>
            ))}
          </div>

          {!isBalanced && (
            <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", borderRadius: "0.5rem" }}>
              <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: 0 }}>
                ⚠️ Warning: Total split doesn't match expense amount. Please go back and adjust.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleBackToDetails}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                backgroundColor: "white",
                color: "#333",
                cursor: "pointer",
              }}
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmExpense}
              disabled={!isBalanced}
              style={{
                flex: 2,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: !isBalanced ? "#ccc" : "#10b981",
                color: "white",
                cursor: !isBalanced ? "not-allowed" : "pointer",
              }}
            >
              Confirm & Record Expense
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default AddExpense;

