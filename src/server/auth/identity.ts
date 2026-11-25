import "server-only";
import { requestClient } from "@/server/database/client";
import { securityEvent } from "@/server/security/log";
export async function requireIdentity() {
  const client = await requestClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    securityEvent("identity_denied");
    throw new Error("Authentication required.");
  }
  return data.user.id;
}
