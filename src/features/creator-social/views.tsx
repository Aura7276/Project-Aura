import Link from "next/link";
import { notFound } from "next/navigation";
import { studioContext } from "@/server/studio/service";
import {
  reasonText,
  social,
  type SocialAccountRow,
  type SocialReason,
  type SocialResult,
} from "@/server/social/service";
import * as act from "./actions";
import {
  AddAccountForm,
  ContentForm,
  EvidenceForm,
  GrantForm,
  ObservationForm,
  UpdateAccountForm,
} from "./forms";
import { platformLabel } from "./catalogue";
import { freshness } from "./freshness";
import { metricLabel, metrics, sourceLabels, type Source } from "./metrics";
import {
  lifecycleLabels,
  ownershipLabels,
  type Lifecycle,
  type Ownership,
} from "./status";
import { evidenceDisabledReason, evidenceUploadsEnabled } from "./evidence";
import { accountEligibility } from "./eligibility";

type Ctx = Awaited<ReturnType<typeof studioContext>>;
const val = <T,>(r: SocialResult<T>): T => {
  if (!r.ok) throw new Error("social:" + r.error);
  return r.value;
};
const noticeOf = (sp: Record<string, string | string[] | undefined>) => {
  const n = typeof sp.notice === "string" ? (sp.notice as SocialReason) : null;
  if (n && n in reasonText) return { text: reasonText[n], bad: true };
  if (
    sp.updated ||
    sp.saved ||
    sp.started ||
    sp.review ||
    sp.refresh ||
    sp.removed ||
    sp.corrected ||
    sp.cancelled
  )
    return { text: "Done.", bad: false };
  return null;
};
export const Notice = ({
  sp,
}: {
  sp: Record<string, string | string[] | undefined>;
}) => {
  const n = noticeOf(sp);
  return (
    <p
      role="status"
      aria-live="polite"
      className={n?.bad ? "st-error" : "st-ok"}
    >
      {n?.text}
    </p>
  );
};
export function Badges({ a }: { a: SocialAccountRow }) {
  const o =
    ownershipLabels[a.verification as Ownership] ?? ownershipLabels.unverified;
  return (
    <p>
      <span className="st-badge">{o.label}</span>{" "}
      <span className="st-badge">
        {lifecycleLabels[a.lifecycle as Lifecycle] ?? a.lifecycle}
      </span>{" "}
      <span className="st-badge">
        {a.connection === "connected"
          ? "Connected"
          : a.connection === "disconnected"
            ? "Disconnected"
            : "Manual tracking"}
      </span>
      {a.is_primary && (
        <>
          {" "}
          <span className="st-badge">Primary</span>
        </>
      )}
      {a.preferred_for_platform && (
        <>
          {" "}
          <span className="st-badge">Preferred</span>
        </>
      )}
      {a.sharing_visibility === "published" && (
        <>
          {" "}
          <span className="st-badge">Shown on profile</span>
        </>
      )}
    </p>
  );
}
const tabs = (id: string) =>
  [
    ["", "Overview"],
    ["/verify", "Verification"],
    ["/metrics", "Metrics"],
    ["/history", "History"],
  ].map(([p, l]) => ({ href: `/creator/socials/${id}${p}`, l }));
