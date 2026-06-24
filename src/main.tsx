import { Buffer } from "buffer";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

// Polyfill Node's Buffer global for the browser. Privy's session-signer crypto
// path (addSessionSigners / secp256k1) references Buffer, which the login flow
// never hit — so it only surfaces during the delegation grant. SPIKE.
if (!(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
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
        // SPIKE (web-delegation-consent, throwaway): D21 normally keeps this "off"
        // (BE owns the server-side non-custodial wallet; browser must not spin up
        // its own). For the delegation test the client must CONNECT the existing
        // server-created wallet so useWallets() surfaces it for addSessionSigners.
        // "users-without-wallets" should connect the existing owner.user_id wallet,
        // NOT mint a second — verified by address-match against user_wallets.
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      <TokenBridge />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </StrictMode>,
);
