"use client";
import { useSearchParams, usePathname } from "next/navigation";
const notices: Record<string, string> = {
  reauth: "Sign in again before changing your phone number.",
  input: "Check the fields and try again.",
  recent: "Verify a fresh authenticator code before making this change.",
  required: "This account must keep a verified authenticator.",
  restricted: "You do not have access to that workspace.",
  invite: "This invitation or referral is unavailable.",
  challenge:
    "The code could not be verified. Try the latest code from your authenticator.",
  requested: "If eligible, check your phone for the confirmation code.",
  updated: "Your phone number was verified.",
  revoke: "Session revocation could not be confirmed. Try again.",
  failed: "The request could not be completed.",
};
export function PrivateNotice() {
  const path = usePathname();
  const notice = useSearchParams().get("notice");
  if (!/^\/(workspaces|security|identity|mfa)(\/|$)/.test(path) || !notice)
    return null;
  return (
    <p role="status">
      {notices[notice] ?? "Check your account details and try again."}
    </p>
  );
}
