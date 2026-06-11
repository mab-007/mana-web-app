import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/app/App";
import { registerTokenGetter } from "@/lib/privy";
import "@/index.css";

// Registers Privy's access-token getter with the plain API client once Privy is
// mounted. Web session = in-memory Privy bearer (web decision), so every API call
// reads a fresh token through this bridge.
function TokenBridge() {
  const { getAccessToken } = usePrivy();
  useEffect(() => {
    registerTokenGetter(getAccessToken);
  }, [getAccessToken]);
  return null;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "light", accentColor: "#1C7C54" },
        // The BE owns the server-side non-custodial wallet (D21); the browser must
        // not spin up its own embedded wallet on login.
        embeddedWallets: { createOnLogin: "off" },
      }}
    >
      <TokenBridge />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </StrictMode>,
);
