import { useName } from "@coinbase/onchainkit/identity";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { baseSepolia } from "viem/chains";
import { useState, useEffect } from "react";
import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { encodeFunctionData, namehash, createPublicClient, http, decodeErrorResult } from "viem";
import { normalize } from "viem/ens";

// Base Sepolia Basenames Controller Contract Address
const BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT = "0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581" as const;

// Basename format for Base Sepolia
const BASE_SEPOLIA_NAME_SUFFIX = ".basetest.eth";

// Minimum registration duration (1 year in seconds)
const MIN_DURATION = 365 * 24 * 60 * 60;

// Bypass key for temporary access after basename creation
const BYPASS_KEY = "cdp-split-basename-bypass";

const basenamesABI = [
  {
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "owner", type: "address" },
          { name: "duration", type: "uint256" },
          { name: "resolver", type: "address" },
          { name: "data", type: "bytes[]" },
          { name: "reverseRecord", type: "bool" }
        ]
      }
    ],
    name: "register",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "id", type: "string" },
      { internalType: "uint256", name: "duration", type: "uint256" },
    ],
    name: "rentPrice",
    outputs: [
      { internalType: "uint256", name: "base", type: "uint256" },
      { internalType: "uint256", name: "premium", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
    {
    inputs: [{ internalType: "string", name: "id", type: "string" }],
    name: "available",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];


/**
 * Component that allows users to create their own basename during the login flow
 */
function BaseNameSetup() {
  const { evmAddress: address } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, data, error: sendError, status } = useSendUserOperation();

  const { data: baseName, isLoading: isLoadingName } = useName({
    address: address || undefined,
    chain: baseSepolia,
  });

  const [inputName, setInputName] = useState("");
  const [error, setError] = useState("");
  const [userOperationHash, setUserOperationHash] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const smartAccount = currentUser?.evmSmartAccounts?.[0];
  const isPending = status === "pending";
  const isSuccess = status === "success" && data;

  // Validate basename format
  const validateBasename = (name: string): string | null => {
    if (!name) {
      return "Basename is required";
    }

    // Remove .basetest.eth if present for validation
    const nameWithoutSuffix = name.replace(/\.basetest\.eth$/i, "").trim();

    if (nameWithoutSuffix.length < 3) {
      return "Basename must be at least 3 characters";
    }
    if (nameWithoutSuffix.length > 50) {
      return "Basename must be less than 50 characters";
    }
    // Allow alphanumeric, hyphens, and underscores
    if (!/^[a-z0-9-_]+$/i.test(nameWithoutSuffix)) {
      return "Basename can only contain letters, numbers, hyphens, and underscores";
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

    if (!smartAccount) {
      setError("Smart Account not found");
      setIsChecking(false);
      return;
    }

    const validationError = validateBasename(inputName);
    if (validationError) {
      setError(validationError);
      setIsChecking(false);
      return;
    }

    // Format the name (add .basetest.eth if not present)
    let formattedName = inputName.trim();
    if (!formattedName.toLowerCase().endsWith(BASE_SEPOLIA_NAME_SUFFIX)) {
      formattedName = `${formattedName}${BASE_SEPOLIA_NAME_SUFFIX}`;
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

      console.log("Registering basename:", {
        formattedName,
        normalizedName,
        node: node.toString(),
        nameId: nameId.toString(),
      });

    // Try to check availability (optional - may not be available on this contract)
    const available = await publicClient.readContract({
        address: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
        abi: basenamesABI,
        functionName: "available",
        args: [inputName],
    });

    if (!available) {
        setError(`The name "${formattedName}" is already registered. Please choose a different name.`);
        setIsChecking(false);
        return;
    }

      // Get the registration fee
      const rentPriceResult = await publicClient.readContract({
        address: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
        abi: basenamesABI,
        functionName: "rentPrice",
        args: [inputName, MIN_DURATION],
      });

      const [basePrice, premiumPrice] = rentPriceResult as [bigint, bigint];
      const totalFee = (basePrice + premiumPrice);

      console.log(totalFee);

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

      if (balance < totalFee) {
        setError(
          `Insufficient balance. Required: ${(Number(totalFee) / 1e18).toFixed(6)} ETH, Have: ${(Number(balance) / 1e18).toFixed(6)} ETH`
        );
        setIsChecking(false);
        return;
      }

      const registerData = encodeFunctionData({
  abi: basenamesABI,
  functionName: "register",
  args: [
    {
      name: inputName,
      owner: smartAccountAddress,
      duration: MIN_DURATION,
      resolver: "0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA", // or your preferred resolver
      data: [],        // no extra records
      reverseRecord: true, // recommended
    }
  ]
});
console.log("Register data:", registerData);
console.log("From:", smartAccountAddress);
      console.log("Sending registration transaction:", {
        contract: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
        name: inputName, 
        owner: smartAccountAddress,
        duration: MIN_DURATION.toString(),
        fee: totalFee.toString(),
      });
// Before sendUserOperation, simulate the call to get detailed error
try {
  const simulation = await publicClient.simulateContract({
    address: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
    abi: basenamesABI,
    functionName: "register",
    args: [
      {
        name: inputName,
        owner: smartAccountAddress,
        duration: MIN_DURATION,
        resolver: "0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA",
        data: [],
        reverseRecord: true,
      }
    ],
    account: smartAccountAddress as `0x${string}`,
    value: totalFee,
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
        abi: basenamesABI,
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
            to: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
            value: totalFee,
            data: registerData,
          },
        ],
      });

      setUserOperationHash(result.userOperationHash);
      setIsChecking(false);
    } catch (err: any) {
      setIsChecking(false);
      
      // Try to extract a more helpful error message
      let errorMessage = "Failed to register basename";
      
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
      console.error("Basename registration error:", err);
    }
  };

  // Set bypass flag immediately when transaction succeeds to allow redirect
  useEffect(() => {
    if (isSuccess) {
      console.log("Basename creation successful, setting bypass flag");
      // Set a temporary flag to allow redirect immediately
      // This will be cleared on next sign out
      try {
        localStorage.setItem(BYPASS_KEY, "true");
        console.log("Bypass flag set in localStorage:", localStorage.getItem(BYPASS_KEY));
        // Dispatch a custom event to notify BasenameGate immediately
        const event = new CustomEvent("basename-created", { detail: { timestamp: Date.now() } });
        window.dispatchEvent(event);
        console.log("Basename-created event dispatched");
      } catch (e) {
        console.error("Failed to set bypass flag:", e);
      }
    }
  }, [isSuccess]);

  // Show loading while checking for basename
  if (isLoadingName) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">Checking basename...</h2>
        <p>Please wait while we check if you have a basename.</p>
      </div>
    );
  }

  // If user already has a basename, this component shouldn't be shown
  // (BasenameGate handles this, but just in case)
  if (baseName) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">✅ You already have a basename!</h2>
        <p>Your basename: <strong>{baseName}</strong></p>
      </div>
    );
  }

  // Show success message after creation
  // BasenameGate will automatically show SignedInScreen once baseName is detected
  if (isSuccess) {
    return (
      <div className="card card--basename-setup">
        <h2 className="card-title">✅ Basename Created!</h2>
        <p>Your basename has been successfully created.</p>
        <p className="success-message">
          <strong>
            {inputName.toLowerCase().endsWith(BASE_SEPOLIA_NAME_SUFFIX)
              ? inputName
              : `${inputName.trim()}${BASE_SEPOLIA_NAME_SUFFIX}`}
          </strong>
        </p>
        <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#666" }}>
          Redirecting to main screen...
        </p>
      </div>
    );
  }

  return (
    <div className="card card--basename-setup">
      <h2 className="card-title">Create Your Basename</h2>
      <p>Choose a unique name for your wallet address on Base Sepolia.</p>
      <p className="smart-account-info">
        ℹ️ <strong>Note:</strong> This will register your basename on Base Sepolia testnet. The registration requires a
        small fee (approximately 0.0001 ETH on testnet).
      </p>

      <form onSubmit={handleSubmit} className="flex-col-container" style={{ gap: "1rem" }}>
        <div className="flex-col-container" style={{ gap: "0.5rem" }}>
          <label htmlFor="basename-input" style={{ fontWeight: "500" }}>
            Basename
          </label>
          <input
            id="basename-input"
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
          {inputName && !inputName.toLowerCase().endsWith(BASE_SEPOLIA_NAME_SUFFIX) && (
            <p style={{ fontSize: "0.875rem", color: "#666" }}>
              Will be registered as: <strong>{inputName.trim()}{BASE_SEPOLIA_NAME_SUFFIX}</strong>
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
          {isChecking ? "Checking..." : isPending ? "Creating..." : "Create Basename"}
        </Button>

        {(isPending || isChecking) && (
          <p style={{ fontSize: "0.875rem", color: "#666", textAlign: "center" }}>
            {isChecking ? "Checking name availability..." : "Processing your basename registration..."}
          </p>
        )}
      </form>
    </div>
  );
}

export default BaseNameSetup;
