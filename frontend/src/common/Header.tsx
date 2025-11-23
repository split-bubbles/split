import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useState, useRef } from "react";

import { IconCheck, IconCopy, IconUser } from "./Icons";
import BaseNameResolver from "../basename/BaseNameResolver";

/**
 * Header component
 * Using CDP's useEvmAddress hook
 */
function Header() {
  const { evmAddress } = useEvmAddress();
  const [isCopied, setIsCopied] = useState(false);
  const [hasBasename, setHasBasename] = useState(false);
  const nameContainerRef = useRef<HTMLSpanElement>(null);

  const formatAddress = useCallback((address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const copyAddress = async () => {
    if (!evmAddress) return;
    try {
      await navigator.clipboard.writeText(evmAddress);
      setIsCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  // Reset hasBasename when address changes
  useEffect(() => {
    console.log("Header: Address changed, resetting hasBasename");
    setHasBasename(false);
  }, [evmAddress]);

  // Debug logging for hasBasename
  useEffect(() => {
    console.log("Header: hasBasename state:", hasBasename);
  }, [hasBasename]);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <header
      className="main-header"
      style={{
        position: "static",
        width: "100%",
      }}
    >
      <div
        className="header-inner"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.6rem 1.5rem",
          maxWidth: "1400px",
          margin: "0 auto"
        }}
      >
        <div className="title-container">
          <h1 className="site-title header-title">
            <span className="money-icon">💸</span> Splits
          </h1>
        </div>
        <div className="user-info flex-row-container" style={{ gap: "1rem" }}>
          {evmAddress && (
            <button
              aria-label="copy wallet address"
              className="flex-row-container copy-address-button header-address-button"
              onClick={copyAddress}
            >
              {!isCopied && (
                <>
                  <IconUser className="user-icon user-icon--user" />
                  <IconCopy className="user-icon user-icon--copy" />
                </>
              )}
              {isCopied && <IconCheck className="user-icon user-icon--check" />}
              <span 
                ref={nameContainerRef}
                className="wallet-address header-address-text" 
                style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                <BaseNameResolver onResolved={(resolved) => {
                  setHasBasename(resolved);
                }} />
                {!hasBasename && evmAddress && (
                  <span style={{ display: "inline-block" }}>{formatAddress(evmAddress)}</span>
                )}
              </span>
            </button>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

export default Header;
