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
  const { data: baseName, isLoading: isLoadingName } = useEnsNameOptimistic({
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

    // Listen for ENS name creation event
    const handleEnsNameCreated = () => {
      console.log("BasenameGate: Received ens-name-created event");
      const bypassed = checkBypassFromStorage();
      console.log("BasenameGate: After event, bypassed =", bypassed);
      setIsBypassed(bypassed);
      // Force a re-render
      forceUpdate(prev => prev + 1);
    };

    window.addEventListener("ens-name-created", handleEnsNameCreated);

    // Poll for bypass changes as a fallback (always update to trigger re-render)
    const interval = setInterval(() => {
      const bypassed = checkBypassFromStorage();
      // Always update state and force re-render to ensure component re-renders
      if (bypassed !== isBypassed) {
        console.log("BasenameGate: Polling detected bypass change:", bypassed);
        setIsBypassed(bypassed);
      }
      // Force re-render every poll to catch localStorage changes immediately
      forceUpdate(prev => prev + 1);
    }, 100); // Check every 100ms for very fast response

    return () => {
      window.removeEventListener("ens-name-created", handleEnsNameCreated);
      clearInterval(interval);
    };
  }, [isBypassed]);

  // Debug logging
  useEffect(() => {
    console.log("BasenameGate state:", {
      address,
      baseName,
      isLoadingName,
      isBypassed,
      isCheckingBypass,
    });
  }, [address, baseName, isLoadingName, isBypassed, isCheckingBypass]);

  if (isCheckingBypass || isLoadingName) {
    return <Loading />;
  }

  // Only show main screen if there's an actual ENS name found
  if (baseName) {
    console.log("BasenameGate: Rendering SignedInScreen because baseName =", baseName);
    return <SignedInScreen />;
  }
  
  // Clear bypass if it's set but no ENS name found
  const bypassedFromStorage = checkBypassFromStorage();
  if (bypassedFromStorage) {
    console.log("BasenameGate: Bypass is set but no ENS name found, clearing bypass");
    try {
      localStorage.removeItem(BYPASS_KEY);
      setIsBypassed(false);
    } catch (e) {
      console.error("Failed to clear bypass:", e);
    }
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

