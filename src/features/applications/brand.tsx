import { notFound } from "next/navigation";
import { brandContext, market } from "@/server/market/service";
import { apply } from "@/server/apply/service";
import { eligible } from "@/server/auth/session";
import { EntityForm } from "@/features/creator-profile/forms";
import { appStatus, invitationStatus, reportReasons } from "./rules";
import * as act from "./actions";
import {
  Link,
  NegotiationBody,
  Notice,
  Status,
  Timeline,
  day,
  one,
  uuidRe,
  when,
  type Negotiation,
  type SP,
} from "./ui";
import { CampaignTabs } from "@/features/campaigns/tabs";
import {
  CandidatePanel,
  HandoffLink,
  Inbox,
} from "@/features/selection/panels";
import "./apply.css";

const shell = { padding: "1.5rem 1rem 4rem" } as const;
const W = (w: string) => ({
  name: "w",
  label: "",
  type: "hidden" as const,
  value: w,
});
function BrandTabs({ current, w }: { current: string; w: string }) {
  const t: [string, string][] = [
    ["/brand/campaigns", "Campaigns"],
    ["/brand/inbox", "Invitations, enquiries and negotiations"],
  ];
  return (
    <nav aria-label="Brand sections" className="mk-tabs">
      {t.map(([h, l]) => (
        <Link
          key={h}
          href={`${h}?w=${w}`}
          aria-current={h === current ? "page" : undefined}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
type Rules = {
  quick_apply: boolean;
  reapply: boolean;
  negotiable: boolean;
  submission_capacity: number | null;
  selection_capacity: number | null;
} | null;
type Q = { id: string; prompt: string; required: boolean; kind: string };
export async function CampaignApplicationsView({
  id,
  sp,
}: {
  id: string;
  sp: SP;
}) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const [list, rules] = await Promise.all([
    apply.campaignApplications(b.client, b.workspaceId, id),
    apply.rules(b.client, b.workspaceId, id),
  ]);
  if (!list.ok || !rules.ok) notFound();
  const l = list.value as unknown as {
    campaign: { id: string; title: string; status: string };
    selected: number;
    applications: {
      id: string;
      creator: string;
      status: string;
      version: number;
      submitted_at: string;
      locked: boolean;
    }[];
  };
  const r = rules.value as unknown as {
    rules: Rules;
    questions: Q[];
    locked: boolean;
  };
  const qText = r.questions
    .map(
      (q) =>
        `${q.required ? "* " : ""}${q.prompt}${q.kind === "yes_no" ? " (yes/no)" : ""}`,
    )
    .join("\n");
  return (
    <main className="shell" style={shell}>
      <CampaignTabs id={id} w={b.workspaceId} current="applications" />
      <h1>Applications · {l.campaign.title}</h1>
      <Inbox w={b.workspaceId} campaignId={id} sp={sp} />
      <section className="st-card" aria-labelledby="h-rules">
        <h2 id="h-rules">Application rules and screening</h2>
        <EntityForm
          action={act.saveRules}
          label="Application rules"
          idPrefix="ru"
          submit="Save rules"
          fields={[
            { name: "id", label: "", type: "hidden", value: id },
            W(b.workspaceId),
            ...(r.locked
              ? [
                  {
                    name: "lock_questions",
                    label: "",
                    type: "hidden" as const,
                    value: "1",
                  },
                ]
              : []),
            {
              name: "quick_apply",
              label:
                "Allow quick apply (pitch optional; required questions and the explicit confirmation still apply)",
              type: "checkbox",
              value: r.rules?.quick_apply,
            },
            {
              name: "reapply",
              label:
                "Allow Creators to reapply after a withdrawal or rejection",
              type: "checkbox",
              value: r.rules?.reapply,
              hint: "Without this, a Creator may reapply once after withdrawing their own application.",
            },
            {
              name: "negotiable",
              label:
                "Terms are negotiable (Creators can send a quote and counter-proposals)",
              type: "checkbox",
              value: r.rules?.negotiable,
            },
            {
              name: "submission_capacity",
              label: "Maximum applications",
              type: "number",
              min: 1,
              value: r.rules?.submission_capacity,
              hint: "Empty means no limit. Separate from how many you select.",
            },
            {
              name: "selection_capacity",
              label: "Maximum selections",
              type: "number",
              min: 1,
              value: r.rules?.selection_capacity,
              hint: "Empty uses the campaign's positions.",
            },
            ...(r.locked
              ? []
              : [
                  {
                    name: "questions",
                    label: "Screening questions, one per line",
                    type: "textarea" as const,
                    rows: 5,
                    value: qText,
                    hint: "Start a line with * to make it required; end it with (yes/no) for a yes or no answer. Ask about existing work and fit; you cannot ask for new content for free. Up to 10.",
                  },
                ]),
          ]}
        />
        {r.locked && (
          <p className="mk-sub">
            Questions are fixed now that Creators have applied:{" "}
            {r.questions.length
              ? r.questions.map((q) => q.prompt).join(" · ")
              : "none"}
            .
          </p>
        )}
      </section>
      {l.campaign.status === "published" && (
        <section className="st-card" aria-labelledby="h-inv">
          <h2 id="h-inv">Invite a Creator</h2>
          <EntityForm
            action={act.invite}
            label="Invite a Creator"
            idPrefix="iv"
            submit="Send invitation"
            fields={[
              { name: "id", label: "", type: "hidden", value: id },
              W(b.workspaceId),
              {
                name: "creator",
                label: "Creator username",
                required: true,
                hint: "The username of their published AURA profile, for example aura.test/creator/asha.",
              },
              {
                name: "message",
                label: "Why you are inviting them",
                type: "textarea",
                rows: 3,
                max: 2000,
                required: true,
              },
            ]}
          />
          <p className="mk-sub">
            Only Creators who meet every mandatory requirement can be invited.
            One open invitation per Creator; it expires after 14 days. Accepting
            is not an agreement.
          </p>
        </section>
      )}
    </main>
  );
}
type BApp = {
  id: string;
  campaign_id: string;
  campaign: string;
  status: string;
  version: number;
  submitted_at: string;
  locked: boolean;
  feedback: string | null;
  collaboration_id: string | null;
  shared: {
    creator: string;
    pitch: string | null;
    answers: Record<string, string>;
    quote: { currency: string; amount: number; note?: string } | null;
    account: {
      platform: string;
      handle: string;
      ownership: string;
      followers: { value: number; observed_on: string; source: string } | null;
    } | null;
    portfolio: {
      ref_id: string;
      title: string;
      kind: string;
      description?: string;
      link?: string;
      brand_name?: string;
      year?: number;
    }[];
    kit: {
      kit?: { name?: string };
      sections?: { key: string; items: unknown[] }[];
    } | null;
  };
  questions: { id: string; prompt: string }[];
  versions: { version: number; created_at: string }[];
  clarifications: {
    id: string;
    question: string;
    answer: string | null;
    due_at: string;
    answered_at: string | null;
  }[];
  history: { event: string; side: string; at: string }[];
};
export async function BrandApplicationView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const r = await apply.brandApplication(b.client, b.workspaceId, id);
  if (!r.ok) notFound();
  const a = r.value as unknown as BApp;
  const s = a.shared;
  const closed = [
    "withdrawn",
    "rejected",
    "expired",
    "cancelled",
    "converted",
  ].includes(a.status);
  const actions: Record<string, string> = {
    review: "Start review (locks the application)",
    shortlist: "Shortlist",
    waitlist: "Waitlist (not a promise)",
    reject: "Not selected",
  };
  return (
    <main className="shell" style={shell}>
      <p>
        <Link
          href={`/brand/campaigns/${a.campaign_id}/applications?w=${b.workspaceId}`}
        >
          All applications for {a.campaign}
        </Link>
      </p>
      <h1>{s.creator}</h1>
      <p>
        <Status s={a.status} />{" "}
        <span className="mk-sub">
          Version {a.version} · sent {when(a.submitted_at)}
          {a.locked ? " · locked" : " · the Creator can still edit it"}
        </span>
      </p>
      {a.collaboration_id && ["selected", "converted"].includes(a.status) && (
        <p>
          <Link
            className="st-btn primary"
            href={`/brand/negotiations/${a.collaboration_id}?w=${b.workspaceId}`}
          >
            Open the negotiation
          </Link>
        </p>
      )}
      <div className="ap-cols">
        <div>
          <section className="st-card" aria-labelledby="h-p">
            <h2 id="h-p">Application</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {s.pitch ?? (
                <span className="mk-sub">No pitch (quick apply)</span>
              )}
            </p>
            <dl className="mk-terms">
              <dt>Account</dt>
              <dd>
                {s.account ? (
                  <>
                    {s.account.platform} @{s.account.handle} ·{" "}
                    <span className="mk-pill line">
                      ownership {s.account.ownership}
                    </span>
                    {s.account.followers
                      ? ` · ${s.account.followers.value.toLocaleString("en-IN")} followers (${s.account.followers.source}, ${s.account.followers.observed_on})`
                      : " · followers not shared"}
                  </>
                ) : (
                  "None"
                )}
              </dd>
              {s.quote && (
                <>
                  <dt>Quote</dt>
                  <dd>
                    {s.quote.currency} {s.quote.amount.toLocaleString("en-IN")}
                    {s.quote.note ? ` · ${s.quote.note}` : ""}
                  </dd>
                </>
              )}
            </dl>
          </section>
          {a.questions.length > 0 && (
            <section className="st-card" aria-labelledby="h-q">
              <h2 id="h-q">Screening answers</h2>
              <dl className="mk-terms">
                {a.questions.map((q) => (
                  <div key={q.id}>
                    <dt>{q.prompt}</dt>
                    <dd>
                      {s.answers[q.id] ?? (
                        <span className="mk-sub">Not answered</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="st-card" aria-labelledby="h-w">
            <h2 id="h-w">Shared work</h2>
            {s.portfolio.length === 0 && !s.kit ? (
              <p className="mk-sub">
                The Creator did not attach portfolio items or a media kit.
              </p>
            ) : null}
            <ul className="st-list">
              {s.portfolio.map((p) => (
                <li key={p.ref_id} className="st-item">
                  <b>{p.title}</b>
                  {p.brand_name ? ` · ${p.brand_name}` : ""}
                  {p.year ? ` · ${p.year}` : ""}
                  {p.description ? (
                    <>
                      <br />
                      <span className="mk-sub">{p.description}</span>
                    </>
                  ) : null}
                  {p.link ? (
                    <>
                      <br />
                      <a
                        href={p.link}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                      >
                        Open the work
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {s.kit && (
              <p>
                Media kit attached: <b>{s.kit.kit?.name ?? "Media kit"}</b> (
                {(s.kit.sections ?? [])
                  .map((x) => x.key.replace(/_/g, " "))
                  .join(", ")}
                )
              </p>
            )}
            <p className="mk-sub">
              You see only what the Creator chose to share for this campaign.
            </p>
          </section>
          <section className="st-card" aria-labelledby="h-c">
            <h2 id="h-c">Questions to the Creator</h2>
            {a.clarifications.map((c) => (
              <div key={c.id} className="ap-version">
                <p>
                  <b>{c.question}</b>
                </p>
                <p>
                  {c.answer ?? (
                    <span className="mk-sub">Due {day(c.due_at)}</span>
                  )}
                </p>
              </div>
            ))}
            {!closed && a.status !== "selected" && (
              <EntityForm
                action={act.askClarification}
                label="Ask a question"
                idPrefix="aq"
                submit="Ask"
                fields={[
                  { name: "id", label: "", type: "hidden", value: a.id },
                  W(b.workspaceId),
                  {
                    name: "question",
                    label: "Question",
                    type: "textarea",
                    rows: 2,
                    max: 1000,
                    required: true,
                    hint: "Asking a question locks the application. The Creator has 5 days to answer.",
                  },
                ]}
              />
            )}
          </section>
        </div>
        <aside className="ap-aside">
          <CandidatePanel w={b.workspaceId} appId={a.id} status={a.status} />
          {!closed && (
            <section className="st-card ap-preview" aria-labelledby="h-d">
              <h2 id="h-d">Decision</h2>
              <EntityForm
                action={act.decide}
                label="Decision"
                idPrefix="dc"
                submit="Record decision"
                fields={[
                  { name: "id", label: "", type: "hidden", value: a.id },
                  W(b.workspaceId),
                  {
                    name: "action",
                    label: "Decision",
                    type: "select",
                    required: true,
                    options: Object.fromEntries(
                      Object.entries(actions).filter(
                        ([k]) => !(k === "review" && a.locked),
                      ),
                    ),
                  },
                  {
                    name: "feedback",
                    label: "Feedback for the Creator",
                    type: "textarea",
                    rows: 3,
                    max: 1000,
                    showIf: { field: "action", in: ["reject"] },
                    hint: "Optional and constructive. It is shown to the Creator.",
                  },
                ]}
              />
              <p className="mk-sub">
                To select a Creator, offer a place: it is held for 72 hours
                until they accept. Selection is not an agreement.
              </p>
            </section>
          )}
          {a.feedback && (
            <p className="mk-banner">Your feedback: {a.feedback}</p>
          )}
          <section className="st-card" aria-labelledby="h-h">
            <h2 id="h-h">History</h2>
            <Timeline items={a.history} />
            <p className="mk-sub">
              Submitted versions:{" "}
              {a.versions.map((v) => `v${v.version}`).join(", ")}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
type BOverview = {
  invitations: {
    id: string;
    campaign: string;
    creator: string;
    status: string;
    expires_at: string;
    decline_reason: string | null;
    collaboration_id: string | null;
    questions: string[];
  }[];
  enquiries: {
    id: string;
    creator: string;
    status: string;
    reply: string | null;
    created_at: string;
  }[];
  negotiations: {
    id: string;
    campaign: string;
    creator: string;
    status: string;
    updated_at: string;
  }[];
  notifications: {
    id: string;
    title: string;
    link: string | null;
    created_at: string;
    read_at: string | null;
  }[];
};
export async function BrandInbox({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const [r, s] = await Promise.all([
    apply.brand(b.client, b.workspaceId),
    market.brandState(b.client, b.workspaceId),
  ]);
  if (!r.ok || !s.ok) notFound();
  const o = r.value as unknown as BOverview;
  const live = s.value.campaigns.filter((c) => c.status === "published");
  const unread = o.notifications.filter((n) => !n.read_at).length;
  return (
    <main className="shell" style={shell}>
      <header className="mk-hero">
        <h1>Invitations, enquiries and negotiations · {b.name}</h1>
        <p>
          Reach Creators respectfully: one open invitation each, limited daily
          outreach, and nothing is binding until an agreement is accepted.
        </p>
      </header>
      <BrandTabs current="/brand/inbox" w={b.workspaceId} />
      {b.verification !== "verified" && (
        <p className="mk-banner">
          Invitations and enquiries need an approved business verification.
        </p>
      )}
      <section className="st-card" aria-labelledby="h-n">
        <h2 id="h-n">Negotiations</h2>
        {o.negotiations.length === 0 ? (
          <p className="mk-sub">
            None yet. A negotiation opens when you select an applicant or a
            Creator is interested in your invitation.
          </p>
        ) : (
          <ul className="st-list">
            {o.negotiations.map((n) => (
              <li key={n.id} className="st-item">
                <Link href={`/brand/negotiations/${n.id}?w=${b.workspaceId}`}>
                  {n.campaign} · {n.creator}
                </Link>{" "}
                <Status s={n.status} kind="collab" />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="st-card" aria-labelledby="h-i">
        <h2 id="h-i">Invitations sent</h2>
        {o.invitations.length === 0 ? (
          <p className="mk-sub">
            Invite Creators from a live campaign&apos;s applications page.
          </p>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th scope="col">Creator</th>
                <th scope="col">Campaign</th>
                <th scope="col">Status</th>
                <th scope="col">Questions</th>
              </tr>
            </thead>
            <tbody>
              {o.invitations.map((i) => (
                <tr key={i.id}>
                  <td>{i.creator}</td>
                  <td>{i.campaign}</td>
                  <td>
                    <span className="ap-status" data-s={i.status}>
                      {invitationStatus[i.status] === "Waiting for your answer"
                        ? "Waiting for the Creator"
                        : i.status === "interested"
                          ? "Interested"
                          : (invitationStatus[i.status] ?? i.status)}
                    </span>
                    {i.decline_reason ? (
                      <>
                        <br />
                        <span className="mk-sub">“{i.decline_reason}”</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {i.questions.length === 0
                      ? "—"
                      : i.questions.map((q, n) => (
                          <p key={n}>
                            <b>{q}</b>
                          </p>
                        ))}
                    {i.questions.length > 0 && (
                      <EntityForm
                        action={act.brandAnswer}
                        label="Answer the Creator"
                        idPrefix={`ba-${i.id.slice(0, 6)}`}
                        submit="Answer"
                        fields={[
                          {
                            name: "id",
                            label: "",
                            type: "hidden",
                            value: i.id,
                          },
                          W(b.workspaceId),
                          {
                            name: "answer",
                            label: "Answer",
                            type: "textarea",
                            rows: 2,
                            max: 1000,
                            required: true,
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="st-card" aria-labelledby="h-e">
        <h2 id="h-e">Enquiries</h2>
        <p className="mk-sub">
          A short preliminary question (for example availability). It is shown
          to the Creator as an enquiry, never as an invitation or offer.
        </p>
        <EntityForm
          action={act.enquire}
          label="Send an enquiry"
          idPrefix="eq"
          submit="Send enquiry"
          fields={[
            W(b.workspaceId),
            { name: "creator", label: "Creator username", required: true },
            {
              name: "campaign",
              label: "About a campaign",
              type: "select",
              options: {
                "": "No specific campaign",
                ...Object.fromEntries(live.map((c) => [c.id, c.title])),
              },
            },
            {
              name: "message",
              label: "Your question",
              type: "textarea",
              rows: 3,
              max: 2000,
              required: true,
            },
          ]}
        />
        {o.enquiries.length > 0 && (
          <ul className="st-list">
            {o.enquiries.map((e) => (
              <li key={e.id} className="st-item">
                {e.creator} ·{" "}
                <span className="ap-status" data-s={e.status}>
                  {e.status === "sent" ? "Waiting" : e.status}
                </span>{" "}
                · {day(e.created_at)}
                {e.reply ? (
                  <>
                    <br />“{e.reply}”
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="st-card" aria-labelledby="h-u">
        <h2 id="h-u">
          Updates{" "}
          {unread ? <span className="mk-pill">{unread} new</span> : null}
        </h2>
        {o.notifications.length === 0 ? (
          <p className="mk-sub">No updates yet.</p>
        ) : (
          <>
            <ul className="st-list">
              {o.notifications.slice(0, 15).map((n) => (
                <li key={n.id} className="st-item">
                  {n.link ? (
                    <Link href={`${n.link}?w=${b.workspaceId}`}>{n.title}</Link>
                  ) : (
                    n.title
                  )}{" "}
                  <span className="mk-sub">· {when(n.created_at)}</span>
                </li>
              ))}
            </ul>
            {unread > 0 && (
              <form action={act.markRead}>
                <input type="hidden" name="w" value={b.workspaceId} />
                <button className="st-btn">Mark all as read</button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
export async function BrandNegotiationView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const r = await apply.negotiation(b.client, b.workspaceId, id);
  if (!r.ok) notFound();
  const n = r.value as unknown as Negotiation;
  return (
    <main className="shell" style={shell}>
      <p>
        <Link href={`/brand/inbox?w=${b.workspaceId}`}>All negotiations</Link>
      </p>
      <h1>Negotiation: {n.campaign}</h1>
      <HandoffLink client={b.client} ws={b.workspaceId} collab={n.id} />
      <NegotiationBody n={n} w={b.workspaceId} sp={sp} />
    </main>
  );
}
export async function ReportQueueView({ sp }: { sp: SP }) {
  const { client } = await eligible();
  const q = await apply.reportQueue(client);
  if (!q.ok) notFound();
  const items = q.value as unknown as {
    id: string;
    kind: string;
    reason: keyof typeof reportReasons;
    details: string | null;
    text: string | null;
    created_at: string;
  }[];
  return (
    <main className="shell" style={{ padding: "2rem 1rem" }}>
      <h1>Application reports</h1>
      <p>
        Reported invitations, enquiries and negotiation messages. Restricted to
        granted reviewers with a verified authenticator. Actioning a reported
        invitation withdraws it. Every decision needs a reason and is audited.
      </p>
      {sp.notice && (
        <p className="st-error" role="status">
          That decision could not be saved.
        </p>
      )}
      {sp.decided && (
        <p className="st-ok" role="status">
          Decision recorded.
        </p>
      )}
      {items.length === 0 ? (
        <p>No open reports.</p>
      ) : (
        <ul className="st-list">
          {items.map((r) => (
            <li key={r.id} className="st-item">
              <p>
                <b>{r.kind}</b> · {reportReasons[r.reason] ?? r.reason} ·{" "}
                {day(r.created_at)}
              </p>
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {r.text}
              </blockquote>
              {r.details && <p className="mk-sub">Reporter: {r.details}</p>}
              <form action={act.decideReport} className="mk-row">
                <input type="hidden" name="id" value={r.id} />
                <label className="sr-only" htmlFor={`d-${r.id}`}>
                  Decision
                </label>
                <select id={`d-${r.id}`} name="decision">
                  <option value="actioned">Action it</option>
                  <option value="dismissed">Dismiss</option>
                </select>
                <label className="sr-only" htmlFor={`r-${r.id}`}>
                  Reason
                </label>
                <input
                  id={`r-${r.id}`}
                  name="reason"
                  placeholder="Reason (required)"
                  required
                  minLength={3}
                  maxLength={500}
                />
                <button className="st-btn">Record</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
export { appStatus, Notice };
