import Link from "next/link";
import { notFound } from "next/navigation";
import { brandContext, market } from "@/server/market/service";
import { brand as brandApi } from "@/server/brand/service";
import { campaigns } from "@/server/campaigns/service";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import { Banner, errorText, fields } from "@/features/marketplace/brand";
import * as mkt from "@/features/marketplace/actions";
import {
  categories,
  categoryHelp,
  changeLabels,
  compensationParts,
  deliverableText,
  positionsText,
  rightsText,
  statuses,
  visibilities,
  type Category,
  type Compensation,
  type Deliverable,
  type Rights,
} from "@/features/marketplace/rules";
import type { BrandCampaign } from "@/features/marketplace/types";
import * as act from "./actions";
import {
  objectives,
  readiness,
  rolloutLabel,
  stepFields,
  steps,
  suggestedBrief,
  type OverviewItem,
  type Rollout,
  type StepKey,
} from "./rules";
import { CampaignTabs } from "./tabs";
import { DuplicateButton } from "./duplicate";
import "./campaigns.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const uuidRe = /^[0-9a-f-]{36}$/i;
const day = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
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

function Checks({
  name,
  legend,
  options,
  selected,
  hint,
}: {
  name: string;
  legend: string;
  options: Record<string, string>;
  selected: string[];
  hint?: string;
}) {
  return (
    <fieldset className="cp-checks">
      <legend>{legend}</legend>
      {hint && <p className="st-hint">{hint}</p>}
      {Object.keys(options).length === 0 ? (
        <p className="st-hint">None yet.</p>
      ) : (
        Object.entries(options).map(([k, l]) => (
          <label key={k}>
            <input
              type="checkbox"
              name={name}
              value={k}
              defaultChecked={selected.includes(k)}
            />{" "}
            {l}
          </label>
        ))
      )}
    </fieldset>
  );
}

