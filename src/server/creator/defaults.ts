import "server-only";
import { z } from "zod";
// Reuses M02 identity data (provider user metadata) as non-authoritative form defaults. Never written back.
const meta = z.object({
  name: z.string().trim().min(1).max(80).catch(""),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .catch(""),
});
export function identityDefaults(user: { user_metadata?: unknown }) {
  const r = meta.safeParse(user.user_metadata ?? {});
  return r.success
    ? { name: r.data.name || undefined, country: r.data.country || undefined }
    : {};
}
