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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100vw",
        zIndex: 50,
        background: "linear-gradient(180deg,#0f172a 0%,#0f172a 60%,#0f172aef 100%)",
        borderBottom: "1px solid #1e293b"
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
          <h1 className="site-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f1f5f9" }}>💸 Splits</h1>
          <span
            className="smart-badge"
            style={{
              marginLeft: "0.5rem",
              fontSize: "0.55rem",
              letterSpacing: "1px",
              fontWeight: 700,
              padding: "0.25rem 0.4rem",
              backgroundColor: "#14532d",
              color: "#f1f5f9",
              borderRadius: "0.35rem",
            }}
          >
            SMART
          </span>
        </div>
        <div className="user-info flex-row-container" style={{ gap: "1rem" }}>
          {evmAddress && (
            <button
              aria-label="copy wallet address"
              className="flex-row-container copy-address-button"
              onClick={copyAddress}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.6rem",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                transition: "all 0.2s ease",
                gap: "0.5rem",
                color: "#e2e8f0",
                fontSize: "0.75rem"
              }}
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
                className="wallet-address" 
                style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                <BaseNameResolver onResolved={(resolved) => {
                  console.log("Header: onResolved callback called with:", resolved);
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
