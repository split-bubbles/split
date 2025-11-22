import { useEvmAddress, useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { useReadContract } from "../hooks/useReadContract";
import { useState, useEffect } from "react";
import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import FriendNameDisplay from "./FriendNameDisplay";
import { TransactionLink, AddressLink } from "./TransactionLink";
import { type Address, encodeFunctionData } from "viem";
import { createPublicClient, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";

/**
 * Component for managing pending friend request approvals using the smart contract
 */
function PendingApprovals() {
  const { evmAddress: currentAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, data, error: sendError, status } = useSendUserOperation();
  
  const [pendingRequestAddresses, setPendingRequestAddresses] = useState<Address[]>([]);
  const [requestTimestamps, setRequestTimestamps] = useState<Map<string, number>>(new Map());
  const [requestTransactions, setRequestTransactions] = useState<Map<string, `0x${string}`>>(new Map());

  const smartAccount = currentUser?.evmSmartAccounts?.[0];

  // Read pending requests from contract
  const { data: pendingRequests, refetch: refetchPending } = useReadContract({
    address: currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "getPendingRequests",
    args: currentAddress ? [currentAddress] : undefined,
    query: {
      enabled: !!currentAddress,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Get request details for each pending request
  useEffect(() => {
    if (!pendingRequests || !currentAddress) {
      setPendingRequestAddresses([]);
      return;
    }

    const addresses = pendingRequests as Address[];
    setPendingRequestAddresses(addresses);

    // Fetch timestamps and original request transactions for each request from the contract
    const fetchRequestDetails = async () => {
      const timestamps = new Map<string, number>();
      const requestTxs = new Map<string, `0x${string}`>();
      
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Query events to find the original request transactions
      // Limit to last 100000 blocks to avoid RPC errors
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n;
        
        const logs = await publicClient.getLogs({
          address: FRIEND_REQUESTS_CONTRACT_ADDRESS,
          event: parseAbiItem("event FriendRequestSent(address indexed from, address indexed to, uint256 timestamp)"),
          args: {
            to: currentAddress,
          },
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        // Map request transactions by requester address
        for (const log of logs) {
          if (log.args.from && log.args.timestamp) {
            const requesterAddr = log.args.from.toLowerCase();
            timestamps.set(requesterAddr, Number(log.args.timestamp) * 1000);
            // Store the transaction hash
            if (log.transactionHash) {
              requestTxs.set(requesterAddr, log.transactionHash);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch events:", e);
      }

      // Also read from contract for any missing data
      for (const addr of addresses) {
        const addrLower = addr.toLowerCase();
        if (!timestamps.has(addrLower)) {
          try {
            const request = await publicClient.readContract({
              address: FRIEND_REQUESTS_CONTRACT_ADDRESS,
              abi: FRIEND_REQUESTS_ABI,
              functionName: "requests",
              args: [currentAddress, addr],
            }) as { from: Address; timestamp: bigint; exists: boolean };
            
            if (request.exists) {
              timestamps.set(addrLower, Number(request.timestamp) * 1000);
            }
          } catch (e) {
            console.error("Failed to fetch timestamp:", e);
            timestamps.set(addrLower, Date.now());
          }
        }
      }
      
      setRequestTimestamps(timestamps);
      setRequestTransactions(requestTxs);
    };

    fetchRequestDetails();
  }, [pendingRequests, currentAddress]);

  const [transactionHistory, setTransactionHistory] = useState<Map<string, `0x${string}`>>(new Map());
  const [currentAction, setCurrentAction] = useState<{ type: "approve" | "reject"; address: Address } | null>(null);
  const [userOperationHash, setUserOperationHash] = useState<`0x${string}` | null>(null);

  const isPending = status === "pending";
  const isSuccess = status === "success" && data;

  // Refetch after successful transaction
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        refetchPending();
      }, 2000);
    }
  }, [isSuccess, refetchPending]);

  // Store transaction hash when user operation hash is available
  useEffect(() => {
    if (userOperationHash && currentAction) {
      setTransactionHistory((prev) => {
        const newMap = new Map(prev);
        newMap.set(`${currentAction.type}-${currentAction.address}`, userOperationHash);
        return newMap;
      });
      setCurrentAction(null);
    }
  }, [userOperationHash, currentAction]);

  // Approve a friend request
  const handleApprove = async (requesterAddress: Address) => {
    if (!currentAddress || !smartAccount) {
      console.error("Missing currentAddress or smartAccount");
      return;
    }

    try {
      setCurrentAction({ type: "approve", address: requesterAddress });
      setUserOperationHash(null);

      // Encode the function call
      const functionData = encodeFunctionData({
        abi: FRIEND_REQUESTS_ABI,
        functionName: "approveFriendRequest",
        args: [requesterAddress],
      });

      // Send user operation via CDP
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls: [
          {
            to: FRIEND_REQUESTS_CONTRACT_ADDRESS,
            value: 0n,
            data: functionData,
          },
        ],
      });

      setUserOperationHash(result.userOperationHash);
      console.log("Friend request approved, user operation hash:", result.userOperationHash);
    } catch (err: any) {
      console.error("Failed to approve request:", err);
      setCurrentAction(null);
      setUserOperationHash(null);
    }
  };

  // Reject a friend request
  const handleReject = async (requesterAddress: Address) => {
    if (!currentAddress || !smartAccount) {
      console.error("Missing currentAddress or smartAccount");
      return;
    }

    try {
      setCurrentAction({ type: "reject", address: requesterAddress });
      setUserOperationHash(null);

      // Encode the function call
      const functionData = encodeFunctionData({
        abi: FRIEND_REQUESTS_ABI,
        functionName: "rejectFriendRequest",
        args: [requesterAddress],
      });

      // Send user operation via CDP
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls: [
          {
            to: FRIEND_REQUESTS_CONTRACT_ADDRESS,
            value: 0n,
            data: functionData,
          },
        ],
      });

      setUserOperationHash(result.userOperationHash);
      console.log("Friend request rejected, user operation hash:", result.userOperationHash);
    } catch (err: any) {
      console.error("Failed to reject request:", err);
      setCurrentAction(null);
      setUserOperationHash(null);
    }
  };

  if (!currentAddress) {
    return null;
  }

  const isLoading = isPending;

  if (pendingRequestAddresses.length === 0 && !isLoading) {
    return (
      <div className="card card--pending-approvals">
        <h2 className="card-title">⏳ Pending Approvals</h2>
        <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.95rem" }}>No pending friend requests</p>
      </div>
    );
  }

  return (
    <div className="card card--pending-approvals">
      <h2 className="card-title">⏳ Pending Approvals ({pendingRequestAddresses.length})</h2>
      <p style={{ fontSize: "0.95rem", color: "var(--cdp-example-text-secondary-color)", marginBottom: "1rem" }}>
        You have {pendingRequestAddresses.length} friend request{pendingRequestAddresses.length !== 1 ? "s" : ""} to review
      </p>

      <div className="flex-col-container" style={{ gap: "0.75rem" }}>
        {pendingRequestAddresses.map((requesterAddress) => {
          const timestamp = requestTimestamps.get(requesterAddress.toLowerCase()) || Date.now();
          return (
            <div
              key={requesterAddress}
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid #ccc",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: "500" }}>
                  <FriendNameDisplay address={requesterAddress} />
                  <span style={{ marginLeft: "0.5rem" }}>
                    {requesterAddress.slice(0, 6)}...{requesterAddress.slice(-4)}
                  </span>
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#666" }}>
                  <AddressLink address={requesterAddress} />
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#999" }}>
                  Requested {new Date(timestamp).toLocaleDateString()}
                </p>
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {requestTransactions.get(requesterAddress.toLowerCase()) && (
                    <p style={{ margin: 0 }}>
                      <TransactionLink 
                        hash={requestTransactions.get(requesterAddress.toLowerCase())!} 
                        label="View Request Transaction" 
                      />
                    </p>
                  )}
                {(() => {
                  const approveTx = transactionHistory.get(`approve-${requesterAddress}`);
                  const rejectTx = transactionHistory.get(`reject-${requesterAddress}`);
                  const currentTx = (userOperationHash && currentAction?.address === requesterAddress) ? userOperationHash : null;
                  const txHash = approveTx || rejectTx || currentTx;
                  
                  if (txHash) {
                    return (
                      <p style={{ margin: 0 }}>
                        <TransactionLink 
                          hash={txHash} 
                          label={approveTx ? "View Approval Transaction" : rejectTx ? "View Rejection Transaction" : "View Transaction"} 
                        />
                      </p>
                    );
                  }
                  return null;
                })()}
                {sendError && currentAction?.address === requesterAddress && (
                  <p style={{ margin: "0.25rem 0 0 0", color: "red", fontSize: "0.75rem" }}>
                    {sendError.message || "Transaction failed"}
                  </p>
                )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <Button
                  type="button"
                  onClick={() => handleApprove(requesterAddress)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Processing..." : "Approve"}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleReject(requesterAddress)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? "Processing..." : "Reject"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PendingApprovals;
