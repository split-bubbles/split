import { useName } from "@coinbase/onchainkit/identity";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "viem/chains";
import { useEffect, useState, useCallback } from "react";

// Base Sepolia Reverse Registrar contract address
// This contract allows setting reverse records (address -> name)
// Verify this address on Base Sepolia documentation
const REVERSE_REGISTRAR_ADDRESS = "0x4f7A67464B5976d7547b860ecE0e3D5d8f8f9bC1" as const;

// Reverse Registrar ABI - setName function
const REVERSE_REGISTRAR_ABI = [
  {
    inputs: [
      { name: "name", type: "string" },
    ],
    name: "setName",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Component that automatically creates a basename for the user if they don't have one
 * 
 * Note: Basename registration requires:
 * 1. The name to be registered first through basenames.app or Base's naming contracts
 * 2. Then setting the reverse record to link the address to the name
 * 
 * This component attempts to set the reverse record. If the name isn't registered yet,
 * you may need to register it first through basenames.app
 */
function BaseNameCreator() {
  const { address } = useAccount();
  const { data: baseName, isLoading: isLoadingName, refetch } = useName({
    address: address || undefined,
    chain: baseSepolia,
  });
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const [hasAttempted, setHasAttempted] = useState(false);

  // Generate a unique name based on address
  const generateName = useCallback((addr: string): string => {
    // Take first 8 chars of address (without 0x) and create a name
    // Base Sepolia uses .basetest.eth suffix
    const shortAddr = addr.slice(2, 10).toLowerCase();
    return `user-${shortAddr}.basetest.eth`;
  }, []);

  // Function to create basename by setting reverse record
  const createBasename = useCallback(async () => {
    if (!address) return;
    
    const name = generateName(address);
    
    try {
      // Set the reverse record (this links the address to the name)
      // Note: The name must already be registered/owned by the address
      // If this fails, the name needs to be registered first at basenames.app
      await writeContract({
        address: REVERSE_REGISTRAR_ADDRESS,
        abi: REVERSE_REGISTRAR_ABI,
        functionName: "setName",
        args: [name],
      });
    } catch (err) {
      console.error("Error creating basename:", err);
      // If this fails, the name might need to be registered first
      // The user can register it manually at https://basenames.app
    }
  }, [address, generateName, writeContract]);

  useEffect(() => {
    // Auto-create basename if user doesn't have one and is connected
    if (
      address && 
      !isLoadingName && 
      !baseName && 
      !hasAttempted && 
      !isPending && 
      !isConfirming &&
      !isSuccess
    ) {
      setHasAttempted(true);
      // Attempt to create basename automatically
      // This will try to set the reverse record
      createBasename();
    }
  }, [address, baseName, isLoadingName, hasAttempted, isPending, isConfirming, isSuccess, createBasename]);

  // Refetch name after successful transaction
  useEffect(() => {
    if (isSuccess && refetch) {
      // Wait a bit for the transaction to be indexed
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  }, [isSuccess, refetch]);

  // Don't render anything - this is a background component
  return null;
}

export default BaseNameCreator;

