import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useAccount } from "wagmi";
import { useCallback, useEffect, useState } from "react";

import { IconCheck, IconCopy, IconUser } from "./Icons";
import BaseNameResolver from "./BaseNameResolver";

/**
 * Header component
 * Now using Wagmi's useAccount hook
 */
function Header() {
  const { address: evmAddress } = useAccount();
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
          <h1 className="site-title">Split Demo</h1>
          <span className="smart-badge">SMART</span>
        </div>
        <div className="user-info flex-row-container">
          {evmAddress && (
            <button
              aria-label="copy wallet address"
              className="flex-row-container copy-address-button"
              onClick={copyAddress}
            >
              {!isCopied && (
                <>
                  <IconUser className="user-icon user-icon--user" />
                  <IconCopy className="user-icon user-icon--copy" />
                </>
              )}
              {isCopied && <IconCheck className="user-icon user-icon--check" />}
              <span className="wallet-address">
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
