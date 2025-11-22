import { useMemo } from "react";
import { formatUnits, type Address } from "viem";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useReadContract } from "./hooks/useReadContract";

import Header from "./common/Header";
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
 */
function SignedInScreen() {
  const { evmAddress: address } = useEvmAddress();

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

  return (
    <>
      <Header />
      <main className="main flex-col-container flex-grow">
        <div className="main-inner">
          <div className="card card--user-balance">
            <UserBalance balance={formattedUsdcBalance} />
          </div>
          <div className="card card--add-expense">
            <AddExpense />
          </div>
          <div className="card card--pending-approvals">
            <PendingApprovals />
          </div>
          <div className="card card--add-friend">
            <AddFriend />
          </div>
        </div>
      </main>
    </>
  );
}

export default SignedInScreen;
