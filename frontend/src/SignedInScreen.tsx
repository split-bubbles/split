import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useReadContract } from "./hooks/useReadContract";

import Header from "./common/Header";
import BottomNav, { type TabType } from "./common/BottomNav";
import UserBalance from "./balance/UserBalance";
import AddFriend from "./friends/AddFriend";
import PendingApprovals from "./friends/PendingApprovals";
import AddExpense from "./expenses/AddExpense";

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

  const handleQuickAddExpense = () => {
    setActiveTab("expense");
    setExpenseOpenTrigger((v) => v + 1);
  };

  const mainClasses = ["main-content", activeTab === "home" ? "no-scroll" : null].filter(Boolean).join(" ");

  return (
    <div className="app-container">
      <Header />
      <main className={mainClasses}>
        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="tab-content home-screen">
            <div className="card card--user-balance">
              <UserBalance balance={formattedUsdcBalance} />
            </div>
            
            <div className="section-header">
              <h3>Recent Activity</h3>
            </div>
            
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <p>No expenses yet</p>
              <p className="empty-subtitle">Tap the ➕ button to create your first expense</p>
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
              <h2 className="card-title">⚙️ Settings</h2>
              <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.95rem" }}>
                Account settings and preferences
              </p>
              
              <div className="settings-list">
                <div className="setting-item">
                  <span>💰 Default Currency</span>
                  <span className="setting-value">USDC</span>
                </div>
                <div className="setting-item">
                  <span>🔔 Notifications</span>
                  <span className="setting-value">Enabled</span>
                </div>
                <div className="setting-item">
                  <span>🌐 Network</span>
                  <span className="setting-value">Base Sepolia</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Floating Action Button - Quick Add Expense */}
      {activeTab === "home" && (
        <button 
          className="fab" 
          onClick={handleQuickAddExpense}
          aria-label="Add expense"
        >
          ➕
        </button>
      )}
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default SignedInScreen;
