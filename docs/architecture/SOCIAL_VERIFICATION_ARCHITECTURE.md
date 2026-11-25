# Social ownership verification (M05)

1. Creator starts verification: a profile code is generated (default TTL 72 hours, 5 attempts; proposed defaults).
2. Creator places the code in their profile bio or a post, optionally uploads a screenshot, then sends the claim for review.
3. A **reviewer** (Platform Admin + explicit reviewer grant + MFA session `aal2`) approves, rejects, asks for evidence or revokes. A reviewer cannot decide on an account they own or administer. A reason is required and audited.
4. One verified owner per platform identity (unique partial index). A second claim becomes a dispute reviewed with both sides. Revocation is audited and returns the account to unverified.

Nothing verifies automatically. Self-reported and verified are always distinct. No social passwords, cookies or tokens are ever requested.

**Evidence storage**: private bucket `social-evidence`, generated paths, MIME and size and magic-byte checks, storage policies, short-lived signed URLs. Upload is **disabled** unless `AURA_SOCIAL_EVIDENCE_UPLOADS=enabled`. No malware scanner exists, so every file stays `pending_scan`; nothing becomes clean. Evidence is never sent to a third-party provider.
