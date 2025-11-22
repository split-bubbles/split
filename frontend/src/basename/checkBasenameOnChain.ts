import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";

// Base Sepolia Resolver Contract Address
const BASE_SEPOLIA_RESOLVER = "0x85C87e548091f204C2d0350b39ce1874f02197c6" as const;

// Resolver ABI for checking reverse records
const resolverABI = [
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Check on-chain if an address has an ENS name registered
 * @param address The address to check
 * @returns The ENS name if found, null otherwise
 */
export async function checkBasenameOnChain(address: Address | undefined): Promise<string | null> {
  if (!address) {
    return null;
  }

  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Query the resolver for the reverse record (address -> name)
    const name = await publicClient.readContract({
      address: BASE_SEPOLIA_RESOLVER,
      abi: resolverABI,
      functionName: "name",
      args: [address],
    });

    // If name is empty or just whitespace, return null
    if (!name || name.trim() === "") {
      return null;
    }

    return name;
  } catch (error: any) {
    // If the contract call fails or reverts (e.g., no reverse record set), return null
    // This is expected behavior when no basename exists - don't log as error
    const isRevert = error?.name === "ContractFunctionExecutionError" || 
                     error?.message?.includes("reverted") ||
                     error?.shortMessage?.includes("reverted");
    
    if (!isRevert) {
      // Only log non-revert errors (actual problems)
      console.error("Error checking on-chain ENS name:", error);
    }
    
    return null;
  }
}

