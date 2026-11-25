// Screenshot evidence validation. Uploads stay DISABLED until private storage with owner-scoped policies
// and malware scanning exist (dependency: Supabase Storage bucket + scanning service, tracked in DEPENDENCY_REGISTER).
export const screenshotUploadsEnabled = false as boolean;
export const uploadDisabledReason =
  "Screenshot upload is unavailable until private storage and file scanning are set up. You can continue without it.";
export const maxScreenshotBytes = 5 * 1024 * 1024;
const signatures: {
  mime: string;
  ext: string;
  test: (b: Uint8Array) => boolean;
}[] = [
  {
    mime: "image/png",
    ext: "png",
    test: (b) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (v, i) => b[i] === v,
      ),
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) =>
      [0x52, 0x49, 0x46, 0x46].every((v, i) => b[i] === v) &&
      [0x57, 0x45, 0x42, 0x50].every((v, i) => b[8 + i] === v),
  },
];
export type EvidenceResult =
  | { ok: true; mime: string; storedName: string }
  | { ok: false; reason: string };
export function safeStoredName(ext: string, id: string) {
  return `${id}.${ext}`; // original filenames are never used in storage paths
}
export function validateScreenshot(
  file: { size: number; declaredMime: string; head: Uint8Array },
  id: string,
): EvidenceResult {
  if (!screenshotUploadsEnabled)
    return { ok: false, reason: uploadDisabledReason };
  if (file.size <= 0) return { ok: false, reason: "The file is empty." };
  if (file.size > maxScreenshotBytes)
    return { ok: false, reason: "The file is larger than 5 MB." };
  const match = signatures.find((s) => s.test(file.head));
  if (!match)
    return {
      ok: false,
      reason: "Only PNG, JPEG and WebP images are accepted.",
    };
  if (file.declaredMime !== match.mime)
    return { ok: false, reason: "The file type does not match its content." };
  return {
    ok: true,
    mime: match.mime,
    storedName: safeStoredName(match.ext, id),
  };
}
// Same checks with the feature flag bypassed, for unit-testing the validator itself.
export function validateScreenshotContent(
  file: { size: number; declaredMime: string; head: Uint8Array },
  id: string,
  enabled = true,
): EvidenceResult {
  if (!enabled) return { ok: false, reason: uploadDisabledReason };
  const match = signatures.find((s) => s.test(file.head));
  if (file.size <= 0) return { ok: false, reason: "The file is empty." };
  if (file.size > maxScreenshotBytes)
    return { ok: false, reason: "The file is larger than 5 MB." };
  if (!match)
    return {
      ok: false,
      reason: "Only PNG, JPEG and WebP images are accepted.",
    };
  if (file.declaredMime !== match.mime)
    return { ok: false, reason: "The file type does not match its content." };
  return {
    ok: true,
    mime: match.mime,
    storedName: safeStoredName(match.ext, id),
  };
}
