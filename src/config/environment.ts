import { z } from "zod";
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const endpoint = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === "/" &&
    (url.protocol === "https:" ||
      (localHosts.includes(url.hostname) && url.protocol === "http:"))
  );
});
export const providerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: endpoint,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});
export function providerConfig() {
  const result = providerSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success)
    throw new Error(
      "Missing or invalid provider configuration: " +
        result.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    key: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
