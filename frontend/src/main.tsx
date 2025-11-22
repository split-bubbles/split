import { CDPReactProvider } from "@coinbase/cdp-react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { baseSepolia } from "viem/chains";

import App from "./App.tsx";
import { CDP_CONFIG } from "./config.ts";
import { theme } from "./theme.ts";
import { wagmiConfig } from "./wagmi.config.ts";
import "@coinbase/onchainkit/styles.css";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CDPReactProvider config={CDP_CONFIG} theme={theme}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <OnchainKitProvider
            apiKey={import.meta.env.VITE_ONCHAINKIT_API_KEY || ""}
            chain={baseSepolia}
            config={{
              appearance: {
                mode: "auto",
              },
            }}
          >
            <App />
          </OnchainKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </CDPReactProvider>
  </StrictMode>,
);