function Tabs({ a, current }: { a: SocialAccountRow; current: string }) {
  return (
    <nav aria-label="Account sections">
      <p>
        {tabs(a.id).map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === current ? "page" : undefined}
            style={{ marginRight: 12, textDecoration: "underline" }}
          >
            {t.l}
          </Link>
        ))}
      </p>
    </nav>
  );
}
function Header({ a }: { a: SocialAccountRow }) {
  return (
    <header>
      <p>
        <Link href="/creator/socials">All social accounts</Link>
      </p>
      <h1>{a.display_name || `@${a.handle}`}</h1>
      <p>
        {platformLabel(a.platform)} · @{a.handle}
      </p>
      <Badges a={a} />
    </header>
  );
}
async function loadAccount(ctx: Ctx, id: string) {
  const r = await social.account(ctx.client, ctx.workspaceId, id);
  if (!r.ok) notFound();
  return r.value;
}
export async function ListView({
  sp,
}: {
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const [accR, remR] = await Promise.all([
    social.accounts(ctx.client, ctx.workspaceId),
    social.reminders(ctx.client, ctx.workspaceId),
  ]);
  const data = val(accR),
    rem = remR.ok ? remR.value : null;
  const elig = accountEligibility(ctx.state);
  return (
    <main>
      <h1>Social accounts</h1>
      <p>
        {data.used} of {data.limit} accounts used. Numbers here are
        self-reported unless an account says otherwise. Nothing is synchronized
        from a platform.
      </p>
      <Notice sp={sp} />
      <p>
        <Link className="st-btn primary" href="/creator/socials/new">
          Add an account
        </Link>{" "}
        <Link href="/creator/socials/settings">Reminder settings</Link>
      </p>
      {rem && rem.due.length > 0 && (
        <section className="st-card" aria-labelledby="due-h">
          <h2 id="due-h">Worth updating</h2>
          <ul className="st-list">
            {rem.due.map((d) => (
              <li key={d.account_id + d.metric} className="st-item">
                <Link href={`/creator/socials/${d.account_id}/metrics`}>
                  @{d.handle} · {metricLabel(d.metric)}
                </Link>{" "}
                <span className="st-hint">
                  {d.days_since === null
                    ? "never recorded"
                    : `${d.days_since} days ago`}
                </span>
                <form action={act.snoozeReminder}>
                  <input type="hidden" name="account" value={d.account_id} />
                  <button className="st-btn">Remind me next week</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.accounts.length === 0 ? (
        <p>
          No accounts yet. Add one to start your history. Unknown is never shown
          as zero.
        </p>
      ) : (
        <ul className="st-grid">
          {data.accounts.map((a) => {
            const f = a.latest.followers;
            const fr = freshness(
              "followers",
              a.platform,
              f?.observed_on ?? null,
              ctx.prefs.today,
              { disconnected: a.lifecycle === "disconnected" },
            );
            return (
              <li key={a.id} className="st-card">
                <h2>
                  <Link href={`/creator/socials/${a.id}`}>
                    {a.display_name || `@${a.handle}`}
                  </Link>
                </h2>
                <p>
                  {platformLabel(a.platform)} · @{a.handle}
                </p>
                <Badges a={a} />
                <p>
                  {f
                    ? `${f.value.toLocaleString("en")} followers (${sourceLabels[f.source as Source]?.label ?? f.source}, ${f.observed_on})`
                    : "Followers: not recorded"}
                </p>
                <p className="st-hint">
                  {fr.label}
                  {fr.recommendation ? `. ${fr.recommendation}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <section className="st-card" aria-labelledby="elig-h">
        <h2 id="elig-h">What your accounts qualify for</h2>
        <p>{elig.paidInfluencer.text}</p>
        {elig.privateAccounts.text && <p>{elig.privateAccounts.text}</p>}
      </section>
    </main>
  );
}
export async function NewView() {
  const ctx = await studioContext();
  const data = val(await social.accounts(ctx.client, ctx.workspaceId));
  return (
    <main>
      <p>
        <Link href="/creator/socials">All social accounts</Link>
      </p>
      <h1>Add a social account</h1>
      <p>
        We never ask for passwords or login codes. Adding an account is a
        self-report until you verify ownership.
      </p>
      <AddAccountForm
        action={act.addAccount}
        today={ctx.prefs.today}
        atLimit={data.used >= data.limit}
      />
    </main>
  );
}
export async function DetailView({
  id,
  sp,
}: {
  id: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const a = await loadAccount(ctx, id);
  const [sharesR, jobsR, otherR] = await Promise.all([
    social.shares(ctx.client, ctx.workspaceId, id),
    social.jobs(ctx.client, ctx.workspaceId, id),
    social.accounts(ctx.client, ctx.workspaceId),
  ]);
  const shares = sharesR.ok ? sharesR.value : [],
    jobs = jobsR.ok ? jobsR.value : [];
  const others = otherR.ok
    ? otherR.value.accounts.filter(
        (x) => x.id !== id && x.lifecycle === "active",
      )
    : [];
  const dis = a.lifecycle === "disconnected" || a.lifecycle === "removed";
  return (
    <main>
      <Header a={a} />
      <Tabs a={a} current={`/creator/socials/${id}`} />
      <Notice sp={sp} />
      <section className="st-card" aria-labelledby="d-h">
        <h2 id="d-h">Details</h2>
        <UpdateAccountForm action={act.updateAccount} account={a} />
      </section>
      <section className="st-card" aria-labelledby="p-h">
        <h2 id="p-h">Primary, preferred and sharing</h2>
        <form action={act.setPrimary}>
          <input type="hidden" name="account" value={id} />
          <input type="hidden" name="back" value={`/creator/socials/${id}`} />
          <button className="st-btn" disabled={a.is_primary || dis}>
            {a.is_primary ? "This is your primary account" : "Make primary"}
          </button>
        </form>
        <form action={act.setPreferred}>
          <input type="hidden" name="account" value={id} />
          <input type="hidden" name="back" value={`/creator/socials/${id}`} />
          {!a.preferred_for_platform && (
            <input type="hidden" name="on" value="on" />
          )}
          <button className="st-btn" disabled={dis}>
            {a.preferred_for_platform
              ? "Stop preferring on this platform"
              : "Prefer on this platform"}
          </button>
        </form>
        <form action={act.setSharing}>
          <input type="hidden" name="account" value={id} />
          <input type="hidden" name="back" value={`/creator/socials/${id}`} />
          <input
            type="hidden"
            name="visibility"
            value={
              a.sharing_visibility === "published" ? "private" : "published"
            }
          />
          <button className="st-btn">
            {a.sharing_visibility === "published"
              ? "Hide from my public profile"
              : "Show on my public profile"}
          </button>
        </form>
        <p className="st-hint">
          Metrics are private by default. Showing an account publishes only its
          handle and platform.
        </p>
      </section>
      <section className="st-card" aria-labelledby="s-h">
        <h2 id="s-h">Share metrics with a Brand or Agency</h2>
        {shares.length === 0 ? (
          <p>Nothing is shared.</p>
        ) : (
          <ul className="st-list">
            {shares.map((g) => (
              <li key={g.id} className="st-item">
                {g.status === "active" ? "Active" : "Revoked"}:{" "}
                {g.fields.join(", ")}. Purpose: {g.purpose}.
                {g.status === "active" && (
                  <form action={act.revokeGrant}>
                    <input type="hidden" name="grant" value={g.id} />
                    <input type="hidden" name="account" value={id} />
                    <button className="st-btn">Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <GrantForm action={act.grantShare} account={id} />
      </section>
      <section className="st-card" aria-labelledby="r-h">
        <h2 id="r-h">Refresh and connection</h2>
        <p>
          {a.connection === "connected"
            ? "Connected."
            : "No platform connection is available yet, so numbers are entered by you and labelled self-reported."}
        </p>
        <form action={act.requestRefresh}>
          <input type="hidden" name="account" value={id} />
          <button className="st-btn">Request a refresh</button>
        </form>
        {jobs.length > 0 && (
          <ul className="st-list">
            {jobs.map((j) => (
              <li key={j.id} className="st-item">
                {j.kind}: {j.status}
                {j.error_code ? ` (${j.error_code})` : ""}
              </li>
            ))}
          </ul>
        )}
        {a.connection === "connected" && (
          <form action={act.disconnectAccount}>
            <input type="hidden" name="account" value={id} />
            <button className="st-btn">Disconnect</button>
          </form>
        )}
      </section>
      <section className="st-card" aria-labelledby="x-h">
        <h2 id="x-h">Archive or remove</h2>
        <form action={act.archiveAccount}>
          <input type="hidden" name="account" value={id} />
          <input type="hidden" name="back" value="/creator/socials" />
          <input
            type="hidden"
            name="archive"
            value={a.lifecycle === "archived" ? "no" : "yes"}
          />
          <button className="st-btn">
            {a.lifecycle === "archived" ? "Restore" : "Archive (keeps history)"}
          </button>
        </form>
        <form action={act.removeAccount} aria-label="Remove account">
          <input type="hidden" name="account" value={id} />
          {a.is_primary && others.length > 0 && (
            <div className="st-field">
              <label htmlFor="rep">New primary account</label>
              <select id="rep" name="replacement">
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    @{o.handle} ({platformLabel(o.platform)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="st-hint">
            Removing hides the account and frees a slot. Your recorded history
            is retained.
          </p>
          <button className="st-btn">Remove account</button>
        </form>
      </section>
    </main>
  );
}
export async function VerifyView({
  id,
  sp,
}: {
  id: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const a = await loadAccount(ctx, id);
  const v = val(await social.verification(ctx.client, ctx.workspaceId, id));
  const c = v.claim;
  const o =
    ownershipLabels[v.verification as Ownership] ?? ownershipLabels.unverified;
  return (
    <main>
      <Header a={a} />
      <Tabs a={a} current={`/creator/socials/${id}/verify`} />
      <Notice sp={sp} />
      <section className="st-card" aria-labelledby="v-h">
        <h2 id="v-h">Ownership verification</h2>
        <p>
          <strong>{o.label}.</strong> {o.detail}
        </p>
        <p className="st-hint">
          Verification is decided by a platform-authorized reviewer with extra
          sign-in security. Nothing is verified automatically, and your account
          is never described as verified until it is.
        </p>
        {c?.disputed && (
          <p className="st-error">
            Another workspace has disputed this claim. A reviewer will look at
            both.
          </p>
        )}
        {c?.decision_reason && <p>Reviewer note: {c.decision_reason}</p>}
        {!c ||
        ["rejected", "cancelled", "expired", "revoked"].includes(c.state) ? (
          <form action={act.startVerification}>
            <input type="hidden" name="account" value={id} />
            <button className="st-btn primary">Start verification</button>
          </form>
        ) : null}
        {c?.challenge && !c.challenge.consumed && (
          <div>
            <h3>Your code</h3>
            <p>
              <code>{c.challenge.code}</code>
            </p>
            <p>
              Put this code in your profile bio or a post on{" "}
              {platformLabel(a.platform)}, then send it for review.{" "}
              {c.challenge.expired
                ? "This code has expired."
                : `Expires ${new Date(c.challenge.expires_at).toUTCString()}.`}
            </p>
          </div>
        )}
        {c && ["challenge_pending", "evidence_submitted"].includes(c.state) && (
          <>
            <EvidenceForm
              action={act.submitEvidence}
              claim={c.claim_id}
              enabled={evidenceUploadsEnabled()}
              reason={evidenceDisabledReason}
            />
            {c.evidence.length > 0 && (
              <ul className="st-list">
                {c.evidence.map((e) => (
                  <li key={e.id} className="st-item">
                    Uploaded {e.uploaded_at.slice(0, 10)} ·{" "}
                    {e.scan_status === "clean" ? "scanned" : "awaiting scan"}
                  </li>
                ))}
              </ul>
            )}
            <form action={act.requestReview}>
              <input type="hidden" name="account" value={id} />
              <input type="hidden" name="claim" value={c.claim_id} />
              <button className="st-btn primary">Send for review</button>
            </form>
            <form action={act.cancelVerification}>
              <input type="hidden" name="account" value={id} />
              <input type="hidden" name="claim" value={c.claim_id} />
              <button className="st-btn">Cancel</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
export async function MetricsView({
  id,
  sp,
}: {
  id: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const a = await loadAccount(ctx, id);
  const contentR = await social.content(ctx.client, ctx.workspaceId, id);
  const content = contentR.ok ? contentR.value : [];
  const rows = metrics.filter(
    (m) => m.scope === "account" && m.platforms.includes(a.platform),
  );
  const dis = a.lifecycle === "disconnected";
  return (
    <main>
      <Header a={a} />
      <Tabs a={a} current={`/creator/socials/${id}/metrics`} />
      <Notice sp={sp} />
      <section className="st-card" aria-labelledby="m-h">
        <h2 id="m-h">Latest values</h2>
        <ul className="st-list">
          {rows.map((m) => {
            const l = a.latest[m.code];
            const f = freshness(
              m.code,
              a.platform,
              l?.observed_on ?? null,
              ctx.prefs.today,
              { disconnected: dis },
            );
            return (
              <li key={m.code} className="st-item">
                <strong>{m.label}:</strong>{" "}
                {l
                  ? `${l.value.toLocaleString("en")} on ${l.observed_on} (${sourceLabels[l.source as Source]?.label ?? l.source})`
                  : "not recorded"}
                <span className="st-hint"> · {f.label}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="st-card" aria-labelledby="rec-h">
        <h2 id="rec-h">Record an account metric</h2>
        <ObservationForm
          action={act.recordObservation}
          account={id}
          platform={a.platform}
          today={ctx.prefs.today}
        />
      </section>
      <section className="st-card" aria-labelledby="ct-h">
        <h2 id="ct-h">Content metrics</h2>
        {content.length === 0 ? (
          <p>No content recorded.</p>
        ) : (
          <ul className="st-list">
            {content.map((c) => (
              <li key={c.id} className="st-item">
                <strong>{c.title || c.url || c.external_id}</strong>
                {Object.entries(c.latest_lifetime).map(([k, v]) => (
                  <div key={k}>
                    {metricLabel(k)}: {v.value.toLocaleString("en")} (lifetime,{" "}
                    {v.observed_on})
                  </div>
                ))}
                {c.window_observations.map((w) => (
                  <div key={w.metric + w.period_start}>
                    {metricLabel(w.metric)}: {w.value.toLocaleString("en")} (
                    {w.period_start} to {w.period_end})
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
        <ContentForm
          action={act.recordContent}
          account={id}
          platform={a.platform}
          today={ctx.prefs.today}
        />
      </section>
    </main>
  );
}
export async function HistoryView({
  id,
  sp,
}: {
  id: string;
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const a = await loadAccount(ctx, id);
  const metric = typeof sp.metric === "string" ? sp.metric : null;
  let cursor: unknown = null;
  try {
    if (typeof sp.cursor === "string")
      cursor = JSON.parse(Buffer.from(sp.cursor, "base64url").toString());
  } catch {
    cursor = null;
  }
  const page = val(
    await social.observations(ctx.client, ctx.workspaceId, id, metric, cursor),
  );
  const next = page.next_cursor
    ? Buffer.from(JSON.stringify(page.next_cursor)).toString("base64url")
    : null;
  const q = (extra: string) =>
    `/creator/socials/${id}/history?${metric ? `metric=${metric}&` : ""}${extra}`;
  return (
    <main>
      <Header a={a} />
      <Tabs a={a} current={`/creator/socials/${id}/history`} />
      <Notice sp={sp} />
      <h2>History</h2>
      {a.history_stale_since && (
        <p className="st-hint">
          This account was disconnected. Numbers after{" "}
          {a.history_stale_since.slice(0, 10)} are not synchronized.
        </p>
      )}
      <form method="get" aria-label="Filter history">
        <div className="st-field">
          <label htmlFor="hm">Metric</label>
          <select id="hm" name="metric" defaultValue={metric ?? ""}>
            <option value="">All metrics</option>
            {metrics
              .filter(
                (m) =>
                  m.scope === "account" && m.platforms.includes(a.platform),
              )
              .map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
          </select>
        </div>
        <button className="st-btn">Filter</button>
      </form>
      {page.items.length === 0 ? (
        <p>Nothing recorded yet.</p>
      ) : (
        <ul className="st-list">
          {page.items.map((o) => (
            <li key={o.id} className="st-item">
              <strong>
                {metricLabel(o.metric)}: {o.value.toLocaleString("en")}
              </strong>{" "}
              · {o.observed_on}
              {o.period_start &&
                ` (${o.period_start} to ${o.period_end})`} ·{" "}
              {sourceLabels[o.source as Source]?.label ?? o.source}
              {o.superseded_by && " · superseded by a correction"}
              {o.supersedes && " · correction"}
              {o.historical && " · historical"}
              {o.note && <div className="st-hint">{o.note}</div>}
              {!o.superseded_by && (
                <details>
                  <summary>Correct this</summary>
                  <form
                    action={act.correctObservation}
                    aria-label="Correct observation"
                  >
                    <input type="hidden" name="observation" value={o.id} />
                    <input type="hidden" name="account" value={id} />
                    <div className="st-field">
                      <label htmlFor={`cv-${o.id}`}>Corrected value</label>
                      <input
                        id={`cv-${o.id}`}
                        name="value"
                        type="number"
                        min={0}
                        step="any"
                        required
                      />
                    </div>
                    <div className="st-field">
                      <label htmlFor={`cr-${o.id}`}>Reason</label>
                      <input
                        id={`cr-${o.id}`}
                        name="reason"
                        required
                        maxLength={200}
                      />
                    </div>
                    <button className="st-btn">Save correction</button>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {next && (
        <p>
          <Link href={q(`cursor=${next}`)}>Older entries</Link>
        </p>
      )}
    </main>
  );
}
export async function SettingsView({
  sp,
}: {
  sp: Record<string, string | string[] | undefined>;
}) {
  const ctx = await studioContext();
  const rem = val(await social.reminders(ctx.client, ctx.workspaceId));
  return (
    <main>
      <p>
        <Link href="/creator/socials">All social accounts</Link>
      </p>
      <h1>Social account settings</h1>
      <Notice sp={sp} />
      <form action={act.setReminders} aria-label="Weekly reminders">
        <p>
          <label>
            <input type="checkbox" name="weekly" defaultChecked={rem.weekly} />{" "}
            Weekly in-app reminder to update stale numbers
          </label>
        </p>
        <p className="st-hint">
          In-app only. Email is not sent. A reminder appears when a metric is
          older than its freshness window.
        </p>
        <button className="st-btn primary">Save</button>
      </form>
    </main>
  );
}
