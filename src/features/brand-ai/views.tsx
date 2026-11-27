import Link from "next/link";
import { notFound } from "next/navigation";
import { brandContext } from "@/server/market/service";
import { brandAi, type Draft, type Turn } from "@/server/brand-ai/service";
import { providerConfigured } from "@/server/ai/provider";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import * as act from "./actions";
import { sourceLabels, tasks } from "./rules";
import "./brand-ai.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const uuidRe = /^[0-9a-f-]{36}$/i;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
const W = (w: string): FieldDef => ({
  name: "w",
  label: "",
  type: "hidden",
  value: w,
});
const H = (name: string, value: string | number): FieldDef => ({
  name,
  label: "",
  type: "hidden",
  value,
});
const kindLabel: Record<Draft["kind"], string> = {
  plan_items: "Plan steps",
  brief: "Campaign brief",
  invitation_message: "Invitation message",
  strategy_note: "Strategy note",
  content_ideas: "Content ideas",
};
const applyLabel: Record<Draft["kind"], string> = {
  plan_items: "Add these steps to my plan",
  brief: "Save to the campaign's draft brief",
  invitation_message: "Mark as ready to use",
  strategy_note: "Pin as a strategy note",
  content_ideas: "Add these ideas to Content",
};

function Status() {
  const on = providerConfigured();
  return on ? (
    <p className="ba-status on" role="note">
      <b>Assistant on.</b> Answers are AI suggestions built only from the
      sources you allow. Nothing changes until you approve a draft.
    </p>
  ) : (
    <p className="ba-status off" role="note">
      <b>Assistant offline.</b> No AI provider is configured for AURA yet. You
      can still start conversations, see exactly what would be shared, and write
      and approve drafts yourself. Questions do not use your allowance while
      offline.
    </p>
  );
}
function Usage({ used, allowance }: { used: number; allowance: number }) {
  const pct =
    allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 100;
  return (
    <div className="ba-usage">
      <div className="ba-usage-top">
        <span>Requests this month</span>
        <b>
          {used} <small>of {allowance}</small>
        </b>
      </div>
      <div
        className="ba-bar"
        role="progressbar"
        aria-label="Requests used this month"
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-valuenow={used}
      >
        <span style={{ width: pct + "%" }} />
      </div>
      <p className="st-hint">
        Resets on the 1st. Only answered requests count.
      </p>
    </div>
  );
}

