import { useName } from "@coinbase/onchainkit/identity";
import { baseSepolia } from "viem/chains";
import { type Address } from "viem";

/**
 * Component to display a friend's name if available
 */
function FriendNameDisplay({ address }: { address: string }) {
  const { data: name, isLoading } = useName({
    address: address as Address,
    chain: baseSepolia,
  });

  if (isLoading || !name) {
    return null;
  }

  return <span style={{ fontWeight: "500" }}>{name}</span>;
}

export default FriendNameDisplay;

