import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SPA on the shared EC2 backend. Dev server fixed to 5173 so the BE CORS
// allowlist (WEB_ORIGINS=http://localhost:5173) and Privy allowed-origins match.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // host:true binds 0.0.0.0 (LAN + ngrok reachable); allowedHosts lets the ngrok
  // tunnel's Host header through (Vite blocks unknown hosts by default). Dev-only.
  server: { port: 5173, strictPort: true, host: true, allowedHosts: true },
});
