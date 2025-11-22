import { useEvmAddress, useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { useReadContract } from "../hooks/useReadContract";
import { useState, useEffect } from "react";
import { createPublicClient, http, isAddress, getAddress, encodeFunctionData, type Address, maxUint256 } from "viem";
import { normalize } from "viem/ens";
import { baseSepolia, sepolia } from "viem/chains";
import { FRIEND_REQUESTS_ABI, FRIEND_REQUESTS_CONTRACT_ADDRESS } from "../contracts/FriendRequests";
import FriendNameDisplay from "./FriendNameDisplay";
import { TransactionLink, AddressLink } from "./TransactionLink";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";

// USDC contract address on Base Sepolia
const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// ERC20 ABI for approve function
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Component to display a friend in the friends list with ENS name resolution
 */
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

  return (
    <div
      style={{
        padding: "0.75rem",
        borderRadius: "0.5rem",
        border: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: "500" }}>
          {ensName ? (
            <span>{ensName}</span>
          ) : (
            <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
          )}
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>
          {ensName ? (
            <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
          ) : (
            <AddressLink address={address} />
          )}
        </p>
        {sentRequestTransactions.has(address.toLowerCase()) && (
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem" }}>
            <TransactionLink 
              hash={sentRequestTransactions.get(address.toLowerCase())!} 
              label="View Request Transaction" 
            />
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Component for sending friend requests using the smart contract
 */
function AddFriend() {
  const { evmAddress: currentAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, data, error: sendError, status } = useSendUserOperation();
  
  const [input, setInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<Address | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState("");
  const [userOperationHash, setUserOperationHash] = useState<`0x${string}` | null>(null);
  const [isSending, setIsSending] = useState(false);

  const smartAccount = currentUser?.evmSmartAccounts?.[0];

  const [sentRequestTransactions, setSentRequestTransactions] = useState<Map<string, `0x${string}`>>(new Map());

  const isPending = status === "pending";
  const isSuccess = status === "success" && data;

  // Reset form after successful transaction
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        setInput("");
        setResolvedAddress(null);
        setResolvedName(null);
        setError("");
      }, 2000);
    }
  }, [isSuccess]);

  // Store transaction hash when user operation hash is available
  useEffect(() => {
    if (userOperationHash && resolvedAddress) {
      setSentRequestTransactions((prev) => {
        const newMap = new Map(prev);
        newMap.set(resolvedAddress.toLowerCase(), userOperationHash);
        return newMap;
      });
    }
  }, [userOperationHash, resolvedAddress]);

  // Resolve input (ENS name or address)
  const resolveInput = async () => {
    if (!input.trim()) {
      setError("");
      setResolvedAddress(null);
      setResolvedName(null);
      return;
    }

    setIsResolving(true);
    setError("");
    setResolvedAddress(null);
    setResolvedName(null);

    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const trimmedInput = input.trim();

      // Check if input is already a valid address
      if (isAddress(trimmedInput)) {
        const normalizedAddress = getAddress(trimmedInput) as Address;
        setResolvedAddress(normalizedAddress);
      } else {
        // Try to resolve as ENS name or Base Sepolia basename
        try {
          let nameToResolve = trimmedInput;

          if (!nameToResolve.includes(".")) {
            // Try .basetest.eth first (Base Sepolia)
            try {
              const baseName = `${nameToResolve}.basetest.eth`;
              const normalizedBaseName = normalize(baseName);
              const baseAddress = await publicClient.getEnsAddress({
                name: normalizedBaseName,
              });

              if (baseAddress) {
                setResolvedAddress(baseAddress as Address);
                setResolvedName(baseName);
                return;
              }
            } catch (baseError) {
              // Continue to try standard ENS
            }

            nameToResolve = `${nameToResolve}.eth`;
          }

          const normalizedName = normalize(nameToResolve);
          const address = await publicClient.getEnsAddress({
            name: normalizedName,
          });

          if (address) {
            setResolvedAddress(address as Address);
            setResolvedName(trimmedInput.includes(".") ? trimmedInput : nameToResolve);
          } else {
            setError(`Could not resolve "${trimmedInput}" to an address`);
          }
        } catch (e: any) {
          setError(`Could not resolve "${trimmedInput}". Please enter a valid Ethereum address (0x...) or ENS name.`);
          console.error("Resolution error:", e);
        }
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to resolve input");
      console.error("Resolution error:", err);
    } finally {
      setIsResolving(false);
    }
  };

  // Resolve when input changes (with debounce)
  useEffect(() => {
    if (!input.trim()) {
      setResolvedAddress(null);
      setResolvedName(null);
      setError("");
      return;
    }

    const timer = setTimeout(() => {
      resolveInput();
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Check if request already exists
  const { data: hasRequestData } = useReadContract({
    address: resolvedAddress && currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "hasRequest",
    args: resolvedAddress && currentAddress ? [resolvedAddress, currentAddress] : undefined,
    query: {
      enabled: !!resolvedAddress && !!currentAddress,
    },
  });
  const hasRequest = hasRequestData as boolean | undefined;

  // Check if already friends
  const { data: isAlreadyFriendData } = useReadContract({
    address: resolvedAddress && currentAddress ? FRIEND_REQUESTS_CONTRACT_ADDRESS : undefined,
    abi: FRIEND_REQUESTS_ABI,
    functionName: "isFriend",
    args: resolvedAddress && currentAddress ? [currentAddress, resolvedAddress] : undefined,
    query: {
      enabled: !!resolvedAddress && !!currentAddress,
    },
  });
  const isAlreadyFriend = isAlreadyFriendData as boolean | undefined;

  // Send friend request
  const handleSendRequest = async () => {
    console.log("handleSendRequest called");
    console.log("resolvedAddress:", resolvedAddress);
    console.log("currentAddress:", currentAddress);
    console.log("smartAccount:", smartAccount);
    console.log("isAlreadyFriend:", isAlreadyFriend);
    console.log("hasRequest:", hasRequest);

    if (!resolvedAddress || !currentAddress) {
      setError("Please enter a valid address or ENS name");
      return;
    }

    if (!smartAccount) {
      setError("Smart Account not found. Please ensure you're signed in.");
      return;
    }

    if (resolvedAddress.toLowerCase() === currentAddress.toLowerCase()) {
      setError("You cannot send a friend request to yourself");
      return;
    }

    if (isAlreadyFriend) {
      setError("You are already friends with this address");
      return;
    }

    if (hasRequest) {
      setError("You have already sent a friend request to this address");
      return;
    }

    setError("");
    setUserOperationHash(null);
    setIsSending(true);

    try {
      console.log("Encoding function call...");
      // Encode the friend request function call
      const friendRequestData = encodeFunctionData({
        abi: FRIEND_REQUESTS_ABI,
        functionName: "sendFriendRequest",
        args: [resolvedAddress],
      });

      // Encode the USDC approval - pre-approve recipient to spend requester's USDC
      const usdcApprovalData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [resolvedAddress, maxUint256],
      });

      console.log("Function data encoded:", friendRequestData);
      console.log("Calling sendUserOperation...");

      // Send user operation via CDP with both calls
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls: [
          {
            to: FRIEND_REQUESTS_CONTRACT_ADDRESS,
            value: 0n,
            data: friendRequestData,
          },
          {
            to: USDC_ADDRESS,
            value: 0n,
            data: usdcApprovalData,
          },
        ],
      });

      console.log("sendUserOperation result:", result);
      setUserOperationHash(result.userOperationHash);
      console.log("Friend request sent, user operation hash:", result.userOperationHash);
    } catch (err: any) {
      console.error("Send request error caught:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send friend request";
      setError(errorMessage);
      console.error("Error details:", {
        message: err?.message,
        cause: err?.cause,
        stack: err?.stack,
        fullError: err,
      });
    } finally {
      setIsSending(false);
    }
  };

  const isLoading = isPending || isSending;

  // Log status changes for debugging
  useEffect(() => {
    console.log("AddFriend status:", { status, isPending, isSuccess, data, sendError });
  }, [status, isPending, isSuccess, data, sendError]);

  // Log button state for debugging
  const buttonDisabled = !resolvedAddress || isLoading || isResolving || isAlreadyFriend || hasRequest || !smartAccount;
  useEffect(() => {
    console.log("Button state check:", {
      buttonDisabled,
      resolvedAddress: !!resolvedAddress,
      resolvedAddressValue: resolvedAddress,
      isLoading,
      isResolving,
      isAlreadyFriend,
      hasRequest,
      smartAccount: !!smartAccount,
      smartAccountValue: smartAccount,
    });
  }, [buttonDisabled, resolvedAddress, isLoading, isResolving, isAlreadyFriend, hasRequest, smartAccount]);

  return (
    <div className="card card--add-friend">
      <h2 className="card-title">👋 Add Friends</h2>
      <p style={{ color: "var(--cdp-example-text-secondary-color)", fontSize: "0.95rem" }}>Send a friend request by entering their address or ENS name</p>

      <div className="flex-col-container" style={{ gap: "1rem" }}>
        <div className="flex-col-container" style={{ gap: "0.5rem" }}>
          <label htmlFor="friend-input" style={{ fontWeight: "500" }}>
            Address or ENS Name
          </label>
          <input
            id="friend-input"
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
            placeholder="0x... or name.eth"
            disabled={isResolving || isLoading}
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: error ? "1px solid red" : "1px solid #ccc",
              fontSize: "1rem",
            }}
          />
          {isResolving && (
            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
              Resolving...
            </p>
          )}
          {isSending && (
            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
              Sending friend request...
            </p>
          )}
          {resolvedAddress && !isResolving && (
            <div style={{ fontSize: "0.875rem", color: "#666" }}>
              <p style={{ margin: "0.25rem 0" }}>
                <strong>Resolved:</strong> {resolvedAddress}
              </p>
              {resolvedName && (
                <p style={{ margin: "0.25rem 0" }}>
                  <strong>Name:</strong> {resolvedName}
                </p>
              )}
            </div>
          )}
          {error && (
            <p style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>
              {error}
            </p>
          )}
          {hasRequest && resolvedAddress && (
            <div style={{ fontSize: "0.875rem", margin: 0 }}>
              <p style={{ color: "orange", margin: "0.25rem 0" }}>
                ⚠️ You have already sent a friend request to this address.
              </p>
              {sentRequestTransactions.has(resolvedAddress.toLowerCase()) && (
                <p style={{ margin: "0.25rem 0" }}>
                  <TransactionLink 
                    hash={sentRequestTransactions.get(resolvedAddress.toLowerCase())!} 
                    label="View Request Transaction" 
                  />
                </p>
              )}
            </div>
          )}
          {isSuccess && !error && userOperationHash && (
            <div style={{ fontSize: "0.875rem", margin: 0 }}>
              <p style={{ color: "green", margin: "0.25rem 0" }}>
                Friend request sent successfully!
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                <TransactionLink hash={userOperationHash} label="View Transaction on BaseScan" />
              </p>
            </div>
          )}
          {sendError && (
            <p style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>
              {sendError.message || "Failed to send friend request"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            console.log("Button clicked!");
            console.log("Button disabled state:", buttonDisabled);
            e.preventDefault();
            e.stopPropagation();
            handleSendRequest();
          }}
          disabled={buttonDisabled}
          className="tx-button"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "0.5rem",
            border: "none",
            backgroundColor: buttonDisabled ? "#ccc" : "#0052FF",
            color: "white",
            fontSize: "1rem",
            cursor: buttonDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Sending..." : "Send Friend Request"}
        </button>
        {!smartAccount && (
          <p style={{ color: "orange", fontSize: "0.875rem", margin: 0 }}>
            Smart Account not available. Please ensure you're signed in.
          </p>
        )}
      </div>
    </div>
  );
}

export default AddFriend;
