import { useName } from "@coinbase/onchainkit/identity";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { baseSepolia } from "viem/chains";
import { useState, useEffect } from "react";
import BaseNameSetup from "./BaseNameSetup";
import SignedInScreen from "../SignedInScreen";
import Loading from "../common/Loading";

const BYPASS_KEY = "cdp-split-basename-bypass";

/**
 * Component that gates access to SignedInScreen until user has a basename
 * Shows BaseNameSetup if user doesn't have a basename, otherwise shows SignedInScreen
 */
function BasenameGate() {
  const { evmAddress: address } = useEvmAddress();
  const { data: baseName, isLoading: isLoadingName } = useName({
    address: address || undefined,
    chain: baseSepolia,
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

  useEffect(() => {
    // Initial check
    const initialBypass = checkBypassFromStorage();
    setIsBypassed(initialBypass);
    setIsCheckingBypass(false);

    // Listen for basename creation event
    const handleBasenameCreated = () => {
      console.log("BasenameGate: Received basename-created event");
      const bypassed = checkBypassFromStorage();
      console.log("BasenameGate: After event, bypassed =", bypassed);
      setIsBypassed(bypassed);
      // Force a re-render
      forceUpdate(prev => prev + 1);
    };

    window.addEventListener("basename-created", handleBasenameCreated);

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
      window.removeEventListener("basename-created", handleBasenameCreated);
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

  // Note: Polling removed - basename will be detected naturally when available

  if (isCheckingBypass) {
    return <Loading />;
  }

  // Show loading while checking for basename
  if (isLoadingName && !isBypassed && address) {
    return <Loading />;
  }

  // Check bypass directly from localStorage in render (most reliable)
  const bypassedFromStorage = checkBypassFromStorage();
  const shouldShowMainScreen = baseName || isBypassed || bypassedFromStorage;

  // If user has a basename or bypass is enabled, show the main screen
  if (shouldShowMainScreen) {
    console.log("BasenameGate: Rendering SignedInScreen because baseName =", baseName, "isBypassed =", isBypassed, "bypassedFromStorage =", bypassedFromStorage);
    return <SignedInScreen />;
  }

  // If user doesn't have a basename, show the setup screen
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

