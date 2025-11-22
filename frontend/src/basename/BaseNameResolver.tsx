import { useName } from "@coinbase/onchainkit/identity";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { baseSepolia } from "viem/chains";
import { useEffect } from "react";

/**
 * Component that resolves and displays the Base name for the connected wallet address
 */
function BaseNameResolver() {
  const { evmAddress: address } = useEvmAddress();
  const { data: baseName, isLoading, error } = useName({
    address: address || undefined,
    chain: baseSepolia,
  });

  // Debug logging
  useEffect(() => {
    if (address) {
      console.log("BaseNameResolver state:", {
        address,
        baseName,
        isLoading,
        error: error?.message,
      });
    }
  }, [address, baseName, isLoading, error]);

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

  if (baseName) {
    return <span className="base-name">{baseName}</span>;
  }

  return null;
}

export default BaseNameResolver;

