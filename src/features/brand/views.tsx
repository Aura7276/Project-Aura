import Link from "next/link";
import { notFound } from "next/navigation";
import { brandArea, brand } from "@/server/brand/service";
import { eligible } from "@/server/auth/session";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import { countries } from "@/features/creator-onboarding/taxonomy";
import * as act from "./actions";
import {
  businessTypes,
  caseKinds,
  caseStatus,
  checklist,
  creatorSegments,
  evidenceFields,
  evidenceMatrix,
  experiences,
  goalKinds,
  horizons,
  idDocuments,
  intents,
  maturityQuestions,
  money,
  objectives,
  platforms,
  resources,
  stages,
  teamSizes,
  type BrandState,
  type Horizon,
} from "./rules";
import "./brand.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
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
const at = (path: string, w: string, q = "") =>
  `${path}?w=${w}${q ? "&" + q : ""}`;
const countryOptions: Record<string, string> = Object.fromEntries(
  countries.map(([c, n]) => [c, n]),
);

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
    <fieldset className="br-checks">
      <legend>{legend}</legend>
      {hint && <p className="st-hint">{hint}</p>}
      {Object.entries(options).map(([k, l]) => (
        <label key={k}>
          <input
            type="checkbox"
            name={name}
            value={k}
            defaultChecked={selected.includes(k)}
          />{" "}
          {l}
        </label>
      ))}
    </fieldset>
  );
}
function VerificationPill({ v }: { v: string }) {
  const map: Record<string, [string, string]> = {
    verified: ["ok", "Business verified"],
    pending: ["warn", "Not verified yet"],
    revoked: ["no", "Verification paused"],
  };
  const [cls, label] = map[v] ?? map.pending;
  return <span className={`br-pill ${cls}`}>{label}</span>;
}
const sections: [string, string][] = [
  ["/brand/profile", "Profile"],
  ["/brand/products", "Products"],
  ["/brand/audiences", "Audiences"],
  ["/brand/goals", "Goals"],
  ["/brand/plan", "Plan"],
  ["/brand/guidelines", "Guidelines"],
  ["/brand/preferences/creators", "Creators"],
  ["/brand/competitors", "Competitors"],
  ["/brand/socials", "Socials"],
  ["/brand/intelligence", "Brief"],
];
function Shell({
  s,
  w,
  current,
  title,
  lead,
  children,
}: {
  s: BrandState;
  w: string;
  current: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell br-main">
      <header className="br-head">
        <p className="br-eyebrow">
          <Link href={at("/brand", w)}>
            {s.profile?.public_name ?? s.workspace.name}
          </Link>{" "}
          <VerificationPill v={s.workspace.verification} />
        </p>
        <h1>{title}</h1>
        {lead && <p className="br-lead">{lead}</p>}
      </header>
      <nav aria-label="Business sections" className="br-tabs">
        {sections.map(([h, l]) => (
          <Link
            key={h}
            href={at(h, w)}
            aria-current={h === current ? "page" : undefined}
          >
            {l}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
function Notice({ sp }: { sp: SP }) {
  const msg = sp.welcome
    ? "Your Brand workspace is set up. Everything below is private to your team until you choose otherwise."
    : sp.refreshed
      ? "Plan refreshed. Steps you edited or completed were kept."
      : "";
  return (
    <p role="status" aria-live="polite" className="st-ok">
      {msg}
    </p>
  );
}

// ───────── Home ─────────
export async function BrandHomeView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const steps = checklist(s);
  const left = steps.filter((x) => !x.done);
  const week = s.plan.filter((x) => x.horizon_days === 7);
  const p = s.profile!;
  return (
    <main className="shell br-main">
      <header className="br-hero">
        <p className="br-eyebrow">
          <VerificationPill v={s.workspace.verification} /> ·{" "}
          {businessTypes[p.business_type]} · {stages[p.stage]}
        </p>
        <h1>{p.public_name}</h1>
        <p className="br-lead">
          Objective: <b>{objectives[p.objective]}</b> · {intents[p.intent]}.{" "}
          <Link href={at("/brand/profile", w)}>Change</Link>
        </p>
      </header>
      <Notice sp={sp} />
      {s.workspace.verification !== "verified" && (
        <section className="br-callout" aria-labelledby="h-ver">
          <div>
            <h2 id="h-ver">
              {s.verification?.status === "submitted"
                ? "Verification is with a reviewer"
                : s.verification?.status === "info_requested"
                  ? "The reviewer needs more information"
                  : "Verify your business to go live"}
            </h2>
            <p>
              Until then you can plan, write briefs and prepare campaign drafts.
              Publishing campaigns, inviting Creators, sending enquiries and a
              public profile need an approved verification.
            </p>
          </div>
          <Link className="st-btn primary" href={at("/brand/verification", w)}>
            {s.verification ? "Open verification" : "Start verification"}
          </Link>
        </section>
      )}
      <div className="br-grid">
        <section className="st-card" aria-labelledby="h-setup">
          <h2 id="h-setup">Setup</h2>
          <p className="st-hint">
            {left.length
              ? `${left.length} step${left.length === 1 ? "" : "s"} left. Do them in any order.`
              : "Everything is set up."}
          </p>
          <ol className="br-steps">
            {steps.map((x) => (
              <li key={x.key} className={x.done ? "done" : ""}>
                <span className="br-tick" aria-hidden>
                  {x.done ? "✓" : ""}
                </span>
                <span>
                  <Link
                    href={at(x.href.split("?")[0], w, x.href.split("?")[1])}
                  >
                    {x.label}
                  </Link>
                  {x.done ? <span className="sr-only"> (done)</span> : null}
                  <br />
                  <span className="st-hint">{x.why}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="st-card" aria-labelledby="h-week">
          <h2 id="h-week">This week</h2>
          {week.length === 0 ? (
            <p className="st-hint">
              No steps yet.{" "}
              <Link href={at("/brand/plan", w)}>Open your plan</Link>.
            </p>
          ) : (
            <ul className="br-plan">
              {week.slice(0, 5).map((x) => (
                <li key={x.id} className={x.done_at ? "done" : ""}>
                  {x.title}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link href={at("/brand/plan", w)}>7, 30 and 90-day plans</Link>
          </p>
        </section>
        <section className="st-card" aria-labelledby="h-go">
          <h2 id="h-go">Work with Creators</h2>
          <ul className="br-links">
            <li>
              <Link href={`/brand/workspaces/${w}`}>
                Brand Studio dashboard
              </Link>
              <span className="st-hint">
                Priorities, tasks and your collaborations.
              </span>
            </li>
            <li>
              <Link href="/brand/campaigns">Campaigns</Link>
              <span className="st-hint">
                Draft, publish and manage campaigns.
              </span>
            </li>
            <li>
              <Link href="/brand/inbox">Inbox</Link>
              <span className="st-hint">
                Invitations, enquiries and negotiations.
              </span>
            </li>
            <li>
              <Link href={at("/brand/preferences/creators", w)}>
                Creator preferences
              </Link>
              <span className="st-hint">Who you would like to work with.</span>
            </li>
          </ul>
        </section>
        <section className="st-card" aria-labelledby="h-know">
          <h2 id="h-know">Your Brand at a glance</h2>
          <dl className="br-facts">
            <div>
              <dt>Products</dt>
              <dd>{s.products.filter((x) => x.status === "active").length}</dd>
            </div>
            <div>
              <dt>Audiences</dt>
              <dd>{s.segments.length}</dd>
            </div>
            <div>
              <dt>Goals</dt>
              <dd>{s.goals.length}</dd>
            </div>
            <div>
              <dt>Social accounts</dt>
              <dd>
                {s.socials.length} / {s.limits.socials}
              </dd>
            </div>
          </dl>
          <p>
            <Link href={at("/brand/intelligence", w)}>
              Read your Brand brief
            </Link>
          </p>
        </section>
      </div>
      <p className="st-hint br-foot">
        AI suggestions, website import and file uploads are not available yet.
        Everything here is entered and confirmed by your team.
      </p>
    </main>
  );
}

// ───────── Onboarding wizard (F03, F05–F07, F45) ─────────
const wizard: [string, string][] = [
  ["basics", "Basics"],
  ["objective", "Objective"],
  ["customers", "Customers"],
  ["goals", "Goals"],
  ["creators", "Creators"],
  ["review", "Review"],
];
export async function OnboardingView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"), {
    allowEmpty: true,
  });
  const p = s.profile;
  const step = !p
    ? "basics"
    : (one(sp, "step") ??
      (p.onboarding_step === "complete" ? "review" : p.onboarding_step));
  const idx = Math.max(
    0,
    wizard.findIndex(([k]) => k === step),
  );
  const skip = (next: string) => (
    <Link className="st-btn" href={at("/brand/onboarding", w, `step=${next}`)}>
      Skip for now
    </Link>
  );
  return (
    <main className="shell br-main br-narrow">
      <header className="br-head">
        <p className="br-eyebrow">
          Brand setup · step {idx + 1} of {wizard.length}
        </p>
        <h1>
          {
            {
              basics: "Tell us about your business",
              objective: "What do you want from AURA?",
              customers: "Who buys from you?",
              goals: "Set a first goal",
              creators: "Which Creators suit you?",
              review: "You are ready to start",
            }[step]
          }
        </h1>
        <p className="br-lead">
          {idx < 2
            ? "Two short required steps. Everything else can wait, and you can change it later."
            : "Optional. Skip anything you do not know yet."}
        </p>
      </header>
      <ol className="br-wizard" aria-label="Setup steps">
        {wizard.map(([k, l], i) => (
          <li
            key={k}
            aria-current={i === idx ? "step" : undefined}
            className={i < idx ? "done" : ""}
          >
            {l}
          </li>
        ))}
      </ol>
      <section className="st-card">
        {step === "basics" && (
          <EntityForm
            action={act.saveBasics}
            label="Business basics"
            idPrefix="ob"
            submit="Continue"
            fields={[
              W(w),
              {
                name: "public_name",
                label: "Brand name",
                required: true,
                max: 80,
                value: p?.public_name ?? s.workspace.name,
                hint: "The name Creators will see. Your legal name is asked for only during verification.",
              },
              {
                name: "business_type",
                label: "Type of business",
                type: "select",
                required: true,
                options: businessTypes,
                value:
                  p?.business_type ??
                  (s.workspace.business_kind === "individual"
                    ? "individual"
                    : (s.workspace.business_kind ?? "small_business")),
              },
              {
                name: "country",
                label: "Country",
                type: "select",
                required: true,
                options: countryOptions,
                value: p?.country ?? "IN",
              },
              {
                name: "industry",
                label: "Industry",
                max: 60,
                value: p?.industry,
                hint: "For example: travel, skincare, food delivery.",
              },
              {
                name: "website",
                label: "Website",
                type: "url",
                value: p?.website,
                hint: "No website or social presence yet? That is fine.",
              },
              {
                name: "intent",
                label: "What brings you here",
                type: "select",
                required: true,
                options: intents,
                value: p?.intent ?? "both",
              },
            ]}
          />
        )}
        {step === "objective" && p && (
          <EntityForm
            action={act.saveObjective}
            label="Objective and stage"
            idPrefix="oo"
            submit="Continue"
            fields={[
              W(w),
              {
                name: "objective",
                label: "Primary objective",
                type: "select",
                required: true,
                options: objectives,
                value: p.objective,
                hint: "It shapes suggestions only. Every feature stays available.",
              },
              {
                name: "stage",
                label: "Business stage",
                type: "select",
                required: true,
                options: stages,
                value: p.stage,
              },
              {
                name: "experience",
                label: "Experience with Creators",
                type: "select",
                required: true,
                options: experiences,
                value: p.experience,
              },
              {
                name: "team_size",
                label: "Team size",
                type: "select",
                options: { "": "Prefer not to say", ...teamSizes },
                value: p.team_size ?? "",
              },
            ]}
          >
            <Checks
              name="resources"
              legend="What you already have (optional)"
              options={resources}
              selected={p.resources}
            />
          </EntityForm>
        )}
        {step === "customers" && (
          <EntityForm
            action={act.onboardingStep}
            label="Customers and products"
            idPrefix="oc"
            submit="Save and continue"
            fields={[
              W(w),
              H("step", "customers"),
              {
                name: "product_name",
                label: "Your main product or service",
                max: 100,
              },
              {
                name: "product_kind",
                label: "It is a",
                type: "select",
                options: {
                  product: "Product",
                  service: "Service",
                  experience: "Experience",
                },
              },
              {
                name: "segment_name",
                label: "Your main customer group",
                max: 80,
                hint: "For example: students who travel on a budget.",
              },
              {
                name: "segment_description",
                label: "What do they care about?",
                type: "textarea",
                rows: 3,
                max: 600,
              },
            ]}
          >
            {skip("goals")}
          </EntityForm>
        )}
        {step === "goals" && (
          <EntityForm
            action={act.onboardingStep}
            label="First goal"
            idPrefix="og"
            submit="Save and continue"
            fields={[
              W(w),
              H("step", "goals"),
              {
                name: "goal_kind",
                label: "Kind of goal",
                type: "select",
                options: goalKinds,
                value: p?.objective,
              },
              {
                name: "goal_metric",
                label: "What you will measure",
                max: 80,
                hint: "For example: Instagram followers, website visits, enquiries.",
              },
              { name: "goal_target", label: "Target", type: "number", min: 1 },
              {
                name: "goal_horizon",
                label: "Within",
                type: "select",
                options: { "30": "30 days", "7": "7 days", "90": "90 days" },
              },
            ]}
          >
            {skip("creators")}
          </EntityForm>
        )}
        {step === "creators" && (
          <EntityForm
            action={act.onboardingStep}
            label="Creator preferences"
            idPrefix="ocr"
            submit="Save and continue"
            fields={[
              W(w),
              H("step", "creators"),
              {
                name: "niches",
                label: "Niches you like (comma separated)",
                max: 400,
                value: s.creator_pref?.niches.join(", "),
              },
              {
                name: "ugc_interest",
                label:
                  "I am open to UGC Creators (content for our own channels, follower count does not matter)",
                type: "checkbox",
                value: s.creator_pref?.ugc_interest ?? true,
              },
            ]}
          >
            <Checks
              name="platforms"
              legend="Platforms"
              options={platforms}
              selected={s.creator_pref?.platforms ?? []}
            />
            <Checks
              name="experience"
              legend="Creator experience"
              options={{
                emerging: "Emerging",
                growing: "Growing",
                established: "Established",
              }}
              selected={s.creator_pref?.experience ?? []}
              hint="Preferences are defaults, never hard rules."
            />
            {skip("review")}
          </EntityForm>
        )}
        {step === "review" && p && (
          <>
            <dl className="br-facts wide">
              <div>
                <dt>Brand</dt>
                <dd>{p.public_name}</dd>
              </div>
              <div>
                <dt>Business</dt>
                <dd>
                  {businessTypes[p.business_type]}, {p.country}
                </dd>
              </div>
              <div>
                <dt>Objective</dt>
                <dd>{objectives[p.objective]}</dd>
              </div>
              <div>
                <dt>Products</dt>
                <dd>{s.products.length || "Not yet"}</dd>
              </div>
              <div>
                <dt>Customer groups</dt>
                <dd>{s.segments.length || "Not yet"}</dd>
              </div>
              <div>
                <dt>Goals</dt>
                <dd>{s.goals.length || "Not yet"}</dd>
              </div>
            </dl>
            <p>
              We will prepare 7, 30 and 90-day plans from what you told us. You
              can edit every step.
            </p>
            <form action={act.finishOnboarding}>
              <input type="hidden" name="w" value={w} />
              <button className="st-btn primary">Finish setup</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

// ───────── Profile and publication (F10, F21, F40, F46, F47) ─────────
export async function ProfileView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const p = s.profile!;
  const verified = s.workspace.verification === "verified";
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/profile"
      title="Business profile"
      lead="Your trading and public identity. Your legal identity is kept separately, in verification, and is never shown to Creators."
    >
      <div className="br-cols">
        <section className="st-card" aria-labelledby="h-id">
          <h2 id="h-id">Identity and objective</h2>
          <EntityForm
            action={act.saveProfile}
            label="Business profile"
            idPrefix="pf"
            submit="Save"
            fields={[
              W(w),
              {
                name: "public_name",
                label: "Brand name",
                required: true,
                max: 80,
                value: p.public_name,
              },
              { name: "tagline", label: "Tagline", max: 140, value: p.tagline },
              {
                name: "about",
                label: "About",
                type: "textarea",
                rows: 5,
                max: 1500,
                value: p.about,
                hint: "Shown on your public profile if you publish it.",
              },
              {
                name: "industry",
                label: "Industry",
                max: 60,
                value: p.industry,
              },
              {
                name: "website",
                label: "Website",
                type: "url",
                value: p.website,
              },
              {
                name: "business_type",
                label: "Type of business",
                type: "select",
                required: true,
                options: businessTypes,
                value: p.business_type,
              },
              {
                name: "country",
                label: "Country",
                type: "select",
                required: true,
                options: countryOptions,
                value: p.country,
              },
              {
                name: "intent",
                label: "What brings you here",
                type: "select",
                required: true,
                options: intents,
                value: p.intent,
              },
              {
                name: "objective",
                label: "Primary objective",
                type: "select",
                required: true,
                options: objectives,
                value: p.objective,
              },
              {
                name: "stage",
                label: "Business stage",
                type: "select",
                required: true,
                options: stages,
                value: p.stage,
              },
              {
                name: "experience",
                label: "Experience with Creators",
                type: "select",
                required: true,
                options: experiences,
                value: p.experience,
              },
              {
                name: "team_size",
                label: "Team size",
                type: "select",
                options: { "": "Prefer not to say", ...teamSizes },
                value: p.team_size ?? "",
              },
              {
                name: "agency_name",
                label: "Agency you work with",
                max: 120,
                value: p.agency_name,
                hint: "A label only. It gives the agency no access to this workspace.",
              },
            ]}
          >
            <Checks
              name="resources"
              legend="Resources you have"
              options={resources}
              selected={p.resources}
            />
          </EntityForm>
        </section>
        <aside className="st-card br-publish" aria-labelledby="h-pub">
          <h2 id="h-pub">Public profile</h2>
          <p>
            <span className={`br-pill ${p.published ? "ok" : ""}`}>
              {p.published ? "Published" : "Private"}
            </span>
          </p>
          {!verified ? (
            <p className="st-hint">
              Your profile stays private until your business is verified.{" "}
              <Link href={at("/brand/verification", w)}>Verification</Link>
            </p>
          ) : (
            <>
              <p className="st-hint">
                Shows your name, tagline, about, industry, country, website,
                active products and social handles. Never your legal details,
                budget, audiences, competitors or plans.
              </p>
              <EntityForm
                action={act.publishProfile}
                label="Publish your profile"
                idPrefix="pb"
                submit={p.published ? "Update address" : "Publish profile"}
                fields={[
                  W(w),
                  {
                    name: "slug",
                    label: "Address",
                    required: true,
                    max: 40,
                    value:
                      p.slug ??
                      p.public_name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                        .slice(0, 40),
                    hint: "aura.app/brand/your-address",
                  },
                ]}
              />
              {p.published && (
                <>
                  <p>
                    <Link href={`/brand/${p.slug}`}>
                      View your public profile
                    </Link>
                  </p>
                  <EntityForm
                    action={act.publishProfile}
                    label="Unpublish your profile"
                    idPrefix="up"
                    submit="Unpublish"
                    fields={[W(w), H("on", "no")]}
                  />
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </Shell>
  );
}

// ───────── Products (F11) ─────────
export async function ProductsView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const segs = Object.fromEntries(s.segments.map((x) => [x.id, x.name]));
  const fields = (x?: BrandState["products"][number]): FieldDef[] => [
    W(w),
    ...(x ? [H("id", x.id)] : []),
    { name: "name", label: "Name", required: true, max: 100, value: x?.name },
    {
      name: "kind",
      label: "Kind",
      type: "select",
      options: {
        product: "Product",
        service: "Service",
        experience: "Experience",
      },
      value: x?.kind ?? "product",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 3,
      max: 1000,
      value: x?.description,
    },
    { name: "url", label: "Link", type: "url", value: x?.url },
    {
      name: "currency",
      label: "Currency",
      type: "select",
      options: {
        INR: "INR",
        USD: "USD",
        EUR: "EUR",
        GBP: "GBP",
        AED: "AED",
        SGD: "SGD",
      },
      value: x?.currency ?? "INR",
    },
    {
      name: "price_min",
      label: "Price from",
      type: "number",
      min: 0,
      value: x?.price_min,
    },
    {
      name: "price_max",
      label: "Price to",
      type: "number",
      min: 0,
      value: x?.price_max,
    },
    {
      name: "claims",
      label: "Approved claims, one per line",
      type: "lines",
      value: x?.claims.join("\n"),
      hint: "Only claims you can prove. Creators may repeat them.",
    },
    ...(x
      ? [
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            options: { active: "Active", archived: "Archived" },
            value: x.status,
          },
        ]
      : []),
  ];
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/products"
      title="Products and services"
      lead="What Creators would show. Approved claims keep everyone on the same, honest message."
    >
      {s.products.length === 0 && (
        <p className="br-empty">
          No products yet. Add the one you would most like Creators to feature.
        </p>
      )}
      <div className="br-list">
        {s.products.map((x) => (
          <details key={x.id} className="st-card br-item">
            <summary>
              <b>{x.name}</b> <span className="br-pill">{x.kind}</span>{" "}
              {x.status === "archived" && (
                <span className="br-pill no">Archived</span>
              )}
              <span className="st-hint">
                {" "}
                {x.price_min !== null
                  ? `${money(x.price_min, x.currency ?? "INR")}${x.price_max !== null && x.price_max !== x.price_min ? ` to ${money(x.price_max, x.currency ?? "INR")}` : ""}`
                  : ""}
                {x.claims.length
                  ? ` · ${x.claims.length} claim${x.claims.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            </summary>
            <EntityForm
              action={act.saveProduct}
              label={`Edit ${x.name}`}
              idPrefix={`pr${x.id.slice(0, 6)}`}
              submit="Save"
              fields={fields(x)}
            >
              {s.segments.length > 0 && (
                <Checks
                  name="segment_ids"
                  legend="For these customer groups"
                  options={segs}
                  selected={x.segment_ids}
                />
              )}
            </EntityForm>
            <form action={act.removeItem} className="br-inline">
              <input type="hidden" name="w" value={w} />
              <input type="hidden" name="kind" value="product" />
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="back" value="/brand/products" />
              <button className="st-btn">Delete</button>
            </form>
          </details>
        ))}
      </div>
      <section className="st-card" aria-labelledby="h-add">
        <h2 id="h-add">Add a product or service</h2>
        <EntityForm
          action={act.saveProduct}
          label="Add a product"
          idPrefix="pn"
          submit="Add"
          fields={fields()}
        >
          {s.segments.length > 0 && (
            <Checks
              name="segment_ids"
              legend="For these customer groups"
              options={segs}
              selected={[]}
            />
          )}
        </EntityForm>
      </section>
    </Shell>
  );
}

// ───────── Audiences (F15–F17) ─────────
export async function AudiencesView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const fields = (x?: BrandState["segments"][number]): FieldDef[] => [
    W(w),
    ...(x ? [H("id", x.id)] : []),
    { name: "name", label: "Name", required: true, max: 80, value: x?.name },
    {
      name: "description",
      label: "Who they are",
      type: "textarea",
      rows: 3,
      max: 600,
      value: x?.description,
    },
    {
      name: "countries",
      label: "Countries (two-letter codes, comma separated)",
      value: x?.countries.join(", "),
      hint: "For example: IN, AE",
    },
    { name: "languages", label: "Languages", value: x?.languages.join(", ") },
    {
      name: "age_min",
      label: "Age from",
      type: "number",
      min: 18,
      value: x?.age_min,
    },
    {
      name: "age_max",
      label: "Age to",
      type: "number",
      min: 18,
      value: x?.age_max,
    },
    { name: "interests", label: "Interests", value: x?.interests.join(", ") },
    {
      name: "considerations",
      label: "What they weigh up before buying",
      type: "textarea",
      rows: 2,
      max: 600,
      value: x?.considerations,
    },
    {
      name: "confirmed",
      label:
        "We have checked this with real customers (otherwise it is shown as a hypothesis)",
      type: "checkbox",
      value: x?.basis === "confirmed",
    },
  ];
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/audiences"
      title="Customer groups"
      lead="Describe who buys from you. Unchecked ideas stay labelled as hypotheses, so nobody mistakes a guess for a fact."
    >
      {s.segments.length === 0 && (
        <p className="br-empty">No customer groups yet.</p>
      )}
      <div className="br-list">
        {s.segments.map((x) => (
          <details key={x.id} className="st-card br-item">
            <summary>
              <b>{x.name}</b>{" "}
              <span
                className={`br-pill ${x.basis === "confirmed" ? "ok" : "warn"}`}
              >
                {x.basis === "confirmed" ? "Confirmed" : "Hypothesis"}
              </span>
              <span className="st-hint">
                {" "}
                {[
                  x.countries.join(", "),
                  x.age_min || x.age_max
                    ? `${x.age_min ?? 18} to ${x.age_max ?? "any"}`
                    : "",
                  x.interests.slice(0, 3).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </summary>
            <EntityForm
              action={act.saveSegment}
              label={`Edit ${x.name}`}
              idPrefix={`sg${x.id.slice(0, 6)}`}
              submit="Save"
              fields={fields(x)}
            />
            <form action={act.removeItem} className="br-inline">
              <input type="hidden" name="w" value={w} />
              <input type="hidden" name="kind" value="segment" />
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="back" value="/brand/audiences" />
              <button className="st-btn">Delete</button>
            </form>
          </details>
        ))}
      </div>
      <section className="st-card" aria-labelledby="h-add">
        <h2 id="h-add">Add a customer group</h2>
        <EntityForm
          action={act.saveSegment}
          label="Add a customer group"
          idPrefix="sn"
          submit="Add"
          fields={fields()}
        />
      </section>
      <p className="st-hint">
        AI personas are not available yet. When they are, they will be marked as
        suggestions until you confirm them.
      </p>
    </Shell>
  );
}

// ───────── Goals, maturity and budget (F07–F09, F19, F20) ─────────
export async function GoalsView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const fields = (x?: BrandState["goals"][number]): FieldDef[] => [
    W(w),
    ...(x ? [H("id", x.id)] : []),
    {
      name: "kind",
      label: "Kind",
      type: "select",
      options: goalKinds,
      value: x?.kind ?? s.profile!.objective,
    },
    {
      name: "metric",
      label: "What you will measure",
      required: true,
      max: 80,
      value: x?.metric,
    },
    {
      name: "baseline",
      label: "Where you are today",
      type: "number",
      min: 0,
      value: x?.baseline,
    },
    {
      name: "target",
      label: "Target",
      type: "number",
      required: true,
      min: 1,
      value: x?.target,
    },
    {
      name: "horizon_days",
      label: "Within",
      type: "select",
      options: { "30": "30 days", "7": "7 days", "90": "90 days" },
      value: String(x?.horizon_days ?? 30),
    },
    { name: "note", label: "Note", max: 300, value: x?.note },
  ];
  const b = s.budget;
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/goals"
      title="Goals"
      lead="A few measurable goals, where you stand today, and an optional budget range."
    >
      <section className="st-card" aria-labelledby="h-goals">
        <h2 id="h-goals">Your goals</h2>
        {s.goals.length === 0 ? (
          <p className="br-empty">No goals yet.</p>
        ) : (
          <div className="br-list">
            {s.goals.map((g) => (
              <details key={g.id} className="br-item">
                <summary>
                  <b>{g.metric}</b>:{" "}
                  {g.baseline !== null ? `${g.baseline} → ` : ""}
                  {g.target} in {g.horizon_days} days{" "}
                  <span className="br-pill">{goalKinds[g.kind]}</span>
                </summary>
                <EntityForm
                  action={act.saveGoal}
                  label={`Edit ${g.metric}`}
                  idPrefix={`gl${g.id.slice(0, 6)}`}
                  submit="Save"
                  fields={fields(g)}
                />
                <form action={act.removeItem} className="br-inline">
                  <input type="hidden" name="w" value={w} />
                  <input type="hidden" name="kind" value="goal" />
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="back" value="/brand/goals" />
                  <button className="st-btn">Delete</button>
                </form>
              </details>
            ))}
          </div>
        )}
        <h3>Add a goal</h3>
        <EntityForm
          action={act.saveGoal}
          label="Add a goal"
          idPrefix="gn"
          submit="Add goal"
          fields={fields()}
        />
      </section>
      <section className="st-card" aria-labelledby="h-mat">
        <h2 id="h-mat">Where you are today</h2>
        <p className="st-hint">
          Five quick questions. Your answers tailor your plan; they are never
          turned into a score.
        </p>
        <EntityForm
          action={act.saveMaturity}
          label="Maturity"
          idPrefix="mt"
          submit="Save answers"
          fields={[
            W(w),
            ...maturityQuestions.map((q): FieldDef => ({
              name: q.key,
              label: q.label,
              type: "select",
              options: { "": "Choose…", ...q.levels },
              value: s.maturity?.[q.key] ?? "",
            })),
          ]}
        />
      </section>
      <section className="st-card" aria-labelledby="h-bud">
        <h2 id="h-bud">Indicative budget (optional)</h2>
        <p className="st-hint">
          A rough range helps us suggest realistic pilots. It is never a
          commitment and is never shown to Creators.
        </p>
        <EntityForm
          action={act.saveBudget}
          label="Budget"
          idPrefix="bd"
          submit="Save budget"
          fields={[
            W(w),
            {
              name: "currency",
              label: "Currency",
              type: "select",
              options: {
                INR: "INR",
                USD: "USD",
                EUR: "EUR",
                GBP: "GBP",
                AED: "AED",
                SGD: "SGD",
              },
              value: b?.currency ?? "INR",
            },
            {
              name: "range_min",
              label: "From",
              type: "number",
              min: 0,
              value: b?.range_min,
            },
            {
              name: "range_max",
              label: "To",
              type: "number",
              min: 0,
              value: b?.range_max,
            },
            {
              name: "period",
              label: "Per",
              type: "select",
              options: {
                month: "Month",
                quarter: "Quarter",
                campaign: "Campaign",
              },
              value: b?.period ?? "month",
            },
            {
              name: "creator_share",
              label: "Share for Creator work (%)",
              type: "number",
              min: 0,
              value: b?.creator_share,
              hint: "The rest is for your own content. Optional.",
            },
            { name: "note", label: "Note", max: 300, value: b?.note },
          ]}
        />
        {b && (
          <EntityForm
            action={act.saveBudget}
            label="Remove budget"
            idPrefix="bx"
            submit="Remove budget"
            fields={[W(w), H("clear", "1")]}
          />
        )}
      </section>
    </Shell>
  );
}

// ───────── Plans (F43, F44) ─────────
export async function PlanView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/plan"
      title="Growth plan"
      lead="Suggested steps for the next 7, 30 and 90 days, based on what you told us. Edit, add or tick off anything; refreshing keeps your changes."
    >
      <Notice sp={sp} />
      <div className="br-plans">
        {horizons.map((h: Horizon) => {
          const items = s.plan.filter((x) => x.horizon_days === h);
          return (
            <section key={h} className="st-card" aria-labelledby={`h-${h}`}>
              <h2 id={`h-${h}`}>{h} days</h2>
              {items.length === 0 ? (
                <p className="br-empty">No steps yet.</p>
              ) : (
                <ul className="br-plan">
                  {items.map((x) => (
                    <li key={x.id} className={x.done_at ? "done" : ""}>
                      <form action={act.planItem} className="br-inline">
                        <input type="hidden" name="w" value={w} />
                        <input type="hidden" name="id" value={x.id} />
                        <button
                          className="br-check"
                          aria-pressed={!!x.done_at}
                          aria-label={`${x.done_at ? "Mark as not done" : "Mark as done"}: ${x.title}`}
                        >
                          {x.done_at ? "✓" : ""}
                        </button>
                      </form>
                      <details>
                        <summary>
                          {x.title}
                          {x.edited ? (
                            <span className="st-hint"> · yours</span>
                          ) : null}
                        </summary>
                        {x.detail && <p className="st-hint">{x.detail}</p>}
                        <EntityForm
                          action={act.editPlanItem}
                          label={`Edit step ${x.title}`}
                          idPrefix={`pi${x.id.slice(0, 6)}`}
                          submit="Save step"
                          fields={[
                            W(w),
                            H("id", x.id),
                            {
                              name: "title",
                              label: "Step",
                              required: true,
                              max: 140,
                              value: x.title,
                            },
                            {
                              name: "detail",
                              label: "Detail",
                              type: "textarea",
                              rows: 2,
                              max: 500,
                              value: x.detail,
                            },
                          ]}
                        />
                        <form action={act.removeItem} className="br-inline">
                          <input type="hidden" name="w" value={w} />
                          <input type="hidden" name="kind" value="plan_item" />
                          <input type="hidden" name="id" value={x.id} />
                          <input
                            type="hidden"
                            name="back"
                            value="/brand/plan"
                          />
                          <button className="st-btn">Remove</button>
                        </form>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <details>
                <summary>Add your own step</summary>
                <EntityForm
                  action={act.editPlanItem}
                  label={`Add a ${h}-day step`}
                  idPrefix={`pa${h}`}
                  submit="Add step"
                  fields={[
                    W(w),
                    H("horizon", h),
                    { name: "title", label: "Step", required: true, max: 140 },
                    {
                      name: "detail",
                      label: "Detail",
                      type: "textarea",
                      rows: 2,
                      max: 500,
                    },
                  ]}
                />
              </details>
              <form action={act.regeneratePlan}>
                <input type="hidden" name="w" value={w} />
                <input type="hidden" name="horizon" value={h} />
                <button className="st-btn">Refresh suggestions</button>
              </form>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}

// ───────── Guidelines (F13, F14, F26) ─────────
export async function GuidelinesView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const g = s.guideline;
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/guidelines"
      title="Brand guidelines"
      lead="How you sound and look, what Creators may claim, and what is off limits."
    >
      {g?.colours.length ? (
        <div className="br-swatches" aria-label="Brand colours">
          {g.colours.map((c) => (
            <span key={c} style={{ background: c }} title={c}>
              <span className="sr-only">{c}</span>
            </span>
          ))}
        </div>
      ) : null}
      <section className="st-card">
        <EntityForm
          action={act.saveGuideline}
          label="Brand guidelines"
          idPrefix="gd"
          submit="Save guidelines"
          fields={[
            W(w),
            {
              name: "tone",
              label: "Tone words (comma separated)",
              value: g?.tone.join(", "),
              hint: "For example: warm, honest, playful",
            },
            {
              name: "voice",
              label: "Voice",
              type: "textarea",
              rows: 4,
              max: 800,
              value: g?.voice,
            },
            {
              name: "dos",
              label: "Do's, one per line",
              type: "lines",
              value: g?.dos.join("\n"),
            },
            {
              name: "donts",
              label: "Don'ts, one per line",
              type: "lines",
              value: g?.donts.join("\n"),
            },
            {
              name: "colours",
              label: "Brand colours (hex, comma separated)",
              value: g?.colours.join(", "),
              hint: "For example: #5B4BD6, #F4B740",
            },
            {
              name: "visual",
              label: "Visual style",
              type: "textarea",
              rows: 3,
              max: 800,
              value: g?.visual,
            },
            {
              name: "claims_rules",
              label: "Rules for claims",
              type: "textarea",
              rows: 3,
              max: 800,
              value: g?.claims_rules,
            },
            {
              name: "exclusions",
              label: "Off limits (topics, competitors, settings)",
              type: "textarea",
              rows: 3,
              max: 800,
              value: g?.exclusions,
            },
            {
              name: "disclosures",
              label: "Required disclosures",
              max: 400,
              value: g?.disclosures,
              hint: "For example: #ad or 'Paid partnership' on every post.",
            },
          ]}
        />
      </section>
      <p className="st-hint">
        Logo and guideline file uploads, and AI suggestions for tone and
        colours, are not available yet.
      </p>
    </Shell>
  );
}

// ───────── Creator preferences (F27–F30) ─────────
export async function CreatorPrefsView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const c = s.creator_pref;
  const why = creatorSegments(s);
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/preferences/creators"
      title="Creator preferences"
      lead="Defaults for your future campaigns. They guide suggestions; they are never hard rules unless you put them in a campaign."
    >
      <div className="br-cols">
        <section className="st-card">
          <EntityForm
            action={act.savePref}
            label="Creator preferences"
            idPrefix="cp"
            submit="Save preferences"
            fields={[
              W(w),
              {
                name: "niches",
                label: "Niches (comma separated)",
                value: c?.niches.join(", "),
              },
              {
                name: "formats",
                label: "Formats (comma separated)",
                value: c?.formats.join(", "),
                hint: "For example: reels, unboxing, tutorials",
              },
              {
                name: "languages",
                label: "Languages",
                value: c?.languages.join(", "),
              },
              {
                name: "countries",
                label: "Countries (two-letter codes)",
                value: c?.countries.join(", "),
              },
              {
                name: "ugc_interest",
                label: "Open to UGC Creators",
                type: "checkbox",
                value: c?.ugc_interest ?? true,
              },
              {
                name: "conflict_categories",
                label: "Conflicting categories (comma separated)",
                value: c?.conflict_categories.join(", "),
                hint: "Creators currently working with these categories would be flagged for you to review. Shown to Creators in campaigns that use it.",
              },
              { name: "note", label: "Note", max: 400, value: c?.note },
            ]}
          >
            <Checks
              name="platforms"
              legend="Platforms"
              options={platforms}
              selected={c?.platforms ?? []}
            />
            <Checks
              name="experience"
              legend="Creator experience"
              options={{
                emerging: "Emerging",
                growing: "Growing",
                established: "Established",
              }}
              selected={c?.experience ?? []}
            />
          </EntityForm>
        </section>
        <aside className="st-card" aria-labelledby="h-why">
          <h2 id="h-why">Creators that could suit you</h2>
          {why.length === 0 ? (
            <p className="st-hint">Complete your profile to see suggestions.</p>
          ) : (
            <ul className="br-why">
              {why.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <p className="st-hint">
            There is no follower minimum for Brands, and no ranking here.
            Individual Creator recommendations arrive with campaign tools.
          </p>
        </aside>
      </div>
    </Shell>
  );
}

// ───────── Competitors (F18, F30) ─────────
export async function CompetitorsView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/competitors"
      title="Competitors"
      lead="Saved references. Mark direct conflicts so you remember them when setting campaign exclusivity."
    >
      {s.competitors.length === 0 ? (
        <p className="br-empty">No competitors saved.</p>
      ) : (
        <ul className="br-rows">
          {s.competitors.map((x) => (
            <li key={x.id}>
              <span>
                <b>{x.name}</b>{" "}
                {x.conflict && <span className="br-pill warn">Conflict</span>}
                {x.website && (
                  <>
                    <br />
                    <a
                      href={x.website}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      {x.website.replace(/^https:\/\//, "")}
                    </a>
                  </>
                )}
                {x.note && (
                  <>
                    <br />
                    <span className="st-hint">{x.note}</span>
                  </>
                )}
              </span>
              <form action={act.removeItem}>
                <input type="hidden" name="w" value={w} />
                <input type="hidden" name="kind" value="competitor" />
                <input type="hidden" name="id" value={x.id} />
                <input type="hidden" name="back" value="/brand/competitors" />
                <button className="st-btn">Delete</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <section className="st-card" aria-labelledby="h-add">
        <h2 id="h-add">Add a competitor</h2>
        <EntityForm
          action={act.saveCompetitor}
          label="Add a competitor"
          idPrefix="cm"
          submit="Add"
          fields={[
            W(w),
            { name: "name", label: "Name", required: true, max: 100 },
            { name: "website", label: "Website", type: "url" },
            { name: "note", label: "Note", max: 300 },
            { name: "conflict", label: "Direct conflict", type: "checkbox" },
          ]}
        />
      </section>
      <p className="st-hint">
        Competitor monitoring is a future feature and will only use permitted
        data.
      </p>
    </Shell>
  );
}

// ───────── Socials (F23–F25) ─────────
export async function SocialsView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const full = s.socials.length >= s.limits.socials;
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/socials"
      title="Your social accounts"
      lead={`Your own Brand accounts, separate from any Creator. Up to ${s.limits.socials}. Starting from zero is fine.`}
    >
      {s.socials.length === 0 ? (
        <p className="br-empty">
          No accounts yet. Add the ones you have, even if they are new.
        </p>
      ) : (
        <ul className="br-rows">
          {s.socials.map((x) => (
            <li key={x.id}>
              <span>
                <b>{platforms[x.platform]}</b> @{x.handle}
                <br />
                <span className="st-hint">
                  {x.followers !== null
                    ? `${x.followers.toLocaleString("en-IN")} followers · self-reported on ${x.observed_on}`
                    : "No follower count recorded"}
                </span>
              </span>
              <form action={act.removeItem}>
                <input type="hidden" name="w" value={w} />
                <input type="hidden" name="kind" value="social_account" />
                <input type="hidden" name="id" value={x.id} />
                <input type="hidden" name="back" value="/brand/socials" />
                <button className="st-btn">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="st-hint">
        {s.socials.length} of {s.limits.socials} accounts.
      </p>
      {!full && (
        <section className="st-card" aria-labelledby="h-add">
          <h2 id="h-add">Add an account</h2>
          <EntityForm
            action={act.saveSocial}
            label="Add a social account"
            idPrefix="so"
            submit="Add account"
            fields={[
              W(w),
              {
                name: "platform",
                label: "Platform",
                type: "select",
                options: platforms,
                required: true,
              },
              { name: "handle", label: "Handle", required: true, max: 61 },
              {
                name: "followers",
                label: "Followers today",
                type: "number",
                min: 0,
                hint: "Optional. Saved as self-reported with today's date unless you pick one.",
              },
              { name: "observed_on", label: "Counted on", type: "date" },
            ]}
          />
        </section>
      )}
      <p className="st-hint">
        Connected analytics and screenshot-assisted counts for Brand accounts
        are not available yet.
      </p>
    </Shell>
  );
}

// ───────── Brand brief (F41) ─────────
function BriefRow({
  label,
  href,
  w,
  children,
}: {
  label: string;
  href: string;
  w: string;
  children: React.ReactNode;
}) {
  return (
    <div className="br-brief-row">
      <dt>
        {label}{" "}
        <Link href={at(href, w)} className="st-hint">
          Edit
        </Link>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
export async function IntelligenceView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const p = s.profile!;
  const g = s.guideline;
  const none = <span className="st-hint">Not added yet</span>;
  return (
    <Shell
      s={s}
      w={w}
      current="/brand/intelligence"
      title="Brand brief"
      lead="Everything your team has confirmed, in one place. Private to your workspace; only your published profile is ever shown to others."
    >
      <dl className="st-card br-brief">
        <BriefRow w={w} label="Who you are" href="/brand/profile">
          {p.public_name}, {businessTypes[p.business_type].toLowerCase()} in{" "}
          {p.country}
          {p.industry ? `, ${p.industry}` : ""}. {stages[p.stage]}.{" "}
          {p.about ?? ""}
        </BriefRow>
        <BriefRow w={w} label="What you want" href="/brand/goals">
          {objectives[p.objective]} · {intents[p.intent]}
          {s.goals.length
            ? `. Goals: ${s.goals.map((x) => `${x.metric} to ${x.target} in ${x.horizon_days} days`).join("; ")}`
            : ""}
        </BriefRow>
        <BriefRow w={w} label="What you sell" href="/brand/products">
          {s.products
            .filter((x) => x.status === "active")
            .map((x) => x.name)
            .join(", ") || none}
        </BriefRow>
        <BriefRow w={w} label="Who buys" href="/brand/audiences">
          {s.segments.length
            ? s.segments
                .map(
                  (x) =>
                    `${x.name} (${x.basis === "confirmed" ? "confirmed" : "hypothesis"})`,
                )
                .join(", ")
            : none}
        </BriefRow>
        <BriefRow w={w} label="How you sound" href="/brand/guidelines">
          {g
            ? [g.tone.join(", "), g.voice].filter(Boolean).join(". ") || none
            : none}
        </BriefRow>
        <BriefRow w={w} label="Do and don't" href="/brand/guidelines">
          {g && (g.dos.length || g.donts.length) ? (
            <>
              {g.dos.map((x) => (
                <span key={x} className="br-pill ok">
                  {x}
                </span>
              ))}{" "}
              {g.donts.map((x) => (
                <span key={x} className="br-pill no">
                  {x}
                </span>
              ))}
            </>
          ) : (
            none
          )}
        </BriefRow>
        <BriefRow
          w={w}
          label="Creators you prefer"
          href="/brand/preferences/creators"
        >
          {s.creator_pref
            ? [
                s.creator_pref.niches.join(", "),
                s.creator_pref.platforms
                  .map((x) => platforms[x as keyof typeof platforms] ?? x)
                  .join(", "),
                s.creator_pref.ugc_interest ? "open to UGC" : "",
              ]
                .filter(Boolean)
                .join(" · ") || none
            : none}
        </BriefRow>
        <BriefRow w={w} label="Resources" href="/brand/profile">
          {p.resources.length
            ? p.resources.map((x) => resources[x]).join(", ")
            : none}
          {p.agency_name ? ` · works with ${p.agency_name} (label only)` : ""}
        </BriefRow>
        <BriefRow w={w} label="Budget" href="/brand/goals">
          {s.budget
            ? `${money(s.budget.range_min, s.budget.currency)}${s.budget.range_max !== null ? ` to ${money(s.budget.range_max, s.budget.currency)}` : "+"} per ${s.budget.period}, indicative`
            : none}
        </BriefRow>
        <BriefRow w={w} label="Competitors" href="/brand/competitors">
          {s.competitors.map((x) => x.name).join(", ") || none}
        </BriefRow>
        <BriefRow w={w} label="Maturity" href="/brand/goals">
          {s.maturity && Object.keys(s.maturity).length
            ? maturityQuestions
                .filter((q) => s.maturity?.[q.key])
                .map(
                  (q) =>
                    `${q.label}: ${q.levels[s.maturity![q.key]!].toLowerCase()}`,
                )
                .join(". ")
            : none}
        </BriefRow>
      </dl>
      <p className="st-hint">
        Your Brand data is never used to train shared AI models.
      </p>
    </Shell>
  );
}

// ───────── Verification (F31–F37) ─────────
export async function VerificationView({ sp }: { sp: SP }) {
  const { s, workspaceId: w } = await brandArea(one(sp, "w"));
  const c = s.verification;
  const open = c && ["draft", "info_requested"].includes(c.status);
  const type = c?.business_type ?? s.profile!.business_type;
  const needed = evidenceMatrix[type];
  const canStart =
    !c || ["approved", "rejected", "withdrawn"].includes(c.status);
  const canAppeal = !!c?.can_appeal;
  const caseFields: FieldDef[] = [
    W(w),
    {
      name: "business_type",
      label: "Type of business",
      type: "select",
      required: true,
      options: businessTypes,
      value: type,
      hint: "The evidence needed depends on this.",
    },
    ...(Object.keys(evidenceFields) as (keyof typeof evidenceFields)[])
      .filter((k) => needed.includes(k) || (c?.[k] ?? "") !== "")
      .map((k): FieldDef =>
        k === "id_document_type"
          ? {
              name: k,
              label: evidenceFields[k],
              type: "select",
              required: true,
              options: { "": "Choose…", ...idDocuments },
              value: c?.[k] ?? "",
            }
          : k === "registration_country"
            ? {
                name: k,
                label: evidenceFields[k],
                type: "select",
                required: true,
                options: { "": "Choose…", ...countryOptions },
                value: c?.[k] ?? "",
              }
            : k === "registered_address"
              ? {
                  name: k,
                  label: evidenceFields[k],
                  type: "textarea",
                  rows: 2,
                  required: true,
                  max: 400,
                  value: c?.[k],
                }
              : {
                  name: k,
                  label: evidenceFields[k],
                  required: needed.includes(k),
                  max: k === "id_document_last4" ? 4 : 160,
                  value: c?.[k],
                  hint:
                    k === "id_document_last4"
                      ? "Only the last 4 characters. Never enter the full number."
                      : undefined,
                },
      ),
    {
      name: "website",
      label: "Website",
      type: "url",
      value: c?.website ?? s.profile!.website,
      hint: "Supporting evidence only.",
    },
    {
      name: "contact_email",
      label: "Business email",
      value: c?.contact_email,
      hint: "An address on your website's domain helps the reviewer.",
    },
    {
      name: "note",
      label: "Anything the reviewer should know",
      type: "textarea",
      rows: 3,
      max: 1000,
      value: c?.note,
    },
  ];
  return (
    <Shell
      s={s}
      w={w}
      current=""
      title="Business verification"
      lead="A platform reviewer confirms that your business is real before you can publish campaigns, invite Creators, send enquiries or publish your profile. Each Brand workspace is verified separately."
    >
      <section
        className={`br-status ${s.workspace.verification}`}
        aria-labelledby="h-st"
      >
        <h2 id="h-st">
          <VerificationPill v={s.workspace.verification} />{" "}
          {c ? caseStatus[c.status]?.label : "Not started"}
        </h2>
        <p>
          {c
            ? caseStatus[c.status]?.detail
            : "You can keep using every private tool while you prepare this."}
        </p>
        {c?.decision_reason && (
          <p className="br-quote">Reviewer: “{c.decision_reason}”</p>
        )}
        {c && (
          <p className="st-hint">
            {caseKinds[c.kind]}
            {c.submitted_at ? ` · submitted ${day(c.submitted_at)}` : ""}
          </p>
        )}
      </section>
      {(open || canStart) && (
        <div className="br-cols">
          <section className="st-card" aria-labelledby="h-ev">
            <h2 id="h-ev">
              {canStart && c?.status === "approved"
                ? "Change your legal details"
                : "Your details"}
            </h2>
            {canStart && c?.status === "approved" && (
              <p className="br-callout small">
                Changing your legal identity starts a revalidation. When you
                submit it, publishing and outreach pause until a reviewer
                confirms the change. Existing campaigns and agreements are not
                affected.
              </p>
            )}
            <p className="st-hint">
              Needed for {businessTypes[type]}:{" "}
              {needed
                .map((k) =>
                  evidenceFields[k].replace(/ \(.*\)/, "").toLowerCase(),
                )
                .join(", ")}
              . Document uploads are not available yet, so a reviewer checks
              these details against public registers.
            </p>
            <EntityForm
              action={act.saveCase}
              label="Verification details"
              idPrefix="vc"
              submit="Save draft"
              fields={caseFields}
            />
          </section>
          <aside className="st-card br-publish" aria-labelledby="h-sub">
            <h2 id="h-sub">Submit</h2>
            {c?.missing?.length && open ? (
              <p className="st-hint">
                Still needed:{" "}
                {c.missing
                  .map((k) => evidenceFields[k].replace(/ \(.*\)/, ""))
                  .join(", ")}
                .
              </p>
            ) : null}
            <EntityForm
              action={act.saveCase}
              label="Submit for review"
              idPrefix="vs"
              submit="Submit for review"
              fields={[
                W(w),
                H("submit", "1"),
                {
                  name: "declare",
                  label:
                    "I confirm these details are true and that I may act for this business.",
                  type: "checkbox",
                },
              ]}
            />
            {c &&
              ["draft", "submitted", "info_requested"].includes(c.status) && (
                <form action={act.withdrawCase}>
                  <input type="hidden" name="w" value={w} />
                  <button className="st-btn">Withdraw case</button>
                </form>
              )}
          </aside>
        </div>
      )}
      {c?.status === "submitted" && (
        <form action={act.withdrawCase} className="br-inline">
          <input type="hidden" name="w" value={w} />
          <button className="st-btn">Withdraw case</button>
        </form>
      )}
      {canAppeal && (
        <section className="st-card" aria-labelledby="h-ap">
          <h2 id="h-ap">Appeal</h2>
          <p className="st-hint">
            One appeal per decision, within 30 days. A different reviewer
            decides it.
          </p>
          <EntityForm
            action={act.appealCase}
            label="Appeal the decision"
            idPrefix="ap"
            submit="Submit appeal"
            fields={[
              W(w),
              {
                name: "reason",
                label: "Why the decision should change",
                type: "textarea",
                rows: 4,
                max: 1000,
                required: true,
              },
            ]}
          />
        </section>
      )}
      {c && c.events.length > 0 && (
        <section className="st-card" aria-labelledby="h-hi">
          <h2 id="h-hi">History</h2>
          <ol className="br-timeline">
            {c.events.map((e, i) => (
              <li key={i}>
                <b>
                  {{
                    opened: "Case opened",
                    submitted: "Submitted",
                    withdrawn: "Withdrawn",
                    appealed: "Appealed",
                    approved: "Approved",
                    rejected: "Not approved",
                    info_requested: "More information requested",
                  }[e.event] ?? e.event}
                </b>{" "}
                <span className="st-hint">
                  · {e.side} · {day(e.at)}
                </span>
                {e.message && e.event !== "opened" ? (
                  <>
                    <br />
                    <span>{e.message}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
          {s.cases.length > 1 && (
            <p className="st-hint">
              {s.cases.length} cases in total:{" "}
              {s.cases
                .map(
                  (x) =>
                    `${caseKinds[x.kind]} (${caseStatus[x.status]?.label ?? x.status})`,
                )
                .join(", ")}
              .
            </p>
          )}
        </section>
      )}
    </Shell>
  );
}

// ───────── Reviewer (/admin/verification) ─────────
export async function ReviewQueueView({ sp }: { sp: SP }) {
  const { client } = await eligible();
  const q = await brand.reviewQueue(client);
  if (!q.ok) notFound();
  const items = q.value as unknown as {
    id: string;
    workspace_id: string;
    brand: string;
    kind: keyof typeof caseKinds;
    business_type: keyof typeof businessTypes;
    submitted_at: string;
    own: boolean;
  }[];
  const cid = one(sp, "case");
  const detail =
    cid && /^[0-9a-f-]{36}$/i.test(cid)
      ? await brand.reviewCase(client, cid)
      : null;
  const d = detail?.ok
    ? (detail.value as unknown as Record<string, unknown> & {
        missing: string[];
        domain_match: boolean | null;
        history: {
          kind: string;
          status: string;
          decision_reason: string | null;
        }[];
        appeal_of_reviewer: boolean | null;
      })
    : null;
  return (
    <main className="shell" style={{ padding: "2rem 1rem" }}>
      <h1>Business verification</h1>
      <p>
        Restricted to granted reviewers with a verified authenticator. You
        cannot review a workspace you belong to, and an appeal needs a different
        reviewer. Every decision needs a reason and is audited.
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
      <div className="br-cols">
        <section aria-labelledby="h-q">
          <h2 id="h-q">Waiting ({items.length})</h2>
          {items.length === 0 ? (
            <p>No cases waiting.</p>
          ) : (
            <ul className="st-list">
              {items.map((x) => (
                <li
                  key={x.id}
                  className="st-item"
                  data-workspace={x.workspace_id}
                >
                  <Link href={`/admin/verification?case=${x.id}`}>
                    {x.brand}
                  </Link>{" "}
                  · {caseKinds[x.kind]} · {businessTypes[x.business_type]} ·{" "}
                  {day(x.submitted_at)}
                  {x.own ? " · your own workspace" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
        {d && (
          <section className="st-card" aria-labelledby="h-case">
            <h2 id="h-case">
              {String(d.brand)}{" "}
              <span className="st-hint">
                ({String(d.public_name)}, {String(d.country)})
              </span>
            </h2>
            <dl className="br-facts wide">
              {(
                [
                  "business_type",
                  "legal_name",
                  "registration_country",
                  "registration_number",
                  "registered_address",
                  "representative_name",
                  "representative_role",
                  "id_document_type",
                  "id_document_last4",
                  "website",
                  "contact_email",
                  "note",
                  "appeal_reason",
                ] as const
              )
                .filter((k) => d[k])
                .map((k) => (
                  <div key={k}>
                    <dt>
                      {(evidenceFields as Record<string, string>)[k] ??
                        k.replace(/_/g, " ")}
                    </dt>
                    <dd>{String(d[k])}</dd>
                  </div>
                ))}
            </dl>
            <p>
              Email domain matches website:{" "}
              <b>
                {d.domain_match === null
                  ? "not enough information"
                  : d.domain_match
                    ? "yes (supporting only)"
                    : "no"}
              </b>
            </p>
            {d.missing.length > 0 && (
              <p className="st-error">Missing: {d.missing.join(", ")}</p>
            )}
            {d.history.length > 0 && (
              <p className="st-hint">
                Earlier cases:{" "}
                {d.history
                  .map(
                    (h) =>
                      `${h.kind} ${h.status}${h.decision_reason ? ` (“${h.decision_reason}”)` : ""}`,
                  )
                  .join("; ")}
              </p>
            )}
            {d.appeal_of_reviewer && (
              <p className="st-error">
                You decided the original case, so another reviewer must decide
                this appeal.
              </p>
            )}
            <form action={act.reviewDecide} className="br-decide">
              <input type="hidden" name="id" value={String(d.id)} />
              <label htmlFor="rv-d">Decision</label>
              <select id="rv-d" name="decision">
                <option value="approved">Approve</option>
                <option value="info_requested">Ask for more information</option>
                <option value="rejected">Reject</option>
              </select>
              <label htmlFor="rv-r">Reason (shown to the Brand)</label>
              <textarea
                id="rv-r"
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                rows={3}
              />
              <button className="st-btn primary">Record decision</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
