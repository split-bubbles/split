import { useName } from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";

/**
 * Component that resolves and displays the Base name for the connected wallet address
 */
function BaseNameResolver() {
  const { address } = useAccount();
  const { data: baseName, isLoading, error } = useName({
    address: address || undefined,
    chain: baseSepolia,
  });

  if (!address) {
    return null;
  }

  if (isLoading) {
    return null; // Don't show loading state
  }

  if (error) {
    return null; // Silently fail if there's an error
  }

  if (baseName) {
    return <span className="base-name">{baseName}</span>;
  }

  return null;
}

export default BaseNameResolver;