// ───────── Campaign list and management ─────────
const filters: [string, string][] = [
  ["active", "Active"],
  ["draft", "Drafts"],
  ["published", "Live"],
  ["in_review", "In review"],
  ["paused", "Paused"],
  ["closed", "Closed"],
  ["archived", "Archived"],
];
export async function CampaignsHomeView({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const r = await campaigns.overview(b.client, b.workspaceId);
  if (!r.ok) throw new Error("campaigns:" + r.error);
  const { rollout, campaigns: all } = r.value;
  const f = one(sp, "filter") ?? "active";
  const list = all.filter((c) =>
    f === "archived"
      ? c.archived
      : !c.archived &&
        (f === "active" ? !["closed"].includes(c.status) : c.status === f),
  );
  const live = all.filter((c) => c.status === "published");
  const totals = {
    live: live.length,
    apps: all.reduce((n, c) => n + c.applications, 0),
    fresh: all.reduce((n, c) => n + c.new_applications, 0),
    open: live.reduce(
      (n, c) =>
        n + (c.positions !== null ? Math.max(c.positions - c.selected, 0) : 0),
      0,
    ),
  };
  const catOptions = Object.fromEntries(
    Object.entries(categories).map(([k, l]) => [
      k,
      rollout[k] === "live" ? l : `${l} (draft only, opens later)`,
    ]),
  );
  return (
    <main className="shell cp-main">
      <header className="cp-hero">
        <p className="cp-eyebrow">Campaigns · {b.name}</p>
        <h1>Your campaigns</h1>
        <p>
          Plan, write and run campaigns with honest, complete terms. Creators
          see exactly what you publish, and every material change is versioned
          and shown to them.
        </p>
      </header>
      <Banner verification={r.value.verified ? "verified" : b.verification} />
      {one(sp, "notice") && (
        <p role="status" className="st-error">
          {one(sp, "notice") === "archive"
            ? "Close the campaign before archiving it."
            : "We could not do that. Please try again."}
        </p>
      )}
      <div className="cp-stats">
        <div className="cp-stat">
          <b>{totals.live}</b>live
        </div>
        <div className="cp-stat">
          <b>{totals.apps}</b>applications
          {totals.fresh ? <small> · {totals.fresh} new</small> : null}
        </div>
        <div className="cp-stat">
          <b>{totals.open}</b>open places
        </div>
        <div className="cp-stat">
          <b>{all.filter((c) => c.status === "draft" && !c.archived).length}</b>
          drafts
        </div>
      </div>
      <div className="cp-cols">
        <section aria-labelledby="h-list">
          <h2 id="h-list" className="sr-only">
            Campaign list
          </h2>
          <nav aria-label="Filter campaigns" className="cp-filters">
            {filters.map(([k, l]) => (
              <Link
                key={k}
                href={`/brand/campaigns?w=${b.workspaceId}&filter=${k}`}
                aria-current={f === k ? "page" : undefined}
              >
                {l}{" "}
                <small>
                  {k === "archived"
                    ? all.filter((c) => c.archived).length
                    : all.filter(
                        (c) =>
                          !c.archived &&
                          (k === "active"
                            ? c.status !== "closed"
                            : c.status === k),
                      ).length}
                </small>
              </Link>
            ))}
          </nav>
          {list.length === 0 ? (
            <div className="cp-empty">
              <h3>{all.length ? "Nothing here" : "No campaigns yet"}</h3>
              <p>
                {all.length
                  ? "Try another filter."
                  : "Start with a small pilot: one product, a clear deliverable and honest terms."}
              </p>
            </div>
          ) : (
            <ul className="cp-list">
              {list.map((c) => (
                <CampaignRow
                  key={c.id}
                  c={c}
                  w={b.workspaceId}
                  rollout={rollout}
                />
              ))}
            </ul>
          )}
        </section>
        <aside className="st-card cp-new" aria-labelledby="new-h">
          <h2 id="new-h">Start a campaign</h2>
          <EntityForm
            action={mkt.createCampaign}
            label="Start a campaign"
            idPrefix="nc"
            submit="Create draft"
            fields={[
              W(b.workspaceId),
              {
                name: "category",
                label: "Type",
                type: "select",
                options: catOptions,
                value: "paid",
                required: true,
                hint: Object.entries(categoryHelp)
                  .filter(([k]) => rollout[k] === "live")
                  .map(([k, v]) => `${categories[k as Category]}: ${v}`)
                  .join(" "),
              },
              {
                name: "title",
                label: "Working title",
                max: 120,
                required: true,
              },
            ]}
          />
          <p className="st-hint">
            Paid influencer, UGC and barter campaigns can be published now.
            Events and ambassador programmes open next; affiliate once
            attribution is ready. You can draft any type today.
          </p>
        </aside>
      </div>
    </main>
  );
}
function CampaignRow({
  c,
  w,
  rollout,
}: {
  c: OverviewItem;
  w: string;
  rollout: Rollout;
}) {
  const open =
    c.positions !== null ? Math.max(c.positions - c.selected, 0) : null;
  return (
    <li className="cp-row">
      <div className="cp-row-main">
        <p className="cp-row-tags">
          <span className="mk-pill" data-cat={c.category}>
            {categories[c.category as Category]}
          </span>
          <span className="cp-status" data-s={c.status}>
            {statuses[c.status as keyof typeof statuses]}
          </span>
          {!c.live_type && (
            <span className="cp-pill warn">
              {rolloutLabel(rollout, c.category)}
            </span>
          )}
          {c.unpublished_changes && (
            <span className="cp-pill">Unpublished changes</span>
          )}
        </p>
        <h3>
          <Link href={`/brand/campaigns/${c.id}?w=${w}`}>{c.title}</Link>
        </h3>
        <p className="st-hint">
          {visibilities[c.visibility as keyof typeof visibilities]}
          {c.closes_at ? ` · closes ${day(c.closes_at)}` : ""}
          {c.objective
            ? ` · ${objectives[c.objective as keyof typeof objectives]}`
            : ""}
          {c.owner ? ` · owner ${c.owner}` : ""}
        </p>
        {c.next_milestone && (
          <p className="cp-next">
            Next: {c.next_milestone.label}
            {c.next_milestone.due_on
              ? ` · ${day(c.next_milestone.due_on)}`
              : ""}
          </p>
        )}
      </div>
      <dl className="cp-nums">
        <div>
          <dt>Applications</dt>
          <dd>
            {c.applications}
            {c.new_applications ? (
              <small> ({c.new_applications} new)</small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Selected</dt>
          <dd>{c.selected}</dd>
        </div>
        <div>
          <dt>Open places</dt>
          <dd>{open === null ? "—" : open}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{c.saved}</dd>
        </div>
      </dl>
      <div className="cp-row-actions">
        <Link
          className="st-btn"
          href={`/brand/campaigns/${c.id}/build?step=${c.status === "draft" ? "objective" : "review"}&w=${w}`}
        >
          {c.status === "draft" ? "Continue building" : "Builder"}
        </Link>
        <Link
          className="st-btn"
          href={`/brand/campaigns/${c.id}/applications?w=${w}`}
        >
          Applications
        </Link>
        <DuplicateButton id={c.id} w={w} />
        {(c.status === "draft" || c.status === "closed") && (
          <form action={act.archive}>
            <input type="hidden" name="w" value={w} />
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="on" value={c.archived ? "no" : "yes"} />
            <button className="st-btn">
              {c.archived ? "Restore" : "Archive"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

async function load(id: string, sp: SP) {
  if (!uuidRe.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const [r, p, ro] = await Promise.all([
    market.brandCampaign(b.client, b.workspaceId, id),
    campaigns.plan(b.client, b.workspaceId, id),
    campaigns.rollout(b.client),
  ]);
  if (!r.ok || !p.ok) notFound();
  return {
    b,
    c: r.value as BrandCampaign,
    p: p.value,
    rollout: (ro.ok ? ro.value : {}) as Rollout,
  };
}

/** Converts the M10 editor fields into a step: this step's fields stay visible, all others are carried as hidden values. */
function stepForm(
  c: BrandCampaign,
  w: string,
  step: keyof typeof stepFields,
): FieldDef[] {
  const keep = new Set(stepFields[step]);
  return fields(c, w).map((f) => {
    if (f.type === "hidden" || keep.has(f.name)) return f;
    const value =
      f.type === "checkbox"
        ? f.value
          ? "on"
          : ""
        : f.value === null || f.value === undefined
          ? ""
          : String(f.value);
    return { name: f.name, label: "", type: "hidden" as const, value };
  });
}

// ───────── Builder (R3) ─────────
export async function BuilderView({ id, sp }: { id: string; sp: SP }) {
  const { b, c, p, rollout } = await load(id, sp);
  const w = b.workspaceId;
  const step = (steps.find((s) => s.key === one(sp, "step"))?.key ??
    (c.status === "draft" ? "objective" : "review")) as StepKey;
  const idx = steps.findIndex((s) => s.key === step);
  const d = c.draft as Record<string, unknown>;
  const title = String(d.title ?? "Campaign");
  const plan = p.plan;
  let body: React.ReactNode = null;
  if (step === "objective") {
    body = (
      <EntityForm
        action={act.savePlan}
        label="Objective and audience"
        idPrefix="bo"
        submit="Save and continue"
        fields={[
          W(w),
          H("id", c.id),
          {
            name: "objective",
            label: "Objective",
            type: "select",
            options: { "": "Choose…", ...objectives },
            value: plan?.objective ?? "",
          },
          {
            name: "kpi_metric",
            label: "How you will measure it",
            max: 80,
            value: plan?.kpi_metric,
            hint: "For example: usable videos, profile visits, sign-ups.",
          },
          {
            name: "kpi_target",
            label: "Target",
            type: "number",
            min: 1,
            value: plan?.kpi_target,
          },
          {
            name: "owner_user",
            label: "Campaign owner",
            type: "select",
            options: {
              "": "No owner yet",
              ...Object.fromEntries(
                p.team.map((m) => [m.id, `${m.name} (${m.role})`]),
              ),
            },
            value: plan?.owner_user ?? "",
          },
          {
            name: "milestones",
            label: "Milestones, one per line",
            type: "lines",
            rows: 4,
            value: plan?.milestones
              .map((m) => `${m.due_on ? m.due_on + " " : ""}${m.label}`)
              .join("\n"),
            hint: "Start a line with a date (YYYY-MM-DD) to set a due date, for example: 2026-12-15 First drafts due",
          },
          {
            name: "notes",
            label: "Private notes",
            type: "textarea",
            rows: 3,
            max: 2000,
            value: plan?.notes,
            hint: "Only your team sees the plan. Creators never see it.",
          },
        ]}
      >
        <Checks
          name="segment_ids"
          legend="Target audiences"
          options={Object.fromEntries(
            p.segments.map((s) => [
              s.id,
              `${s.name}${s.basis === "hypothesis" ? " (hypothesis)" : ""}`,
            ]),
          )}
          selected={plan?.segment_ids ?? []}
          hint={
            p.segments.length
              ? undefined
              : "Add customer groups in your business profile to pick them here."
          }
        />
        <Checks
          name="product_ids"
          legend="Products to feature"
          options={Object.fromEntries(p.products.map((x) => [x.id, x.name]))}
          selected={plan?.product_ids ?? []}
        />
      </EntityForm>
    );
  } else if (step === "review") {
    const checks = readiness(c, rollout, errorText, p.selected);
    const ready = checks.every((x) => x.ok);
    body = (
      <div className="cp-review">
        <section aria-labelledby="h-ready">
          <h3 id="h-ready">Ready to publish?</h3>
          <ul className="cp-ready">
            {checks.map((x) => (
              <li key={x.key} className={x.ok ? "ok" : "no"}>
                <span aria-hidden>{x.ok ? "✓" : "!"}</span>{" "}
                {x.step && !x.ok ? (
                  <Link
                    href={`/brand/campaigns/${c.id}/build?step=${x.step}&w=${w}`}
                  >
                    {x.text}
                  </Link>
                ) : (
                  x.text
                )}
                {!x.ok && !x.step && x.key === "verified" ? (
                  <>
                    {" "}
                    · <Link href="/brand/verification">Verify</Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {c.status !== "closed" &&
            c.status !== "removed" &&
            (c.status !== "published" ||
              c.draft_version > (c.published_version ?? 0)) && (
              <form action={act.publishFromBuilder}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="w" value={w} />
                <button className="st-btn primary" disabled={!ready}>
                  {c.published_version ? "Publish changes" : "Publish campaign"}
                </button>
                {c.published_version ? (
                  <p className="st-hint">
                    Material changes are versioned and Creators who saved,
                    applied or are negotiating are told. Agreed proposals do not
                    change.
                  </p>
                ) : (
                  <p className="st-hint">
                    A first campaign is checked by a reviewer before it goes
                    live.
                  </p>
                )}
              </form>
            )}
        </section>
        <section aria-labelledby="h-prev">
          <h3 id="h-prev">What Creators will see</h3>
          <Preview c={c} />
        </section>
      </div>
    );
  } else {
    const isBrief = step === "brief";
    const brand =
      isBrief && !String(d.brief ?? "").trim()
        ? await brandApi.state(b.client, w)
        : null;
    const s = brand?.ok ? brand.value : null;
    const suggestion = s?.profile
      ? suggestedBrief({
          brand: s.profile.public_name,
          objective: plan?.objective ? objectives[plan.objective] : null,
          products: s.products.filter((x) =>
            (plan?.product_ids ?? []).includes(x.id),
          ),
          audiences: s.segments
            .filter((x) => (plan?.segment_ids ?? []).includes(x.id))
            .map((x) => x.name),
          dos: s.guideline?.dos,
          donts: s.guideline?.donts,
          disclosures: s.guideline?.disclosures,
          tone: s.guideline?.tone,
        })
      : "";
    const fs = stepForm(c, w, step).map((f) =>
      f.name === "brief" && suggestion
        ? {
            ...f,
            value: suggestion,
            hint: "Prefilled from your business profile and plan. Edit it freely; nothing is sent until you publish.",
          }
        : f,
    );
    body = (
      <EntityForm
        action={act.saveStep}
        label={steps[idx].label}
        idPrefix={`b${step.slice(0, 3)}`}
        submit="Save and continue"
        fields={[...fs, H("step", step)]}
      />
    );
  }
  return (
    <main className="shell cp-main">
      <CampaignTabs id={c.id} w={w} current="build" />
      <header className="cp-head">
        <p className="cp-eyebrow">
          <span className="mk-pill" data-cat={c.category}>
            {categories[c.category]}
          </span>{" "}
          {statuses[c.status]}
          {rollout[c.category] !== "live"
            ? ` · ${rolloutLabel(rollout, c.category)}`
            : ""}
        </p>
        <h1>{title}</h1>
      </header>
      {one(sp, "saved") && (
        <p role="status" className="st-ok">
          Saved.
        </p>
      )}
      {one(sp, "copied") && (
        <p role="status" className="st-ok">
          Copied as a new private draft. Change what you need, then publish.
        </p>
      )}
      <div className="cp-builder">
        <ol className="cp-steps" aria-label="Builder steps">
          {steps.map((s, i) => (
            <li
              key={s.key}
              aria-current={s.key === step ? "step" : undefined}
              className={i < idx ? "done" : ""}
            >
              <Link
                href={`/brand/campaigns/${c.id}/build?step=${s.key}&w=${w}`}
              >
                <span className="cp-num">{i < idx ? "✓" : i + 1}</span>
                <span>{s.label}</span>
              </Link>
            </li>
          ))}
        </ol>
        <section className="st-card cp-step" aria-labelledby="h-step">
          <h2 id="h-step">{steps[idx].label}</h2>
          <p className="st-hint">{steps[idx].lead}</p>
          {body}
          {idx > 0 && (
            <p>
              <Link
                href={`/brand/campaigns/${c.id}/build?step=${steps[idx - 1].key}&w=${w}`}
              >
                Back to {steps[idx - 1].label.toLowerCase()}
              </Link>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

// ───────── Preview: the Creator-facing view of the current draft ─────────
function Preview({ c }: { c: BrandCampaign }) {
  const d = c.draft as Record<string, unknown> & {
    compensation?: Compensation;
    rights?: Rights;
    deliverables?: Deliverable[];
    requirements?: Record<string, unknown>;
    preferred?: Record<string, unknown>;
  };
  const req = d.requirements ?? {};
  const pref = d.preferred ?? {};
  const list = (x: unknown) =>
    Array.isArray(x) ? (x as string[]).join(", ") : "";
  return (
    <article className="cp-preview" aria-label="Creator preview">
      <p>
        <span className="mk-pill" data-cat={c.category}>
          {categories[c.category]}
        </span>{" "}
        <span className="cp-pill">{visibilities[c.visibility]}</span>
      </p>
      <h3>{String(d.title ?? "Untitled")}</h3>
      {d.summary ? (
        <p className="cp-sum">{String(d.summary)}</p>
      ) : (
        <p className="st-hint">No summary yet.</p>
      )}
      <dl className="mk-terms">
        <dt>What you receive</dt>
        <dd>
          {compensationParts(d.compensation).length
            ? compensationParts(d.compensation).map((x) => (
                <span key={x.kind} className="cp-line">
                  {x.kind}: {x.text}
                  {x.guaranteed ? "" : " (not guaranteed money)"}
                </span>
              ))
            : "Not set"}
        </dd>
        <dt>Deliverables</dt>
        <dd>
          {d.deliverables?.length
            ? d.deliverables.map((x, i) => (
                <span key={i} className="cp-line">
                  {deliverableText(x)}
                </span>
              ))
            : "Not set"}
        </dd>
        <dt>Usage rights</dt>
        <dd>{rightsText(d.rights)}</dd>
        <dt>Positions</dt>
        <dd>{positionsText(d.positions as number | null | undefined)}</dd>
        <dt>Applications close</dt>
        <dd>{day(d.closes_at as string | null) || "Not set"}</dd>
        <dt>Must have</dt>
        <dd>
          {[
            req.min_followers
              ? `${req.min_followers}+ followers on one account`
              : "",
            list(req.platforms),
            list(req.countries),
            req.verified_ownership ? "verified account ownership" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "No mandatory requirements"}
        </dd>
        <dt>Nice to have</dt>
        <dd>
          {[
            list(pref.niches),
            list(pref.languages),
            pref.beginner_friendly ? "beginners welcome" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "No preferences"}
        </dd>
      </dl>
      {d.brief ? (
        <>
          <h4>Brief</h4>
          <p className="cp-brief">{String(d.brief)}</p>
        </>
      ) : null}
    </article>
  );
}
export async function PreviewView({ id, sp }: { id: string; sp: SP }) {
  const { b, c } = await load(id, sp);
  return (
    <main className="shell cp-main">
      <CampaignTabs id={c.id} w={b.workspaceId} current="preview" />
      <header className="cp-head">
        <h1>Preview</h1>
        <p className="st-hint">
          The current draft, as a Creator will see it after you publish
          {c.published_version && c.draft_version > c.published_version
            ? ". The live version is unchanged until you publish these changes."
            : "."}{" "}
          Your private plan is never shown.
        </p>
      </header>
      <div className="cp-preview-wrap">
        <Preview c={c} />
      </div>
    </main>
  );
}

// ───────── Changes: versions and who was told (R8, R10) ─────────
export async function ChangesView({ id, sp }: { id: string; sp: SP }) {
  const { b, c, p } = await load(id, sp);
  const notified = Object.fromEntries(p.amendments.map((a) => [a.version, a]));
  return (
    <main className="shell cp-main">
      <CampaignTabs id={c.id} w={b.workspaceId} current="changes" />
      <header className="cp-head">
        <h1>Changes</h1>
        <p className="st-hint">
          Every published version is kept. Material changes are announced to
          Creators who saved, applied to or are negotiating this campaign.
          Proposals already agreed in a negotiation keep their own terms.
        </p>
      </header>
      {c.pending_changes && c.pending_changes.length > 0 && (
        <p className="mk-banner">
          Unpublished changes to{" "}
          {c.pending_changes.map((x) => changeLabels[x] ?? x).join(", ")}.
        </p>
      )}
      <ol className="cp-versions">
        {[...c.versions].reverse().map((v) => (
          <li key={v.version} className={v.material ? "material" : ""}>
            <p>
              <b>Version {v.version}</b> ·{" "}
              {v.published_at ? `published ${day(v.published_at)}` : "draft"}
              {v.version === c.published_version ? (
                <span className="cp-pill ok">Live</span>
              ) : null}
            </p>
            {v.material ? (
              <p>
                Material change:{" "}
                {v.changes.map((k) => changeLabels[k] ?? k).join(", ")}
              </p>
            ) : v.published_at ? (
              <p className="st-hint">
                {v.version === 1
                  ? "First publication"
                  : "Wording only; nobody was notified"}
              </p>
            ) : null}
            {notified[v.version] && (
              <p className="st-hint">
                Told {notified[v.version].savers} Creator(s) who saved it and{" "}
                {notified[v.version].participants} who applied or are
                negotiating.
              </p>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
