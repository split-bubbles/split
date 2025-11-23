import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { formatUnits, type Address } from "viem";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useReadContract } from "./hooks/useReadContract";
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";

import Header from "./common/Header";
import BottomNav, { type TabType } from "./common/BottomNav";
import UserBalance from "./balance/UserBalance";
import AddFriend from "./friends/AddFriend";
import FriendsList from "./friends/FriendsList";
import PendingApprovals from "./friends/PendingApprovals";
import AddExpense from "./expenses/AddExpense";
import { IconCheck, IconCopy, IconUser } from "./common/Icons";
import BaseNameResolver from "./basename/BaseNameResolver";

// USDC contract address on Base Sepolia
// You may need to verify this address or get it from Base Sepolia documentation
const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC testnet address

// ERC20 ABI for balanceOf function
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * The Signed In screen
 * Now using Wagmi hooks for balance fetching
 * Mobile-app style with bottom navigation
 */
function SignedInScreen() {
  const { evmAddress: address } = useEvmAddress();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [expenseOpenTrigger, setExpenseOpenTrigger] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [hasBasename, setHasBasename] = useState(false);
  const nameContainerRef = useRef<HTMLSpanElement>(null);

  // Fetch USDC balance using Wagmi
  const {
    data: usdcBalance,
  } = useReadContract({
    address: address ? USDC_ADDRESS : undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
      enabled: !!address, // Only fetch if address exists
    },
  });

  // Format USDC balance
  const formattedUsdcBalance = useMemo(() => {
    if (usdcBalance === undefined || usdcBalance === null) return undefined;
    // USDC has 6 decimals, not 18 like ETH
    return formatUnits(usdcBalance as bigint, 6);
  }, [usdcBalance]);

  const formatAddress = useCallback((addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  // Reset hasBasename when address changes
  useEffect(() => {
    setHasBasename(false);
  }, [address]);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  const handleQuickAddExpense = () => {
    // On mobile, switch to expense tab
    if (window.innerWidth < 1024) {
      setActiveTab("expense");
    }
    // On desktop, just trigger the modal
    setExpenseOpenTrigger((v) => v + 1);
  };

  const mainClasses = ["main-content", activeTab === "home" ? "no-scroll" : null].filter(Boolean).join(" ");

  return (
    <div className="app-container">
      <Header />
      <main className={mainClasses}>
        {/* Desktop: Show all tabs on same page in grid */}
        <div className="desktop-all-tabs">
          {/* Home Card */}
          <div className="card card--user-balance">
            <UserBalance balance={formattedUsdcBalance} />
          </div>
          
          {/* Friends Cards */}
          <PendingApprovals />
          
          <AddFriend />
          
          <FriendsList />
        </div>

        {/* Mobile: Show only active tab */}
        <div className="mobile-single-tab">
          {/* Home Tab */}
          {activeTab === "home" && (
            <div className="tab-content home-screen">
              <div className="card card--user-balance">
                <UserBalance balance={formattedUsdcBalance} />
              </div>
            </div>
          )}
          
          {/* Expense Tab */}
          {activeTab === "expense" && (
            <div className="tab-content">
              <AddExpense openTrigger={expenseOpenTrigger} />
            </div>
          )}
          
          {/* Friends Tab */}
          {activeTab === "friends" && (
            <div className="tab-content">
              <div className="card card--pending-approvals">
                <PendingApprovals />
              </div>
              
              <div className="card card--add-friend">
                <AddFriend />
              </div>
            </div>
          )}
          
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="tab-content">
              <div className="card">
                <h2 className="card-title">👤 Account</h2>
                <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.95rem" }}>
                  Your wallet information
                </p>
                
                {address && (
                  <div className="settings-list">
                    <div className="setting-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.75rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Wallet Address</span>
                      <button
                        aria-label="copy wallet address"
                        className="flex-row-container copy-address-button header-address-button"
                        onClick={copyAddress}
                        style={{ 
                          width: "100%",
                          justifyContent: "flex-start",
                          padding: "0.75rem",
                          borderRadius: "0.5rem",
                          gap: "0.5rem"
                        }}
                      >
                        {!isCopied && (
                          <>
                            <IconUser className="user-icon user-icon--user" style={{ height: "1.25rem", width: "1.25rem" }} />
                            <IconCopy className="user-icon user-icon--copy" style={{ height: "1.25rem", width: "1.25rem" }} />
                          </>
                        )}
                        {isCopied && <IconCheck className="user-icon user-icon--check" style={{ height: "1.25rem", width: "1.25rem" }} />}
                        <span 
                          ref={nameContainerRef}
                          className="wallet-address header-address-text" 
                          style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                        >
                          <BaseNameResolver onResolved={(resolved) => {
                            setHasBasename(resolved);
                          }} />
                          {!hasBasename && address && (
                            <span style={{ display: "inline-block" }}>{formatAddress(address)}</span>
                          )}
                        </span>
                      </button>
                    </div>
                    
                    <div className="setting-item" style={{ justifyContent: "center", padding: "1.5rem 1rem", border: "none", background: "transparent" }}>
                      <AuthButton />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Desktop Expense Modal */}
      <div className="desktop-expense-modal">
        <AddExpense openTrigger={expenseOpenTrigger} isModal={true} />
      </div>
      
      {/* Floating Action Button - Quick Add Expense */}
      <button 
        className={`fab ${activeTab === "home" ? "fab-visible" : ""}`}
        onClick={handleQuickAddExpense}
        aria-label="Add expense"
      >
        <span className="fab-text">Add Expense</span>
        <span className="fab-icon">➕</span>
      </button>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default SignedInScreen;
