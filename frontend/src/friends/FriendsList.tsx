import { useEvmAddress, useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { useState, useEffect } from "react";
import { useReadContract } from "../hooks/useReadContract";
import { baseSepolia, sepolia } from "viem/chains";
import { type Address, encodeFunctionData } from "viem";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";
import { AddressLink } from "./TransactionLink";

function FriendListItem({ 
  address
}: { 
  address: Address;
}) {
  const { data: ensName } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;

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
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, status } = useSendUserOperation();
  const [friends, setFriends] = useState<Address[]>([]);
  const [isRemovingAll, setIsRemovingAll] = useState(false);

  const smartAccount = currentUser?.evmSmartAccounts?.[0];

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

  // Refetch friends after successful removal
  useEffect(() => {
    if (status === "success" && isRemovingAll) {
      setTimeout(() => {
        refetchFriends();
        setIsRemovingAll(false);
      }, 2000);
    }
  }, [status, isRemovingAll, refetchFriends]);

  const handleRemoveAllFriends = async () => {
    if (!currentAddress || !smartAccount || friends.length === 0) {
      return;
    }

    if (!confirm(`Are you sure you want to remove all ${friends.length} friend(s)?`)) {
      return;
    }

    setIsRemovingAll(true);

    try {
      // Create removeFriend calls for each friend
      const calls = friends.map((friendAddress) => {
        const removeFriendData = encodeFunctionData({
          abi: FRIEND_REQUESTS_ABI,
          functionName: "removeFriend",
          args: [friendAddress],
        });

        return {
          to: FRIEND_REQUESTS_CONTRACT_ADDRESS,
          value: 0n,
          data: removeFriendData,
        };
      });

      // Execute all removals in a single user operation
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls,
      });

      console.log("All friends removed, user operation hash:", result.userOperationHash);
      
      // Refetch friends list after a short delay
      setTimeout(() => {
        if (contractFriends) {
          refetchFriends();
        }
      }, 2000);
    } catch (err: any) {
      console.error("Failed to remove all friends:", err);
      alert(`Failed to remove all friends: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRemovingAll(false);
    }
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 className="card-title" style={{ margin: 0 }}>👥 Your Friends ({friends.length})</h2>
        <button
          onClick={handleRemoveAllFriends}
          disabled={isRemovingAll || status === "pending"}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #f44336",
            background: "transparent",
            color: "#f44336",
            fontSize: "0.875rem",
            cursor: (isRemovingAll || status === "pending") ? "not-allowed" : "pointer",
            opacity: (isRemovingAll || status === "pending") ? 0.5 : 1,
          }}
        >
          {isRemovingAll || status === "pending" ? "Removing..." : "Remove All"}
        </button>
      </div>
      <div className="flex-col-container" style={{ gap: "0.5rem", maxHeight: "280px", overflowY: "auto", alignItems: "center" }}>
        {friends.map((friendAddress) => (
          <FriendListItem 
            key={friendAddress}
            address={friendAddress}
          />
        ))}
      </div>
    </div>
  );
}

export default FriendsList;