function DraftBody({ d }: { d: Draft }) {
  const c = d.content;
  return (
    <div className="ba-draft-body">
      {d.kind === "plan_items" || d.kind === "content_ideas" ? (
        <>
          <p className="st-hint">
            {d.kind === "plan_items"
              ? `${c.horizon ?? 30}-day plan`
              : "Ideas for your own accounts"}
          </p>
          <ol>
            {(c.items ?? []).map((it, i) => (
              <li key={i}>
                <b>{it.title}</b>
                {it.detail && <span> {it.detail}</span>}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="ba-pre">{c.text}</p>
      )}
      {!!c.assumptions?.length && (
        <div className="ba-flags">
          <h4>Assumptions (not confirmed by your data)</h4>
          <ul>
            {c.assumptions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {!!c.gaps?.length && (
        <div className="ba-flags gap">
          <h4>Missing information</h4>
          <ul>
            {c.gaps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
function DraftCard({
  d,
  w,
  back,
  campaigns,
}: {
  d: Draft;
  w: string;
  back: string;
  campaigns: Record<string, string>;
}) {
  const target = d.target.campaign_id
    ? campaigns[d.target.campaign_id]
    : undefined;
  return (
    <article
      className={"ba-draft " + d.status}
      aria-label={`${kindLabel[d.kind]} draft`}
    >
      <header>
        <span className={"ba-tag " + d.source}>
          {d.source === "ai" ? "AI suggestion" : "Written by your team"}
        </span>
        <h3>{kindLabel[d.kind]}</h3>
        {target && <span className="st-hint">for {target}</span>}
        <span className="st-hint">{when(d.created_at)}</span>
      </header>
      <DraftBody d={d} />
      {d.status === "applied" ? (
        <p className="st-ok">
          Approved {d.applied_at ? when(d.applied_at) : ""}.{" "}
          {d.kind === "plan_items" ? (
            <>
              {(d.content.items ?? []).length} step
              {(d.content.items ?? []).length === 1 ? " is" : "s are"} in your{" "}
              <Link href={`/brand/plan?w=${w}`}>plan</Link>.
            </>
          ) : d.kind === "brief" && d.target.campaign_id ? (
            <>
              Saved to the{" "}
              <Link href={`/brand/campaigns/${d.target.campaign_id}?w=${w}`}>
                campaign&apos;s draft
              </Link>
              . It goes live only when you publish.
            </>
          ) : d.kind === "content_ideas" ? (
            <>
              {(d.content.items ?? []).length} idea
              {(d.content.items ?? []).length === 1 ? " is" : "s are"} in{" "}
              <Link href={`/brand/content/board?w=${w}`}>Content</Link>.
            </>
          ) : d.kind === "invitation_message" ? (
            "Ready to copy into an invitation. The assistant never sends messages."
          ) : (
            "Pinned as a strategy note."
          )}
        </p>
      ) : (
        <div className="ba-draft-actions">
          <EntityForm
            action={act.applyDraft}
            label={`Approve ${kindLabel[d.kind]}`}
            idPrefix={"ap-" + d.id.slice(0, 8)}
            submit={applyLabel[d.kind]}
            fields={[
              W(w),
              H("id", d.id),
              {
                name: "confirm",
                label: "I have reviewed this draft and want to apply it",
                type: "checkbox",
              },
            ]}
          />
          <form action={act.discardDraft}>
            <input type="hidden" name="w" value={w} />
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="back" value={back} />
            <button className="st-btn">Discard</button>
          </form>
        </div>
      )}
    </article>
  );
}

// ───────── Assistant home ─────────
export async function AssistantView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandAi.state(b.client, w);
  if (!r.ok) notFound();
  const s = r.value;
  const campaigns = Object.fromEntries(
    s.campaigns.map((c) => [c.id, c.title || "Untitled campaign"]),
  );
  const open = s.drafts.filter((d) => d.status === "draft");
  return (
    <main className="shell ba-main">
      <header className="ba-head">
        <div>
          <p className="ba-eyebrow">Brand AI Growth Assistant</p>
          <h1>Assistant</h1>
          <p className="st-hint">
            Strategy, plan steps, campaign briefs and results explained, from
            your own business facts. You approve every change.
          </p>
        </div>
        <Link className="st-btn" href={`/brand/assistant/settings?w=${w}`}>
          Settings and memory
        </Link>
      </header>
      <Status />
      {one(sp, "deleted") && (
        <p className="st-ok" role="status">
          Conversation deleted.
        </p>
      )}
      <div className="ba-grid">
        <section className="st-card" aria-labelledby="h-new">
          <h2 id="h-new">Start a conversation</h2>
          <EntityForm
            action={act.startConversation}
            label="Start a conversation"
            idPrefix="ba-new"
            submit="Start"
            fields={[
              W(w),
              {
                name: "task",
                label: "What do you want help with?",
                type: "select",
                options: Object.fromEntries(
                  Object.entries(tasks).map(([k, v]) => [k, v.label]),
                ),
                required: true,
              },
              ...(s.campaigns.length
                ? [
                    {
                      name: "campaign",
                      label: "Campaign",
                      type: "select" as const,
                      options: { "": "Choose a campaign", ...campaigns },
                      showIf: {
                        field: "task",
                        in: [
                          "brief",
                          "results",
                          "invitation",
                          "general",
                          "strategy",
                        ],
                      },
                      hint: "Needed for a brief or results. Optional otherwise.",
                    },
                  ]
                : []),
              {
                name: "title",
                label: "Name",
                max: 120,
                hint: "Helps you find it later.",
              },
            ]}
          />
          <ul className="ba-tasks">
            {Object.entries(tasks).map(([k, v]) => (
              <li key={k}>
                <b>{v.label}.</b> {v.help}
              </li>
            ))}
          </ul>
          {!s.campaigns.length && (
            <p className="st-hint">
              Campaign briefs and results need a campaign.{" "}
              <Link href={`/brand/campaigns?w=${w}`}>Create one</Link>.
            </p>
          )}
        </section>
        <aside className="st-card" aria-labelledby="h-use">
          <h2 id="h-use">Usage</h2>
          <Usage {...s.usage} />
          <h3 className="ba-sub">Shared with the assistant</h3>
          <ul className="ba-chips">
            {s.sources.map((x) => (
              <li key={x}>{sourceLabels[x] ?? x}</li>
            ))}
          </ul>
          <p className="st-hint">
            Memory is {s.memory?.enabled ? "on" : "off"}. Your conversations
            stay in this Brand workspace and are not used to train models.
          </p>
          {!s.verified && (
            <p className="st-hint">
              Your Brand is not verified yet. The assistant can draft, but
              publishing and inviting still need verification.
            </p>
          )}
        </aside>
        <section className="st-card ba-span" aria-labelledby="h-drafts">
          <h2 id="h-drafts">Drafts waiting for you ({open.length})</h2>
          {open.length ? (
            open.map((d) => (
              <DraftCard
                key={d.id}
                d={d}
                w={w}
                back="/brand/assistant"
                campaigns={campaigns}
              />
            ))
          ) : (
            <p className="st-hint">
              No drafts to review. Drafts appear here after you ask, or when you
              write one yourself.
            </p>
          )}
        </section>
        <section className="st-card ba-span" aria-labelledby="h-convs">
          <h2 id="h-convs">Conversations</h2>
          {s.conversations.length ? (
            <ul className="ba-convs">
              {s.conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/brand/assistant/${c.id}?w=${w}`}>
                    {c.title}
                  </Link>
                  <span className="ba-tag">{tasks[c.task].label}</span>
                  {c.campaign_id && campaigns[c.campaign_id] && (
                    <span className="st-hint">{campaigns[c.campaign_id]}</span>
                  )}
                  <span className="st-hint">
                    {c.turns} message{c.turns === 1 ? "" : "s"} ·{" "}
                    {when(c.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hint">No conversations yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

// ───────── One conversation ─────────
function TurnItem({ t }: { t: Turn }) {
  if (t.role === "user")
    return (
      <li className="ba-turn me">
        <span className="ba-who">You</span>
        <p className="ba-pre">{t.body}</p>
        <span className="st-hint">{when(t.at)}</span>
      </li>
    );
  return (
    <li className={"ba-turn ai " + t.status}>
      <span className="ba-who">
        {t.status === "ok" ? "AI suggestion" : "Assistant"}
      </span>
      <p className="ba-pre">{t.body}</p>
      {!!t.context?.sources?.length && (
        <p className="st-hint">
          Based on:{" "}
          {t.context.sources.map((x) => sourceLabels[x] ?? x).join(", ")}
        </p>
      )}
      {!!t.context?.assumptions?.length && (
        <div className="ba-flags">
          <h4>Assumptions</h4>
          <ul>
            {t.context.assumptions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {!!t.context?.gaps?.length && (
        <div className="ba-flags gap">
          <h4>Missing information</h4>
          <ul>
            {t.context.gaps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <span className="st-hint">{when(t.at)}</span>
    </li>
  );
}
export async function ConversationView({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const [r, st] = await Promise.all([
    brandAi.conversation(b.client, w, id),
    brandAi.state(b.client, w),
  ]);
  if (!r.ok || !st.ok) notFound();
  const c = r.value;
  const ctx = await brandAi.context(b.client, w, c.task, c.campaign_id);
  const campaigns = Object.fromEntries(
    st.value.campaigns.map((x) => [x.id, x.title || "Untitled campaign"]),
  );
  const def = tasks[c.task];
  const back = `/brand/assistant/${id}`;
  return (
    <main className="shell ba-main">
      <p>
        <Link href={`/brand/assistant?w=${w}`}>← Assistant</Link>
      </p>
      <header className="ba-head">
        <div>
          <p className="ba-eyebrow">{def.label}</p>
          <h1>{c.title}</h1>
          {c.campaign_id && campaigns[c.campaign_id] && (
            <p className="st-hint">
              Campaign:{" "}
              <Link href={`/brand/campaigns/${c.campaign_id}?w=${w}`}>
                {campaigns[c.campaign_id]}
              </Link>
            </p>
          )}
        </div>
      </header>
      <Status />
      <div className="ba-grid">
        <section className="st-card ba-span" aria-labelledby="h-chat">
          <h2 id="h-chat">Conversation</h2>
          {c.turns.length ? (
            <ol className="ba-turns">
              {c.turns.map((t) => (
                <TurnItem key={t.id} t={t} />
              ))}
            </ol>
          ) : (
            <p className="st-hint">{def.help}</p>
          )}
          <EntityForm
            action={act.askAssistant}
            label="Ask the assistant"
            idPrefix="ba-ask"
            submit="Ask"
            fields={[
              W(w),
              H("conversation", id),
              ...(c.task === "plan"
                ? [
                    {
                      name: "horizon",
                      label: "Plan length",
                      type: "select" as const,
                      options: {
                        "7": "7 days",
                        "30": "30 days",
                        "90": "90 days",
                      },
                      value: "30",
                      required: true,
                    },
                  ]
                : []),
              {
                name: "prompt",
                label: "Your question",
                type: "textarea",
                rows: 3,
                max: 4000,
                required: true,
                hint: "The assistant drafts; it never publishes, invites, selects or pays.",
              },
            ]}
          />
          {ctx.ok && (
            <details className="ba-context">
              <summary>
                What will be shared ({ctx.value.sources.length} sources
                {c.campaign_id ? " and this campaign" : ""})
              </summary>
              <p className="st-hint">
                Only these facts from this Brand workspace are sent, and only
                when a provider is configured. Change the sources in{" "}
                <Link href={`/brand/assistant/settings?w=${w}`}>settings</Link>.
              </p>
              <pre>{JSON.stringify(ctx.value.facts, null, 2)}</pre>
            </details>
          )}
        </section>
        <section className="st-card ba-span" aria-labelledby="h-d">
          <h2 id="h-d">Drafts</h2>
          {c.drafts.filter((d) => d.status !== "discarded").length ? (
            c.drafts
              .filter((d) => d.status !== "discarded")
              .map((d) => (
                <DraftCard
                  key={d.id}
                  d={d}
                  w={w}
                  back={back}
                  campaigns={campaigns}
                />
              ))
          ) : (
            <p className="st-hint">No drafts yet.</p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-man">
          <h2 id="h-man">Write a draft yourself</h2>
          <p className="st-hint">
            Works with or without the assistant. It goes through the same
            approval.
          </p>
          <EntityForm
            action={act.manualDraft}
            label="Write a draft"
            idPrefix="ba-man"
            submit="Save draft"
            fields={[
              W(w),
              H("conversation", id),
              ...(c.campaign_id ? [H("campaign", c.campaign_id)] : []),
              {
                name: "kind",
                label: "Draft type",
                required: true,
                type: "select",
                value: def.draft,
                options: c.campaign_id
                  ? kindLabel
                  : Object.fromEntries(
                      Object.entries(kindLabel).filter(([k]) => k !== "brief"),
                    ),
              },
              {
                name: "horizon",
                label: "Plan length",
                type: "select",
                options: { "7": "7 days", "30": "30 days", "90": "90 days" },
                value: "30",
                required: true,
                showIf: { field: "kind", in: ["plan_items"] },
              },
              {
                name: "text",
                label: "Draft",
                type: "textarea",
                rows: 5,
                max: 8000,
                required: true,
                hint: "For plan steps or content ideas, write one per line.",
              },
            ]}
          />
        </section>
        <section className="st-card" aria-labelledby="h-del">
          <h2 id="h-del">Delete conversation</h2>
          <p className="st-hint">
            Deletes the messages. Drafts you already approved stay where you
            applied them.
          </p>
          <form action={act.deleteConversation}>
            <input type="hidden" name="w" value={w} />
            <input type="hidden" name="id" value={id} />
            <button className="st-btn danger">Delete conversation</button>
          </form>
        </section>
      </div>
    </main>
  );
}

// ───────── Settings ─────────
export async function AssistantSettingsView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const w = b.workspaceId;
  const r = await brandAi.state(b.client, w);
  if (!r.ok) notFound();
  const s = r.value;
  return (
    <main className="shell ba-main">
      <p>
        <Link href={`/brand/assistant?w=${w}`}>← Assistant</Link>
      </p>
      <h1>Assistant settings</h1>
      <Status />
      <div className="ba-grid">
        <section className="st-card" aria-labelledby="h-src">
          <h2 id="h-src">Sources and memory</h2>
          <EntityForm
            action={act.saveSettings}
            label="Assistant settings"
            idPrefix="ba-set"
            submit="Save settings"
            fields={[
              W(w),
              {
                name: "memory",
                label: "Remember our team's preferences",
                type: "checkbox",
                value: !!s.memory?.enabled,
                hint: "Off by default. When on, the note below is shared with every request.",
              },
              {
                name: "preferences",
                label: "Team preferences",
                type: "textarea",
                rows: 4,
                max: 2000,
                value: s.memory?.preferences ?? "",
                hint: "For example: we prefer short-form video and never discount below 10%.",
              },
            ]}
          >
            <fieldset className="br-checks">
              <legend>What the assistant may use</legend>
              <p className="st-hint">
                Only ticked sources from this Brand workspace are shared. A
                campaign is added only when the conversation is about it.
              </p>
              {Object.entries(sourceLabels).map(([k, l]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    name="sources"
                    value={k}
                    defaultChecked={s.sources.includes(k)}
                  />{" "}
                  {l}
                </label>
              ))}
            </fieldset>
          </EntityForm>
        </section>
        <section className="st-card" aria-labelledby="h-mem">
          <h2 id="h-mem">Delete memory</h2>
          <p className="st-hint">
            Removes the saved preferences and turns memory off. Conversations
            are kept until you delete them.
          </p>
          <EntityForm
            action={act.saveSettings}
            label="Delete memory"
            idPrefix="ba-mdel"
            submit="Delete memory"
            fields={[W(w), H("delete", "1")]}
          />
          <h2 className="ba-sub">Allowance</h2>
          <Usage {...s.usage} />
        </section>
      </div>
    </main>
  );
}
