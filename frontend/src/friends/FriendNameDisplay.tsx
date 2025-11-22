import { baseSepolia, sepolia } from "viem/chains";
import { type Address } from "viem";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";

/**
 * Component to display a friend's name if available (resolves .split.eth and other ENS names)
 */
function FriendNameDisplay({ address }: { address: string }) {
  const { data: name, isLoading } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  if (isLoading || !name) {
    return null;
  }

  return <span style={{ fontWeight: "500" }}>{name}</span>;
}

export default FriendNameDisplay;

