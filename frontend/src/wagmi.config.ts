import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';

// Create CDP embedded wallet connector
const cdpConnector = createCDPEmbeddedWalletConnector({
  cdpConfig: {
    projectId: import.meta.env.VITE_CDP_PROJECT_ID || '',
  },
  providerConfig: {
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
  },
});

export const wagmiConfig = createConfig({
  connectors: [cdpConnector],
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});

