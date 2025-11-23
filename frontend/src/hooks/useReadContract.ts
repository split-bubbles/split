import { useState, useEffect } from "react";
import { createPublicClient, http, type Address, type Abi } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

interface UseReadContractOptions<TAbi extends Abi, TFunctionName extends string> {
  address?: Address;
  abi: TAbi;
  functionName: TFunctionName;
  args?: readonly unknown[];
  enabled?: boolean;
  refetchInterval?: number;
  query?: {
    enabled?: boolean;
    refetchInterval?: number;
  };
}

export function useReadContract<TAbi extends Abi, TFunctionName extends string>({
  address,
  abi,
  functionName,
  args,
  enabled = true,
  refetchInterval,
  query,
}: UseReadContractOptions<TAbi, TFunctionName>) {
  // Support both direct props and query object (for Wagmi compatibility)
  const finalEnabled = query?.enabled !== undefined ? query.enabled : enabled;
  const finalRefetchInterval = query?.refetchInterval !== undefined ? query.refetchInterval : refetchInterval;
  const [data, setData] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const readContract = async () => {
    if (!finalEnabled || !address) {
      setData(undefined);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address,
        abi,
        functionName: functionName as any,
        args: args as any,
      } as any);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    readContract();

    if (finalRefetchInterval) {
      const interval = setInterval(readContract, finalRefetchInterval);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, functionName, JSON.stringify(args), finalEnabled, finalRefetchInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: readContract,
  };
}

