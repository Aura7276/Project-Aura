import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { social } from "@/server/social/service";
import { decideClaim } from "@/features/creator-social/review-actions";
import { platformLabel } from "@/features/creator-social/catalogue";
export const metadata = {
  title: "Social ownership review",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await eligible();
  const admin = await client.rpc("aura_is_admin");
  if (admin.error || admin.data !== true) notFound();
  const q = await social.reviewQueue(client);
  if (!q.ok) notFound(); // not a granted reviewer, or no MFA session: nothing is revealed
  const sp = await searchParams;
  return (
    <>
      <h1>Social ownership review</h1>
      <p>
        Restricted to granted reviewers with a verified authenticator. You
        cannot decide a claim for an account you own or administer.
      </p>
      {typeof sp.notice === "string" && (
        <p role="status" className="st-error">
          That decision could not be saved.
        </p>
      )}
      {sp.decided && (
        <p role="status" className="st-ok">
          Decision recorded.
        </p>
      )}
      {q.value.length === 0 ? (
        <p>No claims are waiting.</p>
      ) : (
        <ul>
          {q.value.map((c) => (
            <li key={c.claim_id}>
              <p>
                <strong>
                  {platformLabel(c.platform)} · @{c.handle}
                </strong>{" "}
                · {c.state}
                {c.dispute ? " · disputed" : ""} · {c.evidence_clean} scanned
                evidence file(s), {c.evidence_pending} awaiting scan
              </p>
              <form action={decideClaim} aria-label={`Decide ${c.handle}`}>
                <input type="hidden" name="claim" value={c.claim_id} />
                <label htmlFor={`d-${c.claim_id}`}>Decision</label>
                <select
                  id={`d-${c.claim_id}`}
                  name="decision"
                  defaultValue="approved"
                >
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="needs_evidence">Ask for more evidence</option>
                </select>
                <label htmlFor={`r-${c.claim_id}`}>Reason (required)</label>
                <input
                  id={`r-${c.claim_id}`}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />
                <label>
                  <input type="checkbox" name="replace_existing" /> Replace an
                  existing verified owner
                </label>
                <button>Record decision</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
