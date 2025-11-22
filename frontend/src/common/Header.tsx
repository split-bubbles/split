import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useState } from "react";

import { IconCheck, IconCopy, IconUser } from "./Icons";
import BaseNameResolver from "../basename/BaseNameResolver";

/**
 * Header component
 * Using CDP's useEvmAddress hook
 */
function Header() {
  const { evmAddress } = useEvmAddress();
  const [isCopied, setIsCopied] = useState(false);

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

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <header>
      <div className="header-inner">
        <div className="title-container">
          <h1 className="site-title">💸 Splits</h1>
          <span className="smart-badge">SMART</span>
        </div>
        <div className="user-info flex-row-container" style={{ gap: "1rem" }}>
          {evmAddress && (
            <button
              aria-label="copy wallet address"
              className="flex-row-container copy-address-button"
              onClick={copyAddress}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--cdp-example-bg-low-contrast-color)",
                border: "1px solid var(--cdp-example-card-border-color)",
                transition: "all 0.2s ease",
                gap: "0.5rem",
              }}
            >
              {!isCopied && (
                <>
                  <IconUser className="user-icon user-icon--user" />
                  <IconCopy className="user-icon user-icon--copy" />
                </>
              )}
              {isCopied && <IconCheck className="user-icon user-icon--check" />}
              <span className="wallet-address" style={{ fontSize: "0.875rem" }}>
                <BaseNameResolver />
                {evmAddress && <span>{formatAddress(evmAddress)}</span>}
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
