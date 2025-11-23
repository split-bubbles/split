import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useState, useEffect } from "react";
import { baseSepolia, sepolia } from "viem/chains";
import BaseNameSetup from "./BaseNameSetup";
import SignedInScreen from "../SignedInScreen";
import Loading from "../common/Loading";
import { useEnsNameOptimistic } from "../hooks/useEnsNameOptimistic";

const BYPASS_KEY = "cdp-split-ens-name-bypass";

/**
 * Component that gates access to SignedInScreen until user has an ENS .split.eth name
 * Shows BaseNameSetup if user doesn't have an ENS name, otherwise shows SignedInScreen
 */
function BasenameGate() {
  const { evmAddress: address } = useEvmAddress();
  const { data: baseName, isLoading: isLoadingName, refetch: refetchEnsName } = useEnsNameOptimistic({
    address: address as `0x${string}` | undefined,
    l1ChainId: sepolia.id,
    l2ChainId: baseSepolia.id,
  });
  const [isBypassed, setIsBypassed] = useState(false);
  const [isCheckingBypass, setIsCheckingBypass] = useState(true);
  const [, forceUpdate] = useState(0);

  // Helper to check bypass from localStorage directly
  const checkBypassFromStorage = () => {
    try {
      return localStorage.getItem(BYPASS_KEY) === "true";
    } catch (e) {
      console.error("Failed to check bypass status:", e);
      return false;
    }
  };

  // Clear bypass if no ENS name found (after loading completes)
  useEffect(() => {
    if (!isLoadingName && !baseName && address) {
      try {
        localStorage.removeItem(BYPASS_KEY);
        setIsBypassed(false);
      } catch (e) {
        console.error("Failed to clear bypass:", e);
      }
    }
  }, [isLoadingName, baseName, address]);

  useEffect(() => {
    // Initial check
    const initialBypass = checkBypassFromStorage();
    setIsBypassed(initialBypass);
    setIsCheckingBypass(false);

    let refetchIntervalId: NodeJS.Timeout | null = null;

    // Listen for ENS name creation event
    const handleEnsNameCreated = async () => {
      const bypassed = checkBypassFromStorage();
      setIsBypassed(bypassed);
      
      // Immediately refetch ENS name
      if (refetchEnsName) {
        refetchEnsName();
      }
      
      // Clear any existing refetch interval
      if (refetchIntervalId) {
        clearInterval(refetchIntervalId);
      }
      
      // Continue refetching periodically for a bit to catch propagation delay
      refetchIntervalId = setInterval(() => {
        if (refetchEnsName) {
          refetchEnsName();
        }
      }, 2000); // Refetch every 2 seconds
      
      // Stop refetching after 30 seconds
      setTimeout(() => {
        if (refetchIntervalId) {
          clearInterval(refetchIntervalId);
          refetchIntervalId = null;
        }
      }, 30000);
      
      // Force a re-render
      forceUpdate(prev => prev + 1);
    };

    window.addEventListener("ens-name-created", handleEnsNameCreated);

    // Poll for bypass changes as a fallback (always update to trigger re-render)
    const interval = setInterval(() => {
      const bypassed = checkBypassFromStorage();
      // Always update state and force re-render to ensure component re-renders
      if (bypassed !== isBypassed) {
        setIsBypassed(bypassed);
      }
      // Force re-render every poll to catch localStorage changes immediately
      forceUpdate(prev => prev + 1);
    }, 100); // Check every 100ms for very fast response

    return () => {
      window.removeEventListener("ens-name-created", handleEnsNameCreated);
      clearInterval(interval);
      if (refetchIntervalId) {
        clearInterval(refetchIntervalId);
      }
    };
  }, [isBypassed, refetchEnsName]);


  if (isCheckingBypass || isLoadingName) {
    return <Loading />;
  }

  // Show main screen if there's an actual ENS name found OR if bypass is set (temporary after creation)
  if (baseName || isBypassed) {
    return <SignedInScreen />;
  }
  
  // Clear bypass if it's set but no ENS name found (after a delay to allow for propagation)
  const bypassedFromStorage = checkBypassFromStorage();
  if (bypassedFromStorage && !isBypassed) {
    // Don't clear immediately - give it time for the name to propagate
    // The bypass will be cleared when the name is actually found or on sign out
  }

  // If user doesn't have an ENS name, show the setup screen
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: "600px",
        width: "90%",
        maxHeight: "90vh",
        overflow: "auto",
      }}>
        <BaseNameSetup />
      </div>
    </div>
  );
}

export default BasenameGate;

