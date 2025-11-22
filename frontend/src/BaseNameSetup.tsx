import { useName } from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { useCurrentUser, useSendUserOperation } from "@coinbase/cdp-hooks";
import { baseSepolia } from "viem/chains";
import { useState, useEffect } from "react";
import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { encodeFunctionData, namehash, createPublicClient, http, formatUnits, parseEther } from "viem";
import { normalize } from "viem/ens";

// Base Sepolia Basenames NFT Contract Address
// From successful transaction: https://sepolia.basescan.org/tx/0x5dc88623a9159fbd05dd682c985f5d1a849dc637c6697ef1a46f0ae6e2da99c2
const BASE_SEPOLIA_BASENAMES_CONTRACT = "0xA0c70ec36c010B55E3C434D6c6EbEEC50c705794" as const;

const BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT = "0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581" as const;

// Basename format for Base Sepolia
const BASE_SEPOLIA_NAME_SUFFIX = ".basetest.eth";

// Minimum registration duration (1 year in seconds)
const MIN_DURATION = 365 * 24 * 60 * 60;

const basenamesABI = [
  {
    inputs: [
      { name: "payableAmount", type: "uint256" },
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
  const { address } = useAccount();
  const { currentUser } = useCurrentUser();
  const { sendUserOperation, data, error: sendError, status } = useSendUserOperation();

  const { data: baseName, isLoading: isLoadingName, refetch } = useName({
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

    console.log(available);


      // Get the registration fee
      const [basePrice, premiumPrice] = await publicClient.readContract({
        address: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
        abi: basenamesABI,
        functionName: "rentPrice",
        args: [inputName, MIN_DURATION],
      });

      console.log(basePrice, premiumPrice);

      const totalFee = basePrice + premiumPrice;

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
    totalFee, // payableAmount (ETH)
    {
      name: inputName,
      owner: smartAccountAddress,
      duration: MIN_DURATION,
      resolver: "0x0000000000000000000000000000000000000000", // or your preferred resolver
      data: [],        // no extra records
      reverseRecord: true, // recommended
    }
  ]
});


      console.log("Sending registration transaction:", {
        contract: BASE_SEPOLIA_BASENAMES_CONTROLLER_CONTRACT,
        name: inputName, 
        owner: smartAccountAddress,
        duration: MIN_DURATION.toString(),
        fee: totalFee.toString(),
      });

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

  // Refetch name after successful transaction
  useEffect(() => {
    if (isSuccess && refetch) {
      setTimeout(() => {
        refetch();
      }, 3000);
    }
  }, [isSuccess, refetch]);

  // Don't show if user already has a basename or is still loading
  if (isLoadingName) {
    return null;
  }

  if (baseName) {
    return null; // User already has a basename
  }

  // Show success message
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
