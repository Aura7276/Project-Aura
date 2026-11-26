import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KitDocument } from "@/features/creator-profile/site";
import { kitTokenPattern } from "@/features/creator-profile/rules";
import { shareVisit } from "@/features/creator-profile/site-actions";
import { profileApi, publicClient } from "@/server/profile/service";
import "@/features/creator-profile/profile.css";

export const metadata: Metadata = {
  title: "Media kit",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
const messages: Record<string, { title: string; body: string }> = {
  revoked: {
    title: "This link has been turned off",
    body: "The creator revoked this link. Ask them for a new one if you still need it.",
  },
  expired: {
    title: "This link has expired",
    body: "Media-kit links can expire. Ask the creator for a fresh link.",
  },
  not_permitted: {
    title: "This link was shared with another workspace",
    body: "It is restricted to a specific Brand or Agency. Sign in with an account in that workspace.",
  },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!kitTokenPattern.test(token)) notFound();
  const r = await profileApi.publicKit(await publicClient(), token);
  if (!r.ok || r.value.status === "not_found") notFound();
  const v = r.value;
  if (v.status === "sign_in_required")
    return (
      <div className="pf">
        <div className="pf-notice" id="profile">
          <h1 style={{ fontSize: "1.6rem" }}>Sign in to view this media kit</h1>
          <p>This kit was shared privately with a specific workspace.</p>
          <Link
            className="pf-btn"
            href={`/login?next=${encodeURIComponent(`/kit/${token}`)}`}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  if (v.status !== "ok" || !v.content) {
    const m = messages[v.status] ?? messages.revoked;
    return (
      <div className="pf">
        <div className="pf-notice" id="profile">
          <h1 style={{ fontSize: "1.6rem" }}>{m.title}</h1>
          <p>{m.body}</p>
        </div>
      </div>
    );
  }
  const banner = (
    <div className="pf-banner no-print" role="note">
      {v.kind === "restricted"
        ? "Shared privately with your workspace"
        : "Shared by link"}
      {v.snapshot ? " · fixed snapshot" : " · live"}
      {v.expires_at
        ? ` · link expires ${v.expires_at.slice(0, 10)}`
        : ""} · <a href={`/kit/${token}/pdf`}>Download PDF</a>
      {(v.viewer_brands?.length ?? 0) > 0 && !sp.shared && (
        <form
          action={shareVisit}
          style={{
            display: "inline-flex",
            gap: "0.4rem",
            marginLeft: "0.6rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input type="hidden" name="token" value={token} />
          <label htmlFor="sv">Let the creator know</label>
          <select id="sv" name="workspace">
            {v.viewer_brands!.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span>viewed this (optional)</span>
          <button className="pf-btn" style={{ padding: "0.3rem 0.8rem" }}>
            Share
          </button>
        </form>
      )}
      {sp.shared &&
        " · Thank you, the creator can see that your workspace viewed this."}
    </div>
  );
  return (
    <div id="profile">
      <KitDocument c={v.content} banner={banner} />
    </div>
  );
}
