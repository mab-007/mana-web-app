// Authorization header for API calls — web is real-Privy-only (no fake-auth dev
// bypass; that lane is mobile-dev only). The in-memory Privy access token is the
// session (web decision: bearer-in-memory, identical to the mobile + BE path).
import { getPrivyAccessToken } from "./privy";

export async function authHeader(): Promise<string> {
  return `Bearer ${await getPrivyAccessToken()}`;
}
