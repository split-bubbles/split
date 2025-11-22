import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useAccount, useConnect } from "wagmi";
import { useEffect } from "react";

/**
 * Component that automatically connects the CDP embedded wallet to Wagmi when user is signed in
 */
function WalletConnector() {
  const { evmAddress } = useEvmAddress();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    // If user has CDP address but Wagmi is not connected, connect it
    if (evmAddress && !isConnected && connectors.length > 0) {
      const cdpConnector = connectors.find((connector) => connector.id === "cdpEmbeddedWallet");
      if (cdpConnector) {
        connect({ connector: cdpConnector });
      }
    }
  }, [evmAddress, isConnected, connect, connectors]);

  return null; // This component doesn't render anything
}

export default WalletConnector;

