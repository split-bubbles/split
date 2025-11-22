import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { baseSepolia, sepolia } from "viem/chains";
import { useState, useEffect } from "react";
import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { encodeFunctionData, namehash, createPublicClient, http, decodeErrorResult, parseAbi } from "viem";
import { normalize } from "viem/ens";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";

// ENS Controller Contract Address for .split.eth
const ENS_CONTROLLER_CONTRACT = "0xF7f85BF078269d040121bA17758bd0b483CAc440" as const;

// ENS name format
const ENS_NAME_SUFFIX = ".split.eth";

// Minimum registration duration (1 year in seconds)
const MIN_DURATION = 365 * 24 * 60 * 60;

// Bypass key for temporary access after ENS name creation
const BYPASS_KEY = "cdp-split-ens-name-bypass";

const ensControllerABI = parseAbi([
  'function register(string label, address owner) external',
  'function available(string label) external view returns (bool)',
])
// const resolverABI = [
//   {
//     inputs: [{ internalType: "address", name: "addr", type: "address" }],
//     name: "name",
//     outputs: [{ internalType: "string", name: "", type: "string" }],
//     stateMutability: "view",
//     type: "function",
//   },
// ] as const;


/**
 * Component that allows users to create their own ENS .split.eth name during the login flow
 */
