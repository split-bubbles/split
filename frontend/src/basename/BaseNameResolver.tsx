import { useEffect } from "react";
import { baseSepolia, sepolia } from "viem/chains";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";
import { useEvmAddress } from "@coinbase/cdp-hooks";

interface BaseNameResolverProps {
  onResolved?: (hasName: boolean) => void;
}

/**
 * Component that resolves and displays the ENS name for the connected wallet address
 */
function BaseNameResolver({ onResolved }: BaseNameResolverProps = {}) {
  const { evmAddress: address } = useEvmAddress();
  const { data: ensName, isLoading, error } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  const hasName = !!ensName && !isLoading;
  const isFullyLoaded = !isLoading;

  // Notify parent component when name resolution is complete
  useEffect(() => {
    if (!onResolved || !address) return;
    
    // Only notify when we're done checking
    if (isFullyLoaded) {
      const nameFound = !!ensName;
      onResolved(nameFound);
    }
  }, [onResolved, address, ensName, isFullyLoaded]);

  if (!address) {
    return null;
  }

  if (isLoading) {
    return null; // Don't show loading state
  }

  if (error) {
    console.warn("BaseNameResolver error:", error);
    return null; // Silently fail if there's an error
  }

  if (ensName) {
    return <span className="base-name">{ensName}</span>;
  }

  return null;
}

export default BaseNameResolver;

