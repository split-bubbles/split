import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http, formatEther, formatUnits, type Address } from "viem";

import Header from "./Header";
import SmartAccountTransaction from "./SmartAccountTransaction";
import UserBalance from "./UserBalance";

/**
 * Create a viem client to access user's balance on the Base Sepolia network
 */
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

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
 */
function SignedInScreen() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [balance, setBalance] = useState<bigint | undefined>(undefined);
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>(undefined);

  const formattedBalance = useMemo(() => {
    if (balance === undefined) return undefined;
    return formatEther(balance);
  }, [balance]);

  const getBalance = useCallback(async () => {
    if (!evmAddress) return;
    const weiBalance = await client.getBalance({
      address: evmAddress,
    });
    setBalance(weiBalance);
  }, [evmAddress]);

  const getUsdcBalance = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const balance = await client.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [evmAddress],
      });
      setUsdcBalance(balance);
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcBalance(0n);
    }
  }, [evmAddress]);

  const formattedUsdcBalance = useMemo(() => {
    if (usdcBalance === undefined) return undefined;
    // USDC has 6 decimals, not 18 like ETH
    return formatUnits(usdcBalance, 6);
  }, [usdcBalance]);

  useEffect(() => {
    getBalance();
    getUsdcBalance(); // Add this to fetch USDC balance
    const interval = setInterval(() => {
      getBalance();
      getUsdcBalance(); // Also update USDC balance periodically
    }, 500);
    return () => clearInterval(interval);
  }, [getBalance, getUsdcBalance]);

  return (
    <>
      <Header />
      <main className="main flex-col-container flex-grow">
        <div className="main-inner flex-col-container">
          <div className="card card--user-balance">
            <UserBalance balance={formattedUsdcBalance} />
          </div>
          <div className="card card--transaction">
            {isSignedIn && evmAddress && (
              <SmartAccountTransaction balance={formattedBalance} onSuccess={getBalance} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default SignedInScreen;