function BaseNameSetup() {
  const { evmAddress: address } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, data, error: sendError, status } = useSendUserOperation();

  // Use ENS optimistic resolution
  const { data: ensName, isLoading: isLoadingEnsName } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });

  const [inputName, setInputName] = useState("");
  const [error, setError] = useState("");
  const [userOperationHash, setUserOperationHash] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const smartAccount = currentUser?.evmSmartAccounts?.[0];
  const isPending = status === "pending";
  const isSuccess = status === "success" && data;

  // Clear bypass if no ENS name found (after loading completes)
  useEffect(() => {
    if (!isLoadingEnsName && !ensName && address) {
      try {
        localStorage.removeItem(BYPASS_KEY);
        console.log("BaseNameSetup: No ENS name found, cleared bypass");
      } catch (e) {
        console.error("Failed to clear bypass:", e);
      }
    }
  }, [isLoadingEnsName, ensName, address]);

  // Validate ENS name format
  const validateEnsName = (name: string): string | null => {
    if (!name) {
      return "ENS name is required";
    }

    // Remove .split.eth if present for validation
    const nameWithoutSuffix = name.replace(/\.split\.eth$/i, "").trim();

    if (nameWithoutSuffix.length < 3) {
      return "ENS name must be at least 3 characters";
    }
    if (nameWithoutSuffix.length > 50) {
      return "ENS name must be less than 50 characters";
    }
    // Allow alphanumeric, hyphens, and underscores
    if (!/^[a-z0-9-_]+$/i.test(nameWithoutSuffix)) {
      return "ENS name can only contain letters, numbers, hyphens, and underscores";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUserOperationHash("");
    setIsChecking(true);

    if (!address) {
      setError("Wallet not connected");
      setIsChecking(false);
      return;
    }

    // Check if user already has an ENS name
    if (ensName) {
      setError(`You already have an ENS name registered: ${ensName}. Please refresh the page.`);
      setIsChecking(false);
      return;
    }

    if (!smartAccount) {
      setError("Smart Account not found");
      setIsChecking(false);
      return;
    }

    const validationError = validateEnsName(inputName);
    if (validationError) {
      setError(validationError);
      setIsChecking(false);
      return;
    }

    // Format the name (add .split.eth if not present)
    let formattedName = inputName.trim();
    if (!formattedName.toLowerCase().endsWith(ENS_NAME_SUFFIX)) {
      formattedName = `${formattedName}${ENS_NAME_SUFFIX}`;
    }

    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Calculate namehash for the full name
      const normalizedName = normalize(formattedName);
      const node = namehash(normalizedName);
      // Convert bytes32 node to uint256 (BigInt)
      const nameId = BigInt(node);

      console.log("Registering ENS name:", {
        formattedName,
        normalizedName,
        node: node.toString(),
        nameId: nameId.toString(),
      });

    // Try to check availability (optional - may not be available on this contract)
    const available = await publicClient.readContract({
        address: ENS_CONTROLLER_CONTRACT,
        abi: ensControllerABI,
        functionName: "available",
        args: [inputName],
    });

    if (!available) {
        setError(`The name "${formattedName}" is already registered. Please choose a different name.`);
        setIsChecking(false);
        return;
    }

      // Get the registration fee
      // const {base: basePrice, premium: premiumPrice} = await publicClient.readContract({
      //   address: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
      //   abi: basenamesABI,
      //   functionName: "rentPrice",
      //   args: [inputName, BigInt(MIN_DURATION)],
      // });

      // const totalFee = (basePrice + premiumPrice);

      // console.log(totalFee);

      // Extract smart account address
      let smartAccountAddress: string;
      if (typeof smartAccount === "string") {
        smartAccountAddress = smartAccount;
      } else {
        smartAccountAddress = (smartAccount as any)?.address || (smartAccount as any)?.id || address;
      }

      if (!smartAccountAddress || !smartAccountAddress.startsWith("0x") || smartAccountAddress.length !== 42) {
        setError("Invalid smart account address");
        setIsChecking(false);
        return;
      }

      // Check balance
      const balance = await publicClient.getBalance({
        address: smartAccountAddress as `0x${string}`,
      });

      console.log(balance);

      // if (balance < totalFee) {
      //   setError(
      //     `Insufficient balance. Required: ${(Number(totalFee) / 1e18).toFixed(6)} ETH, Have: ${(Number(balance) / 1e18).toFixed(6)} ETH`
      //   );
      //   setIsChecking(false);
      //   return;
      // }

      const registerData = encodeFunctionData({
  abi: ensControllerABI,
  functionName: "register",
  args: [
    inputName,
    smartAccountAddress as `0x${string}`
  ]
});
console.log("Register data:", registerData);
console.log("From:", smartAccountAddress);
      console.log("Sending registration transaction:", {
        contract: ENS_CONTROLLER_CONTRACT,
        name: inputName, 
        owner: smartAccountAddress,
        duration: MIN_DURATION.toString(),
        // fee: totalFee.toString(),
      });
// Before sendUserOperation, simulate the call to get detailed error
try {
  const simulation = await publicClient.simulateContract({
    address: ENS_CONTROLLER_CONTRACT,
    abi: ensControllerABI,
    functionName: "register",
    args: [
    inputName,
    smartAccountAddress as `0x${string}`
    ],
    account: smartAccountAddress as `0x${string}`,
  });
  console.log("Simulation successful:", simulation);
} catch (simError: any) {
  console.error("Contract simulation failed:", simError);
  
  // Try to decode the revert reason
  if (simError?.cause?.data) {
    console.error("Revert data:", simError.cause.data);
    
    // Try to decode as a string revert reason
    try {
      const decoded = decodeErrorResult({
        abi: ensControllerABI,
        data: simError.cause.data,
      });
      console.error("Decoded revert reason:", decoded);
    } catch (decodeErr) {
      // If it's not a standard error, try to get the raw data
      console.error("Could not decode revert reason, raw data:", simError.cause.data);
    }
  }
  
  // Check for common revert reasons
  if (simError?.cause?.reason) {
    console.error("Revert reason:", simError.cause.reason);
  }
  
  // Check the short message for clues
  if (simError?.shortMessage) {
    console.error("Short message:", simError.shortMessage);
  }
  
  // Don't throw here - let it continue to show the error to user
  setError(`Registration failed: ${simError.shortMessage || simError.message || "Unknown error"}`);
  setIsChecking(false);
  return;
}




      // Send the transaction
      const result = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: "base-sepolia",
        calls: [
          {
            to: ENS_CONTROLLER_CONTRACT,
            data: registerData,
          },
          // {
          //   to: BASE_SEPOLIA_RESOLVER,
          //   value: 0n,
          //   data: encodeFunctionData({
          //     abi: resolverAbi,
          //     functionName: "setAddr",
          //     args: [node, toCoinType(baseSepolia.id), smartAccountAddress as `0x${string}`],
          //   }),
          // },
          // {
          //   to: BASE_SEPOLIA_RESOLVER,
          //   value: 0n,
          //   data: encodeFunctionData({
          //     abi: resolverAbi,
          //     functionName: "setAddr",
          //     args: [node, toCoinType(base.id), smartAccountAddress as `0x${string}`],
          //   }),
          // },
          {
            to: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
            data: encodeFunctionData({
              abi: parseAbi(['function setName(string memory name) external returns (bytes32)']),
              functionName: "setName",
              args: [normalizedName],
            }),
          }
        ],
      });

      setUserOperationHash(result.userOperationHash);
      setIsChecking(false);
    } catch (err: any) {
      setIsChecking(false);
      
      // Try to extract a more helpful error message
      let errorMessage = "Failed to register ENS name";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Check for common error patterns
        if (err.message.includes("already registered") || err.message.includes("already exists")) {
          errorMessage = `The name "${formattedName}" is already registered. Please choose a different name.`;
        } else if (err.message.includes("insufficient") || err.message.includes("balance")) {
          errorMessage = "Insufficient balance to complete registration.";
        } else if (err.message.includes("execution reverted")) {
          errorMessage = `Registration failed. The name "${formattedName}" may already be registered or there was an issue with the registration.`;
        }
      }
      
      setError(errorMessage);
      console.error("ENS name registration error:", err);
    }
  };

  // Set bypass flag immediately when transaction succeeds to allow redirect
  useEffect(() => {
    if (isSuccess) {
      console.log("ENS name creation successful, setting bypass flag");
      // Set a temporary flag to allow redirect immediately
      // This will be cleared on next sign out
      try {
        localStorage.setItem(BYPASS_KEY, "true");
        console.log("Bypass flag set in localStorage:", localStorage.getItem(BYPASS_KEY));
        // Dispatch a custom event to notify BasenameGate immediately
        const event = new CustomEvent("ens-name-created", { detail: { timestamp: Date.now() } });
        window.dispatchEvent(event);
        console.log("ENS name created event dispatched");
      } catch (e) {
        console.error("Failed to set bypass flag:", e);
      }
    }
  }, [isSuccess]);

  // Show loading while checking for ENS name
  if (isLoadingEnsName) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">Checking ENS name...</h2>
        <p>Please wait while we check if you have a .split.eth name.</p>
      </div>
    );
  }

  // If user already has an ENS name, this component shouldn't be shown
  // (BasenameGate handles this, but just in case)
  if (ensName) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">✅ You already have an ENS name!</h2>
        <p>Your ENS name: <strong>{ensName}</strong></p>
        <p style={{ fontSize: "0.875rem", color: "var(--cdp-example-text-secondary-color)", marginTop: "0.5rem" }}>
          Found via ENS resolution.
        </p>
      </div>
    );
  }

  // Show success message after creation
  // BasenameGate will automatically show SignedInScreen once baseName is detected
  if (isSuccess) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">✅ ENS Name Created!</h2>
        <p>Your .split.eth name has been successfully created.</p>
        <p className="success-message">
          <strong>
            {inputName.toLowerCase().endsWith(ENS_NAME_SUFFIX)
              ? inputName
              : `${inputName.trim()}${ENS_NAME_SUFFIX}`}
          </strong>
        </p>
        <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#666" }}>
          Redirecting to main screen...
        </p>
      </div>
    );
  }

  // Get smart account address for display and faucet link
  let smartAccountAddress: string | null = null;
  if (smartAccount) {
    if (typeof smartAccount === "string") {
      smartAccountAddress = smartAccount;
    } else {
      smartAccountAddress = (smartAccount as any)?.address || (smartAccount as any)?.id || address || null;
    }
  } else if (address) {
    smartAccountAddress = address;
  }

  // Generate faucet link with user's address
  const faucetLink = smartAccountAddress
    ? `https://portal.cdp.coinbase.com/products/faucet?projectId=7d5a36cf-0376-47ed-8eb1-9e10848c6167&token=ETH&network=base-sepolia&address=${smartAccountAddress}`
    : null;

  return (
    <div className="card card--basename-setup">
      <h2 className="card-title">Create Your ENS Name</h2>
      <p>Choose a unique .split.eth name for your wallet address.</p>
      
      {smartAccountAddress && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "var(--cdp-example-bg-low-contrast-color)",
          borderRadius: "0.5rem",
          marginBottom: "1rem",
          fontSize: "0.875rem",
          color: "var(--cdp-example-text-color)",
        }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>Wallet Address:</strong>{" "}
            <code style={{
              backgroundColor: "var(--cdp-example-card-bg-color)",
              color: "var(--cdp-example-text-color)",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontSize: "0.8rem",
              border: "1px solid var(--cdp-example-card-border-color)",
            }}>
              {smartAccountAddress}
            </code>
          </div>
          {faucetLink && (
            <div>
              <strong>Need ETH?</strong>{" "}
              <a
                href={faucetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--cdp-example-accent-color)",
                  textDecoration: "underline",
                }}
              >
                Get testnet ETH from the faucet
              </a>
            </div>
          )}
        </div>
      )}

      <p className="smart-account-info">
        ℹ️ <strong>Note:</strong> This will register your .split.eth name on Base Sepolia testnet. The registration requires a
        small fee (approximately 0.0001 ETH on testnet).
      </p>

      <form onSubmit={handleSubmit} className="flex-col-container" style={{ gap: "1rem" }}>
        <div className="flex-col-container" style={{ gap: "0.5rem" }}>
          <label htmlFor="ens-name-input" style={{ fontWeight: "500" }}>
            ENS Name (without .split.eth)
          </label>
          <input
            id="ens-name-input"
            type="text"
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value);
              setError("");
            }}
            placeholder="my-awesome-name"
            disabled={isPending || isChecking || !smartAccount}
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: error ? "1px solid red" : "1px solid #ccc",
              fontSize: "1rem",
            }}
          />
          {inputName && !inputName.toLowerCase().endsWith(ENS_NAME_SUFFIX) && (
            <p style={{ fontSize: "0.875rem", color: "#666" }}>
              Will be registered as: <strong>{inputName.trim()}{ENS_NAME_SUFFIX}</strong>
            </p>
          )}
          {error && (
            <p style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>
              {error}
            </p>
          )}
          {sendError && (
            <p style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>
              {sendError.message}
            </p>
          )}
          {userOperationHash && (
            <p style={{ fontSize: "0.875rem", color: "#666", margin: 0 }}>
              User Operation Hash:{" "}
              <code>
                {userOperationHash.slice(0, 6)}...{userOperationHash.slice(-4)}
              </code>
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending || isChecking || !inputName.trim() || !smartAccount}
          className="tx-button"
        >
          {isChecking ? "Checking..." : isPending ? "Creating..." : "Create ENS Name"}
        </Button>

        {(isPending || isChecking) && (
          <p style={{ fontSize: "0.875rem", color: "#666", textAlign: "center" }}>
            {isChecking ? "Checking name availability..." : "Processing your .split.eth name registration..."}
          </p>
        )}
      </form>
    </div>
  );
}

export default BaseNameSetup;
