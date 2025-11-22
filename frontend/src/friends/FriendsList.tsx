import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useState, useEffect } from "react";
import { useReadContract } from "../hooks/useReadContract";
import { baseSepolia, sepolia } from "viem/chains";
import { type Address } from "viem";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";
import { TransactionLink, AddressLink } from "./TransactionLink";

function FriendListItem({ 
  address, 
  sentRequestTransactions 
}: { 
  address: Address;
  sentRequestTransactions: Map<string, `0x${string}`>;
}) {
  const { data: ensName } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayAddress = address.slice(0, 6) + "..." + address.slice(-4);

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        border: "1px solid #ccc",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "3rem",
        height: "3rem",
        width: "90%",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        <span style={{ fontWeight: "500", fontSize: "0.95rem" }}>
          {displayName}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <AddressLink address={address} />
      </div>
    </div>
  );
}

/**
 * Component to display the list of friends
 */
function FriendsList() {
  const { evmAddress: currentAddress } = useEvmAddress();
  const [friends, setFriends] = useState<Address[]>([]);
  const [sentRequestTransactions, setSentRequestTransactions] = useState<Map<string, `0x${string}`>>(new Map());

  // Read friends from contract
  const { data: contractFriends, refetch: refetchFriends } = useReadContract({
    address: currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "getFriends",
    args: currentAddress ? [currentAddress] : undefined,
    query: {
      enabled: !!currentAddress,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  useEffect(() => {
    if (contractFriends) {
      setFriends(contractFriends as Address[]);
    }
  }, [contractFriends]);

  // Load sent request transactions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sent-friend-requests");
      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map<string, `0x${string}`>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(key.toLowerCase(), value as `0x${string}`);
        });
        setSentRequestTransactions(map);
      }
    } catch (e) {
      console.error("Failed to load sent friend requests:", e);
    }
  }, []);

  if (friends.length === 0) {
    return (
      <div className="card card--friends-list">
        <h2 className="card-title">👥 Your Friends</h2>
        <div className="empty-state" style={{ minHeight: "auto", padding: "2rem 1rem" }}>
          <span className="empty-icon" style={{ fontSize: "2rem" }}>👥</span>
          <p style={{ fontSize: "0.95rem", color: "var(--cdp-example-text-secondary-color)" }}>
            No friends yet. Add friends to get started!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--friends-list">
      <h2 className="card-title">👥 Your Friends ({friends.length})</h2>
      <div className="flex-col-container" style={{ gap: "0.5rem", maxHeight: "280px", overflowY: "auto", alignItems: "center" }}>
        {friends.map((friendAddress) => (
          <FriendListItem 
            key={friendAddress}
            address={friendAddress}
            sentRequestTransactions={sentRequestTransactions}
          />
        ))}
      </div>
    </div>
  );
}

export default FriendsList;

