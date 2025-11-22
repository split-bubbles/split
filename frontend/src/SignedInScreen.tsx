import { useIsSignedIn } from "@coinbase/cdp-hooks";
import { useMemo } from "react";
import { formatEther, formatUnits, type Address } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";

import Header from "./Header";
import SmartAccountTransaction from "./SmartAccountTransaction";
import UserBalance from "./UserBalance";
import BaseNameSetup from "./BaseNameSetup";

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
  const { isSignedIn } = useIsSignedIn();
  const { address } = useAccount();

  // Fetch ETH balance using Wagmi
  const {
    data: balanceData,
    refetch: refetchBalance,
  } = useBalance({
    address: address || undefined,
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Fetch USDC balance using Wagmi
  const {
    data: usdcBalance,
    refetch: refetchUsdc,
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

  // Format ETH balance
  const formattedBalance = useMemo(() => {
    if (!balanceData?.value) return undefined;
    return formatEther(balanceData.value);
  }, [balanceData]);

  // Format USDC balance
  const formattedUsdcBalance = useMemo(() => {
    if (usdcBalance === undefined) return undefined;
    // USDC has 6 decimals, not 18 like ETH
    return formatUnits(usdcBalance, 6);
  }, [usdcBalance]);

  // Refetch both balances (used as callback for onSuccess)
  const refetchBalances = () => {
    refetchBalance();
    refetchUsdc();
  };

  return (
    <>
      <Header />
      <main className="main flex-col-container flex-grow">
        <div className="main-inner flex-col-container">
          {/* Show basename setup if user doesn't have one */}
          <BaseNameSetup />
          <div className="card card--user-balance">
            <UserBalance balance={formattedUsdcBalance} />
          </div>
          <div className="card card--transaction">
            {isSignedIn && address && (
              <SmartAccountTransaction balance={formattedBalance} onSuccess={refetchBalances} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default SignedInScreen;
