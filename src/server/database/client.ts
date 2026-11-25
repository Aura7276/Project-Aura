import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { providerConfig } from "@/config/environment";
// Use in a Route Handler or Server Action where refreshed cookies can be written.
export async function requestClient() {
  const { url, key } = providerConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (updates) => {
        for (const { name, value, options } of updates)
          jar.set(name, value, options);
      },
    },
  });
}
