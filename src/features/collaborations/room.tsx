"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  FileText,
  Film,
  Flag,
  Handshake,
  Layers3,
  MessageSquare,
  FolderOpen,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { ShareContent } from "./share-content";
import { Composer, type Action } from "./composer";
import { previewTransition } from "./transition";
import {
  currentAgreement,
  deliverableDone,
  type Collaboration,
  type Command,
  type Deliverable,
  type Execute,
  type Side,
  type Workspace,
} from "./model";
import "./collaborations.css";

const tabs = [
  "Overview",
  "Deliverables",
  "Agreement",
  "Conversation",
  "Changes",
  "Rights",
  "Files",
  "Performance",
  "Activity",
] as const;
type Tab = (typeof tabs)[number];
const eventNames: Record<string, string> = {
  accept: "Agreement accepted",
  submit: "Work submitted for review",
  share: "Content submitted for review",
  review: "Submission reviewed",
  fulfil: "Fulfilment recorded",
  message: "Message sent",
  change: "Change proposed",
  respond: "Change proposal answered",
  dispute: "Concern raised",
  evidence: "Evidence added",
  resolve: "Resolution proposed",
  confirmResolution: "Resolution confirmed",
  performance: "Performance recorded",
  dependency: "Dependency updated",
  complete: "Completion confirmed",
};
export function safeLink(url: string) {
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : undefined;
}
function date(value: string) {
  return value
    ? new Date(
        value.length === 10 ? value + "T12:00:00" : value,
      ).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "Unscheduled";
}
function State({ d }: { d: Deliverable }) {
  const pending = d.submissions.some((s) => s.stage === d.stage && !s.review);
  return (
    <span
      className={
        "co-state " +
        (deliverableDone(d) ? "is-done" : pending ? "is-review" : "")
      }
    >
      {deliverableDone(d) ? <CheckCheck /> : pending ? <Clock3 /> : <Circle />}
      {deliverableDone(d)
        ? "Delivered"
        : pending
          ? "In review"
          : d.review === "Revision requested"
            ? "Revision requested"
            : d.stage}
    </span>
  );
}
function DownloadAgreement({ c }: { c: Collaboration }) {
  function download() {
    const content = c.agreements
      .map((a) =>
        [
          a.title,
          "Version " + a.version,
          a.terms,
          "Compensation\n" + a.compensation,
          "Usage rights\n" + a.rights,
          "Exclusivity\n" + a.exclusivity,
          "AI permissions\n" + a.aiPermission,
          "Acceptance evidence\n" +
            a.acceptances
              .map((x) => x.side + " | " + x.actor + " | " + x.at)
              .join("\n"),
        ].join("\n\n"),
      )
      .join("\n\n----------------\n\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "aura-agreement-" + c.id + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button onClick={download}>
      <Download /> Download agreement
    </button>
  );
}
export function CollaborationRoom({
  initial,
  execute,
  preview = false,
}: {
  initial: Workspace;
  execute?: Execute;
  preview?: boolean;
}) {
  const [workspace, setWorkspace] = useState(initial),
    [tab, setTab] = useState<Tab>("Overview"),
    [selected, setSelected] = useState<string | null>(null),
    [action, setAction] = useState<Action | null>(null),
    [notice, setNotice] = useState(""),
    [message, setMessage] = useState(""),
    [sending, setSending] = useState(false);
  const current = useRef(initial),
    messageRequest = useRef<{ body: string; id: string } | null>(null);
  const c = workspace.collaboration,
    access = workspace.access,
    agreement = currentAgreement(c);
  const focus =
    c.deliverables.find((d) => d.id === selected) || c.deliverables[0];
  const completed = c.deliverables.filter(deliverableDone).length;
  async function run(
    command: Command,
    request: string,
  ): Promise<string | null> {
    try {
      if (preview) {
        const next = {
          ...current.current,
          collaboration: previewTransition(
            current.current.collaboration,
            current.current.access,
            command,
          ),
        };
        current.current = next;
        setWorkspace(next);
        setNotice("Preview updated. Changes last for this session.");
        return null;
      }
      if (!execute) return "Workspace actions are unavailable.";
      const result = await execute(
        command,
        request,
        current.current.collaboration.revision,
      );
      if (result.error) return result.error;
      if (!result.workspace) return "The action could not be saved.";
      current.current = result.workspace;
      setWorkspace(result.workspace);
      setNotice("Saved to the shared workspace.");
      return null;
    } catch (error) {
      return preview && error instanceof Error
        ? error.message
        : "Connection interrupted. Retry when connected.";
    }
  }
  function switchRole(side: Side) {
    const next = {
      ...current.current,
      access: { side, manage: true, review: true },
    };
    current.current = next;
    setWorkspace(next);
  }
  function scenario(value: string) {
    const next = structuredClone(initial);
    if (value === "agreement") {
      next.collaboration.status = "Agreement pending";
      next.collaboration.agreements[0].acceptances = [];
    }
    current.current = next;
    setWorkspace(next);
    setTab(value === "agreement" ? "Agreement" : "Overview");
    setNotice("");
  }
  async function sendMessage() {
    if (!message.trim() || sending) return;
    if (messageRequest.current?.body !== message)
      messageRequest.current = { body: message, id: crypto.randomUUID() };
    setSending(true);
    const problem = await run(
      { type: "message", body: message },
      messageRequest.current.id,
    );
    setSending(false);
    if (problem) setNotice(problem);
    else {
      setMessage("");
      messageRequest.current = null;
    }
  }
  function openDeliverable(d: Deliverable) {
    setSelected(d.id);
    setTab("Deliverables");
  }
  return (
    <div className="co co-room">
      <div className="co-topbar">
        <Link
          href={preview ? "/dev/collaborations" : "/collaborations"}
          className="co-wordmark"
        >
          aura<span>/ collaborations</span>
        </Link>
        <span className="co-private">
          <ShieldCheck size={14} /> Shared with participants
        </span>
        <span className="co-person">
          {access.side === "creator"
            ? c.creator.slice(0, 1)
            : c.brand.slice(0, 1)}
        </span>
      </div>
      {preview && (
        <div className="co-preview">
          <span>
            Development preview · fictional partnership · changes are temporary
          </span>
          <label>
            View as
            <select
              value={access.side}
              onChange={(e) => switchRole(e.target.value as Side)}
            >
              <option value="creator">Creator</option>
              <option value="brand">Brand</option>
            </select>
          </label>
          <label>
            Scenario
            <select
              defaultValue="active"
              onChange={(e) => scenario(e.target.value)}
            >
              <option value="active">Active project</option>
              <option value="agreement">Agreement review</option>
            </select>
          </label>
        </div>
      )}
      <div className="co-workspace">
        <aside className="co-side">
          <Link
            href={preview ? "/dev/collaborations" : "/collaborations"}
            className="co-back"
          >
            <ArrowLeft /> All collaborations
          </Link>
          <div className="co-partner-mark">
            {c.brand.slice(0, 2).toUpperCase()}
          </div>
          <strong>{c.brand}</strong>
          <span className="co-muted">{c.category}</span>
          <nav aria-label="Collaboration sections">
            {tabs.map((t, i) => {
              const Icon = [
                Layers3,
                Film,
                FileText,
                MessageSquare,
                SlidersHorizontal,
                ShieldCheck,
                FolderOpen,
                Sparkles,
                Clock3,
              ][i];
              return (
                <button
                  key={t}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => setTab(t)}
                >
                  <Icon />
                  {t}
                  {t === "Conversation" && c.messages.length > 0 && (
                    <small>{c.messages.length}</small>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="co-side-bottom">
            <span className="co-person">{c.creator.slice(0, 1)}</span>
            <div>
              <strong>{c.creator}</strong>
              <small>Creator partner</small>
            </div>
          </div>
        </aside>
        <div className="co-main">
          <header className="co-project-header">
            <div className="co-breadcrumb">
              {c.brand}
              <ChevronRight size={13} />
              {c.category}
            </div>
            <div className="co-title-row">
              <h1>{c.title}</h1>
              <span className="co-chip">{c.status}</span>
            </div>
            <div className="co-project-meta">
              <span>
                <Handshake size={15} /> {c.creator} × {c.brand}
              </span>
              <span>Agreement v{agreement.version}</span>
              <span>
                {completed} of {c.deliverables.length} delivered
              </span>
            </div>
          </header>
          {!preview && (
            <Link
              className="co-payment-entry"
              href={"/collaborations/" + c.id + "/payments"}
            >
              Payment records <ArrowUpRight size={14} />
            </Link>
          )}
          <p className="co-notice" role="status">
            {notice}
          </p>
          {tab === "Overview" && (
            <>
              <div className="co-overview">
                <section className="co-next">
                  <span className="co-muted">Next in your collaboration</span>
                  <h2>
                    {c.status === "Agreement pending"
                      ? "Make it official."
                      : access.side === "brand"
                        ? "A fresh perspective."
                        : "Bring the brief to life."}
                  </h2>
                  <p>
                    {c.status === "Agreement pending"
                      ? "Review the terms and confirm the same agreement version."
                      : access.side === "brand"
                        ? "Review the exact work submitted and keep the next step clear."
                        : "Your agreed deliverables are ready. Share work when it is ready for review."}
                  </p>
                  <button
                    className="co-primary"
                    onClick={() =>
                      setTab(
                        c.status === "Agreement pending"
                          ? "Agreement"
                          : "Deliverables",
                      )
                    }
                  >
                    {c.status === "Agreement pending"
                      ? "Review agreement"
                      : access.side === "brand"
                        ? "Review deliverables"
                        : "Open deliverables"}
                    <ArrowRight />
                  </button>
                  <div className="co-progress">
                    <span
                      style={{
                        width:
                          (c.deliverables.length
                            ? (completed / c.deliverables.length) * 100
                            : 0) + "%",
                      }}
                    />
                  </div>
                  <small>
                    {completed} complete · {c.deliverables.length - completed}{" "}
                    in progress
                  </small>
                </section>
                <section className="co-brief">
                  <span className="co-muted">The brief</span>
                  <h2>The agreed direction.</h2>
                  <p>{agreement.terms}</p>
                  <button
                    className="co-text-button"
                    onClick={() => setTab("Agreement")}
                  >
                    View the agreement
                    <ArrowUpRight />
                  </button>
                </section>
              </div>
              <section className="co-section">
                <div className="co-section-title">
                  <h2>Your deliverables</h2>
                  <button
                    className="co-text-button"
                    onClick={() => setTab("Deliverables")}
                  >
                    View all
                    <ArrowRight />
                  </button>
                </div>
                <div className="co-delivery-list">
                  {c.deliverables.map((d, i) => (
                    <button
                      key={d.id}
                      className="co-delivery-row"
                      onClick={() => openDeliverable(d)}
                    >
                      <span className={"co-asset co-tone-" + (i % 3)}>
                        <Film />
                      </span>
                      <span className="co-row-title">
                        <strong>{d.title}</strong>
                        <small>{d.format}</small>
                      </span>
                      <span className="co-due">{date(d.due)}</span>
                      <State d={d} />
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </section>
              <section className="co-section">
                <div className="co-section-title">
                  <h2>Dependencies</h2>
                  <span className="co-muted">Updates from both sides</span>
                </div>
                {c.dependencies.length ? (
                  c.dependencies.map((d) => (
                    <div className="co-dependency" key={d.id}>
                      <span className={"co-dot " + (d.done ? "done" : "")} />
                      <div>
                        <strong>{d.title}</strong>
                        <small>
                          {d.side} · due {date(d.due)}
                        </small>
                        <p>{d.note}</p>
                      </div>
                      {d.side === access.side ? (
                        <button
                          onClick={() =>
                            setAction({ type: "dependency", dependency: d })
                          }
                        >
                          Update
                        </button>
                      ) : (
                        <span className="co-chip">
                          {d.done ? "Done" : "Waiting"}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="co-muted">No shared dependencies recorded.</p>
                )}
              </section>
              <section className="co-completion">
                <div>
                  <h3>Close the loop</h3>
                  <p>
                    {c.financialStatus}. Operational completion requires both
                    parties’ confirmation.
                  </p>
                </div>
                <button
                  disabled={!access.manage || c.status !== "Active"}
                  onClick={() => setAction({ type: "complete" })}
                >
                  {c.completion.includes(access.side)
                    ? "Confirmation recorded"
                    : "Confirm completion"}
                </button>
              </section>
            </>
          )}
          {tab === "Deliverables" && (
            <div className="co-review-layout">
              <section className="co-review-list">
                <div className="co-section-title">
                  <h2>Deliverables</h2>
                  <small>{c.deliverables.length}</small>
                </div>
                {c.deliverables.map((d, i) => (
                  <button
                    key={d.id}
                    aria-pressed={focus?.id === d.id}
                    onClick={() => setSelected(d.id)}
                  >
                    <span className={"co-asset co-tone-" + (i % 3)}>
                      <Film />
                    </span>
                    <strong>{d.title}</strong>
                    <small>{d.format}</small>
                    <State d={d} />
                  </button>
                ))}
              </section>
              {focus && (
                <DeliverablePanel
                  key={focus.id}
                  d={focus}
                  c={c}
                  side={access.side}
                  review={access.review}
                  act={setAction}
                  run={run}
                  preview={preview}
                />
              )}
            </div>
          )}
          {tab === "Agreement" && (
            <section className="co-agreement">
              <div className="co-section-title">
                <div>
                  <span className="co-muted">Version {agreement.version}</span>
                  <h2>{agreement.title}</h2>
                </div>
                <DownloadAgreement c={c} />
              </div>
              <div className="co-paper">
                <div className="co-paper-head">
                  <Handshake />
                  <span>
                    {c.creator}
                    <br />
                    &amp; {c.brand}
                  </span>
                  <span className="co-chip">
                    {agreement.acceptances.length === 2
                      ? "Accepted by both parties"
                      : "Awaiting acceptance"}
                  </span>
                </div>
                {[
                  ["Scope of work", agreement.terms],
                  ["Compensation", agreement.compensation],
                  ["Usage rights", agreement.rights],
                  ["Exclusivity", agreement.exclusivity],
                  ["AI-related permissions", agreement.aiPermission],
                ].map(([title, body]) => (
                  <section key={title}>
                    <h3>{title}</h3>
                    <p>{body || "No terms supplied."}</p>
                  </section>
                ))}
                {safeLink(agreement.externalUrl) && (
                  <a
                    href={agreement.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    External signed agreement
                  </a>
                )}
                <div className="co-signatures">
                  {(["creator", "brand"] as const).map((side) => {
                    const acceptance = agreement.acceptances.find(
                      (a) => a.side === side,
                    );
                    return (
                      <div key={side}>
                        <span>{side === "creator" ? c.creator : c.brand}</span>
                        <strong>
                          {acceptance ? (
                            <>
                              <Check /> Accepted {date(acceptance.at)}
                            </>
                          ) : (
                            "Awaiting acceptance"
                          )}
                        </strong>
                        {acceptance && <small>{acceptance.actor}</small>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {c.status === "Agreement pending" && (
                <div className="co-completion">
                  <p>
                    {agreement.templateApproved
                      ? "Review every section before accepting this version."
                      : "Acceptance will open when the agreement template is approved."}
                  </p>
                  <button
                    className="co-primary"
                    disabled={
                      !access.manage ||
                      !agreement.templateApproved ||
                      agreement.acceptances.some((a) => a.side === access.side)
                    }
                    onClick={() =>
                      setAction({ type: "accept", version: agreement.version })
                    }
                  >
                    Accept version {agreement.version}
                  </button>
                </div>
              )}
              <details>
                <summary>Agreement history</summary>
                {c.agreements.map((a) => (
                  <p key={a.version}>
                    Version {a.version} · {a.title} · {a.acceptances.length}{" "}
                    acceptances
                  </p>
                ))}
              </details>
            </section>
          )}
          {tab === "Conversation" && (
            <section className="co-conversation">
              <div className="co-section-title">
                <h2>A shared conversation</h2>
                <span className="co-muted">Project participants</span>
              </div>
              <div className="co-messages">
                {c.messages.map((m) => (
                  <article
                    key={m.id}
                    className={m.side === access.side ? "is-own" : ""}
                  >
                    <div>
                      <span className="co-person">
                        {m.side === "creator"
                          ? c.creator.slice(0, 1)
                          : c.brand.slice(0, 1)}
                      </span>
                      <strong>
                        {m.side === "creator" ? c.creator : c.brand}
                      </strong>
                      <small>{date(m.at)}</small>
                    </div>
                    <p>{m.body}</p>
                  </article>
                ))}
                {!c.messages.length && (
                  <p className="co-muted">
                    Start a conversation about the work.
                  </p>
                )}
              </div>
              <form
                className="co-message-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <label className="sr-only" htmlFor="co-message">
                  Message
                </label>
                <textarea
                  id="co-message"
                  value={message}
                  maxLength={6000}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Keep the conversation moving…"
                  rows={3}
                />
                <button
                  className="co-primary"
                  disabled={sending || !message.trim()}
                  type="submit"
                >
                  <Send />
                  {sending ? "Sending…" : "Send message"}
                </button>
              </form>
            </section>
          )}
          {tab === "Changes" && (
            <>
              <div className="co-section-title">
                <div>
                  <h2>Keep the scope clear.</h2>
                  <p className="co-muted">
                    Record changes and resolve concerns together.
                  </p>
                </div>
                <button
                  className="co-primary"
                  disabled={!access.manage || c.status !== "Active"}
                  onClick={() => setAction({ type: "change" })}
                >
                  Propose change
                </button>
              </div>
              <div className="co-change-list">
                {c.changes.map((ch) => (
                  <article key={ch.id}>
                    <div>
                      <span className="co-chip">{ch.kind}</span>
                      <span className="co-muted">{ch.status}</span>
                    </div>
                    <h3>{ch.title}</h3>
                    <p>{ch.details}</p>
                    {ch.compensation && (
                      <p>Compensation impact · {ch.compensation}</p>
                    )}
                    {ch.date && <p>Proposed date · {date(ch.date)}</p>}
                    {ch.status === "Proposed" &&
                      ch.side !== access.side &&
                      access.manage && (
                        <footer>
                          <button
                            onClick={() =>
                              setAction({
                                type: "respond",
                                change: ch,
                                accept: false,
                              })
                            }
                          >
                            Decline
                          </button>
                          <button
                            disabled={
                              ch.kind === "Amendment" || ch.kind === "Renewal"
                            }
                            onClick={() =>
                              setAction({
                                type: "respond",
                                change: ch,
                                accept: true,
                              })
                            }
                          >
                            Review acceptance
                          </button>
                          {["Amendment", "Renewal"].includes(ch.kind) && (
                            <small>
                              Legal template review required before acceptance.
                            </small>
                          )}
                        </footer>
                      )}
                  </article>
                ))}
                {!c.changes.length && (
                  <div className="co-empty compact">
                    <SlidersHorizontal />
                    <h3>Everyone on the same page.</h3>
                    <p>
                      Proposed changes will appear here with their timeline and
                      compensation impact.
                    </p>
                  </div>
                )}
              </div>
              <section className="co-section">
                <div className="co-section-title">
                  <h2>Concerns &amp; resolutions</h2>
                  <button
                    disabled={!access.manage}
                    onClick={() => setAction({ type: "dispute" })}
                  >
                    <Flag /> Raise concern
                  </button>
                </div>
                {c.disputes.map((d) => (
                  <article className="co-concern" key={d.id}>
                    <span className="co-chip">{d.status}</span>
                    <h3>{d.title}</h3>
                    <p>{d.details}</p>
                    {d.amount && <p>Disputed amount · {d.amount}</p>}
                    {d.evidence.map((e, i) => (
                      <blockquote key={i}>
                        {e.note}
                        {safeLink(e.url) && (
                          <a href={e.url} target="_blank" rel="noreferrer">
                            Open evidence ↗
                          </a>
                        )}
                        <small>
                          {e.side} · {date(e.at)}
                        </small>
                      </blockquote>
                    ))}
                    {d.resolution && (
                      <blockquote>
                        Proposed resolution<p>{d.resolution.note}</p>
                      </blockquote>
                    )}
                    <footer>
                      {d.status !== "Resolved" && (
                        <button
                          onClick={() =>
                            setAction({ type: "evidence", dispute: d })
                          }
                        >
                          Add evidence or response
                        </button>
                      )}
                      {access.manage && d.status === "Open" && (
                        <button
                          onClick={() =>
                            setAction({ type: "resolve", dispute: d })
                          }
                        >
                          Propose resolution
                        </button>
                      )}
                      {access.manage &&
                        d.status === "Resolution proposed" &&
                        d.resolution?.side !== access.side && (
                          <button
                            onClick={() =>
                              setAction({
                                type: "confirmResolution",
                                dispute: d,
                              })
                            }
                          >
                            Review resolution
                          </button>
                        )}
                    </footer>
                  </article>
                ))}
                {!c.disputes.length && (
                  <p className="co-muted">No concerns raised.</p>
                )}
              </section>
            </>
          )}
          {tab === "Rights" && (
            <section className="co-rights">
              <div className="co-section-title">
                <div>
                  <h2>Rights stay explicit.</h2>
                  <p className="co-muted">
                    Terms from agreement version {agreement.version}.
                  </p>
                </div>
                <ShieldCheck size={30} />
              </div>
              {[
                ["Usage & ownership", agreement.rights],
                ["Exclusivity", agreement.exclusivity],
                ["AI, voice & likeness", agreement.aiPermission],
              ].map(([title, body]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{body || "No permission recorded."}</p>
                </article>
              ))}
              <button
                disabled={!access.manage || c.status !== "Active"}
                onClick={() => setAction({ type: "change", kind: "Renewal" })}
              >
                Propose a renewal
              </button>
            </section>
          )}
          {tab === "Files" && (
            <section>
              <div className="co-section-title">
                <h2>Shared work</h2>
                <span className="co-muted">
                  Only explicitly submitted links
                </span>
              </div>
              {c.deliverables.flatMap((d) =>
                d.submissions.map((s) => (
                  <a
                    className="co-file-row"
                    key={s.id}
                    href={safeLink(s.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText />
                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        Version {s.number} · {s.stage} · {date(s.at)}
                      </small>
                    </span>
                    <ArrowUpRight />
                  </a>
                )),
              )}
              {!c.deliverables.some((d) => d.submissions.length) && (
                <div className="co-empty">
                  <FolderOpen />
                  <h3>A place for the work you share.</h3>
                  <p>
                    Submitted links will appear here with their stage and
                    version.
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "Performance" && (
            <section>
              <div className="co-section-title">
                <div>
                  <h2>Results, with context.</h2>
                  <p className="co-muted">
                    Record agreed metrics alongside their period and evidence.
                  </p>
                </div>
                <button
                  className="co-primary"
                  disabled={c.status !== "Active"}
                  onClick={() => setAction({ type: "performance" })}
                >
                  Record result
                </button>
              </div>
              {c.performance.length ? (
                <div className="co-result-list">
                  {c.performance.map((p) => (
                    <article key={p.id}>
                      <span>{p.metric}</span>
                      <strong>{p.value}</strong>
                      <span>{p.period}</span>
                      <a
                        href={safeLink(p.source)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source
                        <ArrowUpRight size={14} />
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="co-empty">
                  <Layers3 />
                  <h3>Ready when the results are.</h3>
                  <p>
                    Add observations after fulfilment using the agreed reporting
                    period.
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "Activity" && (
            <section>
              <div className="co-section-title">
                <h2>The project record</h2>
                <span className="co-muted">Version {c.revision}</span>
              </div>
              <ol className="co-timeline">
                {c.activity.map((e) => (
                  <li key={e.id}>
                    <span className="co-timeline-dot" />
                    <div>
                      <strong>{eventNames[e.action] || e.action}</strong>
                      <p>
                        {e.side} · {date(e.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
      {action && (
        <Composer
          action={action}
          collaboration={c}
          close={() => setAction(null)}
          run={run}
        />
      )}
    </div>
  );
}
function DeliverablePanel({
  d,
  c,
  side,
  review,
  act,
  run,
  preview,
}: {
  run: (c: Command, r: string) => Promise<string | null>;
  preview: boolean;
  d: Deliverable;
  c: Collaboration;
  side: Side;
  review: boolean;
  act: (a: Action) => void;
}) {
  const [version, setVersion] = useState<string | null>(null);
  const latest = d.submissions.at(-1),
    shown = d.submissions.find((s) => s.id === version) || latest;
  const waiting = latest && latest.stage === d.stage && !latest.review;
  return (
    <section className="co-deliverable-detail">
      <div className="co-section-title">
        <span className="co-muted">{d.format}</span>
        <State d={d} />
      </div>
      <h2>{d.title}</h2>
      <p>{d.description}</p>
      <div className="co-stage-track">
        {d.stages.map((s, i) => (
          <span
            key={s}
            className={i <= d.stages.indexOf(d.stage) ? "is-reached" : ""}
          >
            {i < d.stages.indexOf(d.stage) ? (
              <Check size={13} />
            ) : (
              <Circle size={11} />
            )}{" "}
            {s}
          </span>
        ))}
      </div>
      <div className="co-stage-meta">
        <span>
          Agreed deadline <strong>{date(d.due)}</strong>
        </span>
        <button
          className="co-text-button"
          onClick={() => act({ type: "change", kind: "Reschedule" })}
        >
          Request change
        </button>
      </div>
      <div className="co-preview-frame">
        <span>
          <Film size={44} />
          <strong>
            {shown ? "Submission " + shown.number : "Your next handoff"}
          </strong>
          <small>
            {shown
              ? shown.stage + " · " + date(shown.at)
              : "Share work when it is ready for review."}
          </small>
        </span>
        {shown && safeLink(shown.url) && (
          <a href={shown.url} target="_blank" rel="noreferrer">
            Open submitted work
            <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      {shown && (
        <>
          <div className="co-section-title">
            <h3>Submission notes</h3>
            <select
              aria-label="Submission version"
              value={shown.id}
              onChange={(e) => setVersion(e.target.value)}
            >
              {d.submissions.map((s) => (
                <option value={s.id} key={s.id}>
                  Version {s.number} · {s.stage}
                </option>
              ))}
            </select>
          </div>
          <p>{shown.note}</p>
          {shown.review && (
            <div className="co-review-note">
              <strong>{shown.review.decision}</strong>
              <p>{shown.review.note}</p>
              <small>
                {shown.review.scope} · {date(shown.review.at)}
              </small>
            </div>
          )}
        </>
      )}
      <div className="co-detail-actions">
        {side === "creator" && c.status === "Active" && !deliverableDone(d) && (
          <button
            className="co-primary"
            disabled={!!waiting || d.review === "Approved"}
            onClick={() => act({ type: "submit", deliverable: d })}
          >
            Submit {d.stage.toLowerCase()}
            <ArrowRight />
          </button>
        )}
        {side === "brand" && review && waiting && c.status === "Active" && (
          <button
            className="co-primary"
            onClick={() => act({ type: "review", deliverable: d })}
          >
            Review latest submission
            <ArrowRight />
          </button>
        )}
        {side === "creator" &&
          d.review === "Approved" &&
          d.stage === d.stages.at(-1) &&
          c.status === "Active" && (
            <button onClick={() => act({ type: "fulfil", deliverable: d })}>
              {d.fulfilment
                ? "Update fulfilment evidence"
                : "Record fulfilment"}
            </button>
          )}
      </div>
      {!preview &&
        side === "creator" &&
        c.status === "Active" &&
        !waiting &&
        d.review !== "Approved" && (
          <ShareContent collaboration={c.id} deliverable={d} run={run} />
        )}
      {d.fulfilment && (
        <div className="co-fulfilment">
          <CheckCheck />
          <div>
            <strong>Fulfilment recorded {date(d.fulfilment.date)}</strong>
            <p>{d.fulfilment.note}</p>
            <a
              href={safeLink(d.fulfilment.url)}
              target="_blank"
              rel="noreferrer"
            >
              Open evidence ↗
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
