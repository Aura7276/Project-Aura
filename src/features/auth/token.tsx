"use client";
import { useEffect, useState } from "react";
import { verifyEmail, resetPassword } from "./actions";
import { PasswordFields } from "./fields";
export function TokenForm({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState("");
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1)).get("token_hash");
    if (hash) {
      queueMicrotask(() => setToken(hash));
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  if (!token) return <p>Open the link in your email to continue.</p>;
  return (
    <form action={reset ? resetPassword : verifyEmail}>
      <input type="hidden" name="token" value={token} />
      {reset && <PasswordFields />}
      <button>{reset ? "Save new password" : "Confirm email address"}</button>
    </form>
  );
}
