import { randomUUID } from "node:crypto";
import {
  validateScreenshotContent,
  maxScreenshotBytes,
} from "@/features/creator-onboarding/evidence";
// Evidence handling. Uploads are OFF unless the owner enables them (a private bucket and the migration policies must exist). No malware scanner is
// configured, so every file starts as pending_scan and is not usable as evidence (by a reviewer or for a metric) until a scanner marks it clean.
export const evidenceBucket = "social-evidence";
export const evidenceUploadsEnabled = (
  env: Record<string, string | undefined> = process.env,
) => env.AURA_SOCIAL_EVIDENCE_UPLOADS === "enabled";
export const evidenceDisabledReason =
  "Evidence upload is not switched on yet. You can still verify with your profile code and send it for review.";
export interface ScannerAdapter {
  scan(path: string): Promise<"clean" | "quarantined">;
}
export const noScanner: ScannerAdapter | null = null; // dependency: malware scanning. Until one exists, nothing becomes clean.
export const extFor = (mime: string) =>
  ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[mime];
/** Safe, generated storage path: <workspace>/<claim>/<uuid>.<ext>. The original filename is never used. */
export function evidencePath(
  workspaceId: string,
  claimId: string,
  mime: string,
  id = randomUUID(),
) {
  const ext = extFor(mime);
  return ext ? `${workspaceId}/${claimId}/${id}.${ext}` : null;
}
export function checkEvidenceFile(
  file: { size: number; declaredMime: string; head: Uint8Array },
  enabled = evidenceUploadsEnabled(),
) {
  if (!enabled) return { ok: false as const, reason: evidenceDisabledReason };
  return validateScreenshotContent(file, "x", true);
}
export { maxScreenshotBytes as maxEvidenceBytes };
export const signedUrlSeconds = 120; // short-lived; never a permanent public URL
