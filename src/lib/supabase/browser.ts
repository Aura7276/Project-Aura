"use client";
import { createBrowserClient } from "@supabase/ssr";
import { providerConfig } from "@/config/environment";
export function browserClient() {
  const { url, key } = providerConfig();
  return createBrowserClient(url, key, {
    cookieOptions: {
      sameSite: "lax",
      secure:
        new URL(url).protocol === "https:" && location.protocol === "https:",
    },
  });
}
