import { notFound, redirect } from "next/navigation";
import { studioContext } from "@/server/studio/service";
import { apply } from "@/server/apply/service";
import { EntityForm } from "@/features/creator-profile/forms";
import { appStatus, pendingAction } from "./rules";
import * as act from "./actions";
import { ApplyForm, type Account, type Draft, type Question } from "./forms";
import {
  Empty,
  Link,
  NegotiationBody,
  Notice,
  ReportBox,
  Status,
  Steps,
  Timeline,
  day,
  one,
  uuidRe,
  when,
  type Negotiation,
  type SP,
} from "./ui";
import "@/features/marketplace/market.css";
import { HandoffLink, OfferPanel } from "@/features/selection/panels";
import { selection } from "@/server/selection/service";
import "./apply.css";

type Overview = {
  applications: {
    id: string;
    campaign_id: string;
    campaign: string;
    status: string;
    version: number;
    submitted_at: string | null;
    updated_at: string;
    locked: boolean;
    pending: number;
    collaboration_id: string | null;
  }[];
  invitations: {
    id: string;
    campaign_id: string;
    campaign: string;
    brand: string;
    brand_id: string;
    status: string;
    expires_at: string;
    created_at: string;
    collaboration_id: string | null;
  }[];
  enquiries: {
    id: string;
    brand: string;
    brand_id: string;
    status: string;
    created_at: string;
    campaign: string | null;
  }[];
  negotiations: {
    id: string;
    campaign: string;
    brand: string;
    status: string;
    updated_at: string;
  }[];
  blocked: { id: string; name: string }[];
  notifications: {
    id: string;
    kind: string;
    title: string;
    link: string | null;
    created_at: string;
    read_at: string | null;
  }[];
};
async function overview() {
  const c = await studioContext();
  const r = await apply.creator(c.client, c.workspaceId);
  if (!r.ok) throw new Error("apply:" + r.error);
  return { c, o: r.value as unknown as Overview };
}
function Tabs({ current }: { current: string }) {
  const t: [string, string][] = [
    ["/creator/applications", "Applications"],
    ["/creator/invitations", "Invitations"],
    ["/creator/enquiries", "Enquiries"],
    ["/creator/settings/applications", "Blocked Brands"],
  ];
  return (
    <nav aria-label="Applications sections" className="mk-tabs">
      {t.map(([h, l]) => (
        <Link
          key={h}
          href={h}
          aria-current={h === current ? "page" : undefined}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
function Hero({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="mk-hero">
      <h1>{title}</h1>
      <p>{lead}</p>
    </header>
  );
}
export async function ApplicationsHome({ sp }: { sp: SP }) {
  const { o } = await overview();
  const active = o.applications.filter(
    (a) =>
      !["withdrawn", "rejected", "expired", "cancelled", "converted"].includes(
        a.status,
      ),
  );
  const closed = o.applications.filter((a) => !active.includes(a));
  const todo =
    o.applications.filter((a) => pendingAction(a.status, a.pending)).length +
    o.invitations.filter((i) => i.status === "sent").length +
    o.enquiries.filter((e) => e.status === "sent").length;
  const unread = o.notifications.filter((n) => !n.read_at);
  return (
    <main>
      <Hero
        title="Applications and invitations"
        lead="Everything between finding a campaign and an agreement: what you sent, what Brands asked, and the terms you are agreeing. Nothing here is binding."
      />
      <Tabs current="/creator/applications" />
      <Notice sp={sp} />
      <div className="ap-stats">
        <div className="ap-stat">
          <b>{active.length}</b>active applications
        </div>
        <div className="ap-stat">
          <b>{todo}</b>waiting for you
        </div>
        <div className="ap-stat">
          <b>{o.invitations.filter((i) => i.status === "sent").length}</b>open
          invitations
        </div>
        <div className="ap-stat">
          <b>{o.negotiations.length}</b>negotiations
        </div>
      </div>
      {o.negotiations.length > 0 && (
        <section className="st-card" aria-labelledby="h-neg">
          <h2 id="h-neg">Negotiations</h2>
          <ul className="st-list">
            {o.negotiations.map((n) => (
              <li key={n.id} className="st-item">
                <Link href={`/creator/negotiations/${n.id}`}>{n.campaign}</Link>{" "}
                · {n.brand} · <Status s={n.status} kind="collab" />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="st-card" aria-labelledby="h-act">
        <h2 id="h-act">Your applications</h2>
        {active.length === 0 ? (
          <Empty title="No active applications">
            <p>
              Find a campaign you qualify for and apply from its page.{" "}
              <Link href="/creator/marketplace">Open the marketplace</Link>.
            </p>
          </Empty>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Status</th>
                <th scope="col">Next step</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {active.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link
                      href={
                        a.status === "draft"
                          ? `/creator/marketplace/${a.campaign_id}/apply`
                          : `/creator/applications/${a.id}`
                      }
                    >
                      {a.campaign}
                    </Link>
                  </td>
                  <td>
                    <Status s={a.status} />
                  </td>
                  <td>
                    {pendingAction(a.status, a.pending) ?? (
                      <span className="mk-sub">Nothing needed</span>
                    )}
                  </td>
                  <td>{day(a.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {closed.length > 0 && (
        <details className="st-card">
          <summary>
            <h2 style={{ display: "inline" }}>Closed ({closed.length})</h2>
          </summary>
          <ul className="st-list">
            {closed.map((a) => (
              <li key={a.id} className="st-item">
                <Link href={`/creator/applications/${a.id}`}>{a.campaign}</Link>{" "}
                · <Status s={a.status} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="st-card" aria-labelledby="h-up">
        <h2 id="h-up">
          Updates{" "}
          {unread.length ? (
            <span className="mk-pill">{unread.length} new</span>
          ) : null}
        </h2>
        {o.notifications.length === 0 ? (
          <p className="mk-sub">No updates yet.</p>
        ) : (
          <>
            <ul className="st-list">
              {o.notifications.slice(0, 15).map((n) => (
                <li key={n.id} className="st-item">
                  {n.link ? <Link href={n.link}>{n.title}</Link> : n.title}{" "}
                  <span className="mk-sub">
                    · {when(n.created_at)}
                    {n.read_at ? "" : " · new"}
                  </span>
                </li>
              ))}
            </ul>
            {unread.length > 0 && (
              <form action={act.markRead}>
                <button className="st-btn">Mark all as read</button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
export async function ApplyView({ id }: { id: string }) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await apply.form(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const f = r.value as unknown as {
    campaign: {
      id: string;
      title: string;
      brand: { name: string };
      closes_at: string;
      eligibility: { eligible: boolean };
    };
    rules: { quick_apply: boolean; reapply: boolean; negotiable: boolean };
    questions: Question[];
    application: { id: string; status: string; content: Draft } | null;
    previous: { id: string; status: string }[] | null;
    accounts: Account[];
    portfolio: {
      id: string;
      title: string;
      kind: string;
      visibility: string;
    }[];
    kits: { id: string; name: string }[];
  };
  if (f.application && f.application.status !== "draft")
    redirect(`/creator/applications/${f.application.id}`);
  const d = f.campaign;
  return (
    <main>
      <p>
        <Link href={`/creator/marketplace/${id}`}>Back to the campaign</Link>
      </p>
      <h1>Apply: {d.title}</h1>
      <p className="mk-sub">
        {d.brand.name} · closes {day(d.closes_at)}
        {f.rules.quick_apply ? " · quick apply allowed" : ""}
      </p>
      {!d.eligibility.eligible ? (
        <p className="mk-banner">
          You do not meet every mandatory requirement, so you cannot send an
          application.{" "}
          <Link href={`/creator/marketplace/${id}/eligibility`}>
            See what is missing
          </Link>
          . You can still prepare a draft.
        </p>
      ) : null}
      {f.previous?.length ? (
        <p className="mk-banner">
          You applied before (
          {f.previous
            .map((p) => appStatus[p.status]?.label ?? p.status)
            .join(", ")}
          ).{" "}
          {f.rules.reapply
            ? "This Brand allows reapplying."
            : "You can reapply once after withdrawing your own application; otherwise reapplying is not allowed for this campaign."}
        </p>
      ) : null}
      <ApplyForm
        action={act.submitApplication}
        campaign={id}
        applicationId={f.application?.id}
        draft={f.application?.content ?? {}}
        questions={f.questions}
        accounts={f.accounts}
        portfolio={f.portfolio}
        kits={f.kits.map((k) => ({ id: k.id, title: k.name }))}
        quickApply={f.rules.quick_apply}
        negotiable={f.rules.negotiable}
        mode="new"
      />
      {f.application && (
        <form action={act.deleteDraft} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="id" value={f.application.id} />
          <button className="st-btn">Delete this draft</button>
        </form>
      )}
    </main>
  );
}
type App = {
  id: string;
  campaign_id: string;
  campaign: string;
  status: string;
  version: number;
  submitted_at: string | null;
  locked_at: string | null;
  feedback: string | null;
  collaboration_id: string | null;
  can_reapply: boolean;
  content: Draft;
  shared_preview: {
    pitch: string | null;
    account: {
      platform: string;
      handle: string;
      ownership: string;
      followers: { value: number; observed_on: string } | null;
    } | null;
    portfolio: { id: string; title: string }[];
    kit: { kit?: { name?: string } } | null;
    quote: { currency: string; amount: number } | null;
  };
  versions: { version: number; created_at: string; submitted: boolean }[];
  clarifications: {
    id: string;
    question: string;
    answer: string | null;
    due_at: string;
    answered_at: string | null;
  }[];
  history: { event: string; side: string; at: string }[];
};
export async function ApplicationView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await apply.application(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const a = r.value as unknown as App;
  if (a.status === "draft")
    redirect(`/creator/marketplace/${a.campaign_id}/apply`);
  const open = ![
    "withdrawn",
    "rejected",
    "expired",
    "cancelled",
    "converted",
  ].includes(a.status);
  const editable = a.status === "submitted" && !a.locked_at;
  let form: Awaited<ReturnType<typeof apply.form>> | null = null;
  if (editable) form = await apply.form(c.client, c.workspaceId, a.campaign_id);
  const fv = form?.ok
    ? (form.value as unknown as {
        questions: Question[];
        accounts: Account[];
        portfolio: { id: string; title: string; visibility: string }[];
        kits: { id: string; name: string }[];
        rules: { quick_apply: boolean; negotiable: boolean };
      })
    : null;
  const sh = a.shared_preview;
  // M18: while a place is offered, the offer panel explains the state instead of the shortlist line
  const off = await selection.offer(c.client, c.workspaceId, a.id);
  const offerOpen = off.ok && off.value.hold?.status === "held";
  return (
    <main>
      <p>
        <Link href="/creator/applications">All applications</Link>
      </p>
      <h1>{a.campaign}</h1>
      <p>
        <Status s={a.status} />{" "}
        <span className="mk-sub">
          Version {a.version}
          {a.submitted_at ? ` · sent ${when(a.submitted_at)}` : ""}
        </span>
      </p>
      <Notice sp={sp} />
      {open && <Steps status={a.status} />}
      <OfferPanel client={c.client} ws={c.workspaceId} appId={a.id} />
      {!offerOpen && <p className="mk-banner">{appStatus[a.status]?.detail}</p>}
      {a.feedback && (
        <p className="mk-banner">Feedback from the Brand: “{a.feedback}”</p>
      )}
      {a.collaboration_id && ["selected", "converted"].includes(a.status) && (
        <p>
          <Link
            className="st-btn primary"
            href={`/creator/negotiations/${a.collaboration_id}`}
          >
            Open the negotiation
          </Link>
        </p>
      )}
      {a.can_reapply && (
        <p>
          <Link
            className="st-btn"
            href={`/creator/marketplace/${a.campaign_id}/apply`}
          >
            Apply again
          </Link>
        </p>
      )}
      {a.clarifications.length > 0 && (
        <section className="st-card" aria-labelledby="h-cl">
          <h2 id="h-cl">Questions from the Brand</h2>
          {a.clarifications.map((q) => (
            <div key={q.id} className="ap-version">
              <p>
                <b>{q.question}</b>
              </p>
              {q.answer ? (
                <p>
                  Your answer: {q.answer}{" "}
                  <span className="mk-sub">· {when(q.answered_at)}</span>
                </p>
              ) : (
                <>
                  <p className="mk-sub">Please answer by {day(q.due_at)}.</p>
                  <EntityForm
                    action={act.answerClarification}
                    label="Answer the question"
                    idPrefix={`cl-${q.id.slice(0, 6)}`}
                    submit="Send answer"
                    fields={[
                      { name: "id", label: "", type: "hidden", value: q.id },
                      {
                        name: "answer",
                        label: "Your answer",
                        type: "textarea",
                        max: 1000,
                        rows: 3,
                        required: true,
                      },
                    ]}
                  />
                </>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="st-card" aria-labelledby="h-sh">
        <h2 id="h-sh">What the Brand can see</h2>
        <dl className="mk-terms">
          <dt>Pitch</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {sh.pitch ?? "None (quick apply)"}
          </dd>
          <dt>Account</dt>
          <dd>
            {sh.account
              ? `${sh.account.platform} @${sh.account.handle} · ownership ${sh.account.ownership}${sh.account.followers ? ` · ${sh.account.followers.value.toLocaleString("en-IN")} followers, self-reported on ${sh.account.followers.observed_on}` : ""}`
              : "None"}
          </dd>
          <dt>Portfolio</dt>
          <dd>
            {sh.portfolio.length
              ? sh.portfolio.map((p) => p.title).join(", ")
              : "None"}
          </dd>
          <dt>Media kit</dt>
          <dd>{sh.kit ? (sh.kit.kit?.name ?? "Attached") : "None"}</dd>
          {sh.quote && (
            <>
              <dt>Quote</dt>
              <dd>
                {sh.quote.currency} {sh.quote.amount.toLocaleString("en-IN")}
              </dd>
            </>
          )}
        </dl>
      </section>
      {editable && fv && (
        <details className="st-card">
          <summary>
            <h2 style={{ display: "inline" }}>Edit before review</h2>
          </summary>
          <p className="mk-sub">
            Changes are sent as version {a.version + 1}; the Brand is told and
            the earlier version is kept.
          </p>
          <ApplyForm
            action={act.editApplication}
            campaign={a.campaign_id}
            applicationId={a.id}
            draft={a.content}
            questions={fv.questions}
            accounts={fv.accounts}
            portfolio={fv.portfolio}
            kits={fv.kits.map((k) => ({ id: k.id, title: k.name }))}
            quickApply={fv.rules.quick_apply}
            negotiable={fv.rules.negotiable}
            mode="edit"
          />
        </details>
      )}
      {open && a.status !== "converted" && (
        <details className="st-card">
          <summary>
            <h2 style={{ display: "inline" }}>Withdraw</h2>
          </summary>
          <p>
            The Brand is told.{" "}
            {a.status === "selected"
              ? "You were selected, but nothing is binding yet, so you can still withdraw."
              : ""}
          </p>
          <EntityForm
            action={act.withdrawApplication}
            label="Withdraw the application"
            idPrefix="wd"
            submit="Withdraw application"
            fields={[
              { name: "id", label: "", type: "hidden", value: a.id },
              {
                name: "confirm",
                label: "I want to withdraw this application.",
                type: "checkbox",
              },
            ]}
          />
        </details>
      )}
      <section className="st-card" aria-labelledby="h-hi">
        <h2 id="h-hi">History</h2>
        <Timeline items={a.history} />
        <p className="mk-sub">
          {a.versions.length} version{a.versions.length === 1 ? "" : "s"} kept:{" "}
          {a.versions
            .map((v) => `v${v.version} (${day(v.created_at)})`)
            .join(", ")}
          .
        </p>
      </section>
    </main>
  );
}
export async function InvitationsView({ sp }: { sp: SP }) {
  const { o } = await overview();
  return (
    <main>
      <Hero
        title="Invitations"
        lead="Verified Brands can invite you to their live campaigns. Saying you are interested opens a negotiation; it never commits you."
      />
      <Tabs current="/creator/invitations" />
      <Notice sp={sp} />
      {o.invitations.length === 0 ? (
        <Empty title="No invitations yet">
          <p>
            A complete, published profile makes it easier for verified Brands to
            find you. <Link href="/creator/profile">Open your profile</Link>.
          </p>
        </Empty>
      ) : (
        <table className="ap-table">
          <thead>
            <tr>
              <th scope="col">Campaign</th>
              <th scope="col">Brand</th>
              <th scope="col">Status</th>
              <th scope="col">Expires</th>
            </tr>
          </thead>
          <tbody>
            {o.invitations.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/creator/invitations/${i.id}`}>
                    {i.campaign}
                  </Link>
                </td>
                <td>{i.brand}</td>
                <td>
                  <Status s={i.status} kind="invitation" />
                </td>
                <td>{i.status === "sent" ? day(i.expires_at) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
export async function InvitationView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await apply.invitation(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const i = r.value as unknown as {
    id: string;
    campaign_id: string;
    campaign: string;
    brand: string;
    brand_workspace_id: string;
    message: string;
    status: string;
    expires_at: string;
    created_at: string;
    collaboration_id: string | null;
    decline_reason: string | null;
    blocked: boolean;
    clarifications: {
      question: string;
      answer: string | null;
      created_at: string;
    }[];
  };
  return (
    <main>
      <p>
        <Link href="/creator/invitations">All invitations</Link>
      </p>
      <h1>{i.campaign}</h1>
      <p>
        <Status s={i.status} kind="invitation" />{" "}
        <span className="mk-sub">
          From {i.brand} (business verified) · {day(i.created_at)}
          {i.status === "sent" ? ` · expires ${day(i.expires_at)}` : ""}
        </span>
      </p>
      <Notice sp={sp} />
      <section className="st-card" aria-labelledby="h-msg">
        <h2 id="h-msg">Message from {i.brand}</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{i.message}</p>
        <p>
          <Link href={`/creator/marketplace/${i.campaign_id}`}>
            Read the full campaign and check your eligibility
          </Link>
        </p>
      </section>
      {i.clarifications.length > 0 && (
        <section className="st-card" aria-labelledby="h-q">
          <h2 id="h-q">Your questions</h2>
          {i.clarifications.map((q, n) => (
            <div key={n} className="ap-version">
              <p>
                <b>{q.question}</b>
              </p>
              <p>
                {q.answer ? (
                  `${i.brand}: ${q.answer}`
                ) : (
                  <span className="mk-sub">Waiting for an answer</span>
                )}
              </p>
            </div>
          ))}
        </section>
      )}
      {i.collaboration_id && (
        <p>
          <Link
            className="st-btn primary"
            href={`/creator/negotiations/${i.collaboration_id}`}
          >
            Open the negotiation
          </Link>
        </p>
      )}
      {["sent", "interested"].includes(i.status) && (
        <section className="st-card" aria-labelledby="h-r">
          <h2 id="h-r">Your answer</h2>
          {i.status === "sent" && (
            <EntityForm
              action={act.respondInvitation}
              label="I am interested"
              idPrefix="inv-y"
              submit="I am interested"
              fields={[
                { name: "id", label: "", type: "hidden", value: i.id },
                {
                  name: "action",
                  label: "",
                  type: "hidden",
                  value: "interested",
                },
              ]}
            >
              <p className="mk-sub">
                This opens a negotiation of the terms. It is not an agreement.
              </p>
            </EntityForm>
          )}
          <EntityForm
            action={act.respondInvitation}
            label="Ask a question"
            idPrefix="inv-q"
            submit="Ask the Brand"
            fields={[
              { name: "id", label: "", type: "hidden", value: i.id },
              { name: "action", label: "", type: "hidden", value: "clarify" },
              {
                name: "text",
                label: "Your question",
                type: "textarea",
                max: 1000,
                rows: 2,
                required: true,
              },
            ]}
          />
          <EntityForm
            action={act.respondInvitation}
            label="Decline"
            idPrefix="inv-n"
            submit="Decline invitation"
            fields={[
              { name: "id", label: "", type: "hidden", value: i.id },
              { name: "action", label: "", type: "hidden", value: "decline" },
              {
                name: "text",
                label: "Reason for the Brand",
                type: "textarea",
                max: 500,
                rows: 2,
                hint: "Optional. Helps the Brand send better invitations.",
              },
            ]}
          />
        </section>
      )}
      <section className="st-card" aria-labelledby="h-s">
        <h2 id="h-s">Safety</h2>
        <form action={act.setBlock}>
          <input type="hidden" name="brand" value={i.brand_workspace_id} />
          <input type="hidden" name="on" value={i.blocked ? "no" : "yes"} />
          <input
            type="hidden"
            name="back"
            value={`/creator/invitations/${i.id}`}
          />
          <button className="st-btn">
            {i.blocked ? `Unblock ${i.brand}` : `Block ${i.brand}`}
          </button>
        </form>
        <ReportBox kind="invitation" id={i.id} label="Report this invitation" />
      </section>
    </main>
  );
}
export async function EnquiriesView({ sp }: { sp: SP }) {
  const { o } = await overview();
  return (
    <main>
      <Hero
        title="Enquiries"
        lead="A preliminary question from a verified Brand, for example about your availability. An enquiry is not an invitation and not an offer."
      />
      <Tabs current="/creator/enquiries" />
      <Notice sp={sp} />
      {o.enquiries.length === 0 ? (
        <Empty title="No enquiries">
          <p>
            Verified Brands can send you a short question before inviting you.
          </p>
        </Empty>
      ) : (
        <ul className="st-list">
          {o.enquiries.map((e) => (
            <li key={e.id} className="st-item">
              <Link href={`/creator/enquiries/${e.id}`}>
                {e.brand}
                {e.campaign ? ` · ${e.campaign}` : ""}
              </Link>{" "}
              · <Status s={e.status} kind="invitation" /> · {day(e.created_at)}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
export async function EnquiryView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await apply.enquiry(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const e = r.value as unknown as {
    id: string;
    brand: string;
    brand_workspace_id: string;
    campaign: string | null;
    message: string;
    status: string;
    reply: string | null;
    created_at: string;
    blocked: boolean;
  };
  return (
    <main>
      <p>
        <Link href="/creator/enquiries">All enquiries</Link>
      </p>
      <h1>Enquiry from {e.brand}</h1>
      <p>
        <span className="mk-pill line">Enquiry, not an invitation</span>{" "}
        <Status s={e.status} kind="invitation" />{" "}
        <span className="mk-sub">
          {day(e.created_at)}
          {e.campaign ? ` · about ${e.campaign}` : ""}
        </span>
      </p>
      <Notice sp={sp} />
      <section className="st-card">
        <p style={{ whiteSpace: "pre-wrap" }}>{e.message}</p>
        {e.reply && <p>Your reply: {e.reply}</p>}
      </section>
      {e.status === "sent" && (
        <section className="st-card" aria-labelledby="h-rp">
          <h2 id="h-rp">Reply</h2>
          <EntityForm
            action={act.respondEnquiry}
            label="Reply to the enquiry"
            idPrefix="enq"
            submit="Send reply"
            fields={[
              { name: "id", label: "", type: "hidden", value: e.id },
              {
                name: "action",
                label: "Your answer",
                type: "select",
                options: {
                  interested: "I am interested",
                  declined: "Not for me",
                },
              },
              {
                name: "reply",
                label: "Message",
                type: "textarea",
                max: 1000,
                rows: 3,
              },
            ]}
          />
        </section>
      )}
      <section className="st-card">
        <form action={act.setBlock}>
          <input type="hidden" name="brand" value={e.brand_workspace_id} />
          <input type="hidden" name="on" value={e.blocked ? "no" : "yes"} />
          <input
            type="hidden"
            name="back"
            value={`/creator/enquiries/${e.id}`}
          />
          <button className="st-btn">
            {e.blocked ? `Unblock ${e.brand}` : `Block ${e.brand}`}
          </button>
        </form>
        <ReportBox kind="enquiry" id={e.id} label="Report this enquiry" />
      </section>
    </main>
  );
}
export async function CreatorNegotiationView({
  id,
  sp,
}: {
  id: string;
  sp: SP;
}) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await apply.negotiation(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const n = r.value as unknown as Negotiation;
  return (
    <main>
      <p>
        <Link href="/creator/applications">Applications and invitations</Link>
      </p>
      <h1>Negotiation: {n.campaign}</h1>
      <HandoffLink client={c.client} ws={c.workspaceId} collab={n.id} />
      <NegotiationBody n={n} sp={sp} />
    </main>
  );
}
export async function BlockedView({ sp }: { sp: SP }) {
  const { o } = await overview();
  return (
    <main>
      <Hero
        title="Blocked Brands"
        lead="Blocked Brands cannot send you invitations or enquiries. They are not told that you blocked them."
      />
      <Tabs current="/creator/settings/applications" />
      <Notice sp={sp} />
      {o.blocked.length === 0 ? (
        <p className="mk-sub">You have not blocked any Brand.</p>
      ) : (
        <ul className="st-list">
          {o.blocked.map((b) => (
            <li key={b.id} className="st-item">
              {b.name}{" "}
              <form action={act.setBlock} style={{ display: "inline" }}>
                <input type="hidden" name="brand" value={b.id} />
                <input type="hidden" name="on" value="no" />
                <input
                  type="hidden"
                  name="back"
                  value="/creator/settings/applications"
                />
                <button className="st-btn">Unblock</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="mk-sub">
        Hiding a Brand from your marketplace is separate:{" "}
        <Link href="/creator/marketplace/preferences">
          marketplace preferences
        </Link>
        .
      </p>
    </main>
  );
}
export { one };
