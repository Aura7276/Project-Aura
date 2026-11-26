import Link from "next/link";
import { notFound } from "next/navigation";
import { studioContext } from "@/server/studio/service";
import { profileApi, reasonText, type PReason } from "@/server/profile/service";
import { eligible } from "@/server/auth/session";
import * as act from "./actions";
import { EntityForm, OrderField, type FieldDef } from "./forms";
import { KitDocument, ProfileSite } from "./site";
import { steps } from "./completeness";
import { suggestions } from "./optimize";
import {
  availabilityLabels,
  covers,
  downloadNotice,
  kitSections,
  kitTemplates,
  money,
  portfolioKinds,
  pricingModes,
  profileSections,
  rateNotice,
  relationships,
  serviceKinds,
  testimonialStatus,
  themes,
  visibilities,
} from "./rules";
import type { Kit, PortfolioItem, ProfileState } from "./types";
import { platformLabel } from "@/features/creator-social/catalogue";
import { features as analyticsFeatures } from "@/features/creator-analytics/features";
import "./profile.css";

type SP = Record<string, string | string[] | undefined>;
const must = <T,>(
  r: { ok: true; value: T } | { ok: false; error: string },
): T => {
  if (!r.ok) throw new Error("profile:" + r.error);
  return r.value;
};
async function load() {
  const c = await studioContext();
  return { c, s: must(await profileApi.state(c.client, c.workspaceId)) };
}
const tabs: [string, string][] = [
  ["/creator/profile", "Overview"],
  ["/creator/profile/edit", "Details"],
  ["/creator/profile/appearance", "Appearance"],
  ["/creator/portfolio", "Portfolio"],
  ["/creator/services", "Services"],
  ["/creator/rates", "Rates"],
  ["/creator/media-kit", "Media kits"],
  ["/creator/profile/experience", "Experience"],
  ["/creator/profile/reviews", "Testimonials"],
  ["/creator/profile/verification", "Verification"],
  ["/creator/profile/privacy", "Privacy"],
  ["/creator/profile/availability", "Availability"],
  ["/creator/profile/analytics", "Analytics"],
  ["/creator/profile/optimize", "Suggestions"],
  ["/creator/profile/completeness", "Checklist"],
];
export function Tabs({ current }: { current: string }) {
  return (
    <nav aria-label="Profile and media kit" className="pf-studio-tabs">
      {tabs.map(([h, l]) => (
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
function Notice({ sp }: { sp: SP }) {
  const n = typeof sp.notice === "string" ? (sp.notice as PReason) : null;
  if (n)
    return (
      <p role="status" aria-live="polite" className="st-error">
        {reasonText[n] ?? reasonText.generic}
      </p>
    );
  const ok = [
    "updated",
    "deleted",
    "created",
    "revoked",
    "snapshot",
    "decided",
  ].find((k) => sp[k]);
  return (
    <p role="status" aria-live="polite" className="st-ok">
      {ok ? "Done." : ""}
    </p>
  );
}
const Head = ({
  title,
  lead,
  current,
  sp,
}: {
  title: string;
  lead?: string;
  current: string;
  sp?: SP;
}) => (
  <>
    <h1>{title}</h1>
    {lead && <p>{lead}</p>}
    <Tabs current={current} />
    {sp && <Notice sp={sp} />}
  </>
);
const Card = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="st-card" aria-labelledby={`${id}-h`}>
    <h2 id={`${id}-h`}>{title}</h2>
    {children}
  </section>
);
const Vis = ({ v }: { v: string }) => (
  <span className="st-badge">
    {v === "public" ? "Public" : v === "restricted" ? "Restricted" : "Private"}
  </span>
);

export async function HubView({ sp }: { sp: SP }) {
  const { s } = await load();
  const p = s.profile;
  const list = steps(s);
  const done = list.filter((x) => x.done).length;
  return (
    <main>
      <Head
        title="Profile and media kit"
        lead="Your creator website, portfolio, services and media kits. Everything is private until you publish or share it."
        current="/creator/profile"
        sp={sp}
      />
      <div className="st-grid">
        <Card
          id="status"
          title={
            p.published
              ? "Your profile is published"
              : "Your profile is private"
          }
        >
          {p.username ? (
            <p>
              Address: <code>/creator/{p.username}</code>
              {p.published && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/creator/${p.username}`}>Open public page</Link>
                </>
              )}
            </p>
          ) : (
            <p>
              Choose a username to get your address.{" "}
              <Link href="/creator/profile/edit">Choose one</Link>
            </p>
          )}
          <p>
            {p.published
              ? p.listed
                ? "Visible in creator discovery."
                : "Reachable only by people you send the link to. Not in discovery."
              : "Nobody can see it, including by direct link."}
          </p>
          <form action={act.publishProfile}>
            <input
              type="hidden"
              name="publish"
              value={p.published ? "no" : "yes"}
            />
            {!p.published && (
              <p>
                <label>
                  <input
                    type="checkbox"
                    name="listed"
                    disabled={!s.qualifies}
                  />{" "}
                  Also show me in creator discovery
                </label>
                <br />
                <span className="st-hint">
                  {s.qualifies
                    ? "Optional."
                    : "Discovery needs one of your own accounts with 100 or more followers (accounts are never added together). You can still publish and share your link."}
                </span>
              </p>
            )}
            <button className={`st-btn${p.published ? "" : " primary"}`}>
              {p.published
                ? "Unpublish (removes public access now)"
                : "Publish profile"}
            </button>
          </form>
          {p.published && !p.listed && s.qualifies && (
            <form action={act.publishProfile}>
              <input type="hidden" name="publish" value="yes" />
              <input type="hidden" name="listed" value="on" />
              <button className="st-btn">Show me in discovery</button>
            </form>
          )}
          {p.published && p.listed && (
            <form action={act.publishProfile}>
              <input type="hidden" name="publish" value="yes" />
              <button className="st-btn">Remove me from discovery</button>
            </form>
          )}
          <p>
            <Link href="/creator/profile/preview">Preview as a visitor</Link>
          </p>
        </Card>
        <Card id="steps" title="Next steps">
          <p className="st-hint">
            {done} of {list.length} done. This is a checklist, not a score, and
            it is never shown publicly.
          </p>
          <ul className="pf-steps">
            {list
              .filter((x) => !x.done)
              .slice(0, 4)
              .map((x) => (
                <li key={x.id}>
                  <span className="mark" aria-hidden="true" />
                  <span>
                    <Link href={x.href}>{x.label}</Link>
                    <br />
                    <span className="st-hint">{x.why}</span>
                  </span>
                </li>
              ))}
          </ul>
          <p>
            <Link href="/creator/profile/completeness">
              See the whole checklist
            </Link>
          </p>
        </Card>
        <Card id="glance" title="At a glance">
          <ul className="st-list">
            <li className="st-item">
              {s.portfolio.length} portfolio item
              {s.portfolio.length === 1 ? "" : "s"} (
              {s.portfolio.filter((i) => i.visibility === "public").length}{" "}
              public)
            </li>
            <li className="st-item">
              {s.services.length} service{s.services.length === 1 ? "" : "s"},{" "}
              {s.packages.length} package{s.packages.length === 1 ? "" : "s"}{" "}
              (rates private)
            </li>
            <li className="st-item">
              {s.testimonials.filter((t) => t.displayed).length} testimonial
              {s.testimonials.filter((t) => t.displayed).length === 1
                ? ""
                : "s"}{" "}
              shown
            </li>
            <li className="st-item">
              Availability: {availabilityLabels[p.availability]}
            </li>
          </ul>
          <p>
            <Link className="st-btn primary" href="/creator/media-kit/new">
              Create a media kit
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
export async function EditView({ sp }: { sp: SP }) {
  const { s } = await load();
  const p = s.profile;
  const fields: FieldDef[] = [
    {
      name: "username",
      label: "Username",
      value: p.username,
      max: 30,
      hint: "3 to 30 letters, numbers, dots, dashes or underscores. Your address becomes /creator/username. If you change it, the old one redirects for 30 days.",
      required: true,
    },
    {
      name: "headline",
      label: "Headline",
      value: p.headline,
      max: 120,
      hint: "One line about what you make and for whom.",
    },
    {
      name: "about",
      label: "About",
      type: "textarea",
      value: p.about,
      max: 2000,
      rows: 8,
    },
  ];
  return (
    <main>
      <Head title="Profile details" current="/creator/profile/edit" sp={sp} />
      <p className="st-hint">
        Your display name ({s.display_name ?? "not set"}) comes from your
        Creator profile. <Link href="/creator/studio">Change it</Link>.
      </p>
      <EntityForm
        action={act.saveProfile}
        fields={fields}
        submit="Save details"
        label="Profile details"
        idPrefix="pe"
      />
      {s.aliases.length > 0 && (
        <p className="st-hint">
          Redirecting:{" "}
          {s.aliases
            .map(
              (a) =>
                `/creator/${a.username} until ${a.expires_at.slice(0, 10)}`,
            )
            .join(", ")}
          .
        </p>
      )}
    </main>
  );
}
export async function AppearanceView({ sp }: { sp: SP }) {
  const { s } = await load();
  const p = s.profile;
  return (
    <main>
      <Head
        title="Appearance"
        lead="Approved themes and covers. Cover images are not uploaded yet: covers are patterns drawn in the browser."
        current="/creator/profile/appearance"
        sp={sp}
      />
      <EntityForm
        action={act.saveAppearance}
        label="Appearance"
        idPrefix="ap"
        submit="Save appearance"
        fields={[
          {
            name: "theme",
            label: "Theme",
            type: "select",
            options: themes,
            value: p.theme,
            required: true,
          },
          {
            name: "cover",
            label: "Cover",
            type: "select",
            options: covers,
            value: p.cover,
            required: true,
          },
          {
            name: "show_branding",
            label: "Show a small “Created with AURA” line",
            type: "checkbox",
            value: p.show_branding,
            hint: analyticsFeatures.reports
              ? "Removing it may become a premium option later. It is free to turn off for now."
              : "",
          },
        ]}
      >
        <OrderField
          name="section_order"
          initial={p.section_order}
          labels={profileSections}
        />
      </EntityForm>
      <p>
        <Link href="/creator/profile/preview">Preview</Link>
      </p>
    </main>
  );
}
export async function PreviewView() {
  const c = await studioContext();
  const r = await profileApi.preview(c.client, c.workspaceId);
  if (!r.ok || !r.value) notFound();
  const v = r.value;
  if (!v.username)
    return (
      <main>
        <Head title="Preview" current="/creator/profile/preview" />
        <p>
          Choose a username first.{" "}
          <Link href="/creator/profile/edit">Choose one</Link>
        </p>
      </main>
    );
  return <ProfileSite p={v} preview />;
}
export async function CompletenessView() {
  const { s } = await load();
  const list = steps(s);
  return (
    <main>
      <Head
        title="Profile checklist"
        lead="Concrete steps, not a score. Nothing here is shown publicly."
        current="/creator/profile/completeness"
      />
      <ul className="pf-steps">
        {list.map((x) => (
          <li key={x.id} className={x.done ? "done" : ""}>
            <span className="mark" aria-hidden="true">
              {x.done ? "✓" : ""}
            </span>
            <span>
              {x.done ? <s>{x.label}</s> : <Link href={x.href}>{x.label}</Link>}{" "}
              <span className="sr-only">{x.done ? "(done)" : "(to do)"}</span>
              <br />
              <span className="st-hint">{x.why}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
export async function OptimizeView() {
  const { s } = await load();
  const list = suggestions(s);
  return (
    <main>
      <Head
        title="Suggestions"
        lead="Rule-based suggestions from your own records. AI suggestions arrive with the Growth Assistant (M07), which is not available yet. Nothing is changed for you."
        current="/creator/profile/optimize"
      />
      {list.length === 0 ? (
        <p>No suggestions right now.</p>
      ) : (
        <ul className="st-list">
          {list.map((x) => (
            <li key={x.id} className="st-item">
              <strong>{x.title}</strong>
              <p>{x.detail}</p>
              <Link href={x.href}>Go there</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
export async function PrivacyView({ sp }: { sp: SP }) {
  const { s } = await load();
  const p = s.profile;
  const count = (v: string) =>
    s.portfolio.filter((i) => i.visibility === v).length;
  return (
    <main>
      <Head
        title="Privacy and visibility"
        current="/creator/profile/privacy"
        sp={sp}
      />
      <Card id="what" title="What each visibility means">
        <ul>
          <li>
            <strong>Private:</strong> only you.
          </li>
          <li>
            <strong>Restricted:</strong> only people you send a restricted
            media-kit link (they must sign in as the workspace you chose).
          </li>
          <li>
            <strong>Public:</strong> your published profile and any media-kit
            link.
          </li>
        </ul>
        <p>
          Portfolio: {count("public")} public, {count("restricted")} restricted,{" "}
          {count("private")} private. Rates are never public. Packages and
          audience information only appear in restricted links.
        </p>
        <p className="st-hint">{downloadNotice}</p>
      </Card>
      <Card id="counts" title="Follower counts">
        <form action={act.savePrivacy}>
          <p>
            <label>
              <input
                type="checkbox"
                name="show_follower_counts"
                defaultChecked={p.show_follower_counts}
              />{" "}
              Show follower counts next to accounts you publish (labelled
              self-reported, with the date)
            </label>
          </p>
          <button className="st-btn">Save</button>
        </form>
      </Card>
      <Card id="discovery" title="Publication and discovery">
        <p>
          {p.published
            ? p.listed
              ? "Published and in discovery."
              : "Published, not in discovery."
            : "Not published."}{" "}
          <Link href="/creator/profile">Change</Link>
        </p>
        <p className="st-hint">
          Unpublishing removes public access and discovery immediately.
          Media-kit links are separate and stay active until you revoke them or
          they expire.
        </p>
      </Card>
    </main>
  );
}
export async function AvailabilityView({ sp }: { sp: SP }) {
  const { s } = await load();
  const p = s.profile;
  return (
    <main>
      <Head
        title="Availability"
        current="/creator/profile/availability"
        sp={sp}
      />
      <EntityForm
        action={act.saveAvailability}
        label="Availability"
        idPrefix="av"
        submit="Save availability"
        fields={[
          {
            name: "availability",
            label: "Status",
            type: "select",
            options: availabilityLabels,
            value: p.availability,
            required: true,
          },
          {
            name: "available_from",
            label: "From",
            type: "date",
            value: p.available_from,
          },
          {
            name: "available_until",
            label: "Until",
            type: "date",
            value: p.available_until,
          },
          {
            name: "availability_note",
            label: "Note",
            value: p.availability_note,
            max: 200,
            hint: "For example: booking projects for March.",
          },
        ]}
      />
    </main>
  );
}
export async function VerificationView() {
  const { s } = await load();
  return (
    <main>
      <Head
        title="Verification and indicators"
        lead="AURA shows specific indicators only: exactly what was checked, for which account. There is no general “verified creator” badge and no rating."
        current="/creator/profile/verification"
      />
      {s.accounts.length === 0 ? (
        <p>
          No social accounts yet.{" "}
          <Link href="/creator/socials/new">Add one</Link>
        </p>
      ) : (
        <ul className="st-list">
          {s.accounts.map((a) => (
            <li key={a.id} className="st-item">
              <strong>
                {platformLabel(a.platform)} @{a.handle}
              </strong>
              <p>
                Ownership:{" "}
                {a.verification === "verified"
                  ? "verified by a reviewer"
                  : "not verified (self-reported)"}{" "}
                · On your profile:{" "}
                {a.sharing_visibility === "published" ? "shown" : "hidden"}
                {a.followers !== null
                  ? ` · ${a.followers.toLocaleString("en-IN")} followers self-reported on ${a.observed_on}`
                  : ""}
              </p>
              <Link
                href={`/creator/socials/${a.id}${a.verification === "verified" ? "" : "/verify"}`}
              >
                {a.verification === "verified"
                  ? "Manage account"
                  : "Verify ownership"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="st-hint">
        Collaboration indicators (work completed through AURA) appear once
        collaborations exist (M12). Experience you add is always labelled
        self-reported.
      </p>
    </main>
  );
}
export async function AnalyticsView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const days = sp.days === "90" ? 90 : sp.days === "7" ? 7 : 30;
  const a = must(await profileApi.analytics(c.client, c.workspaceId, days));
  const total = a.profile_views.reduce((n, v) => n + v.views, 0);
  return (
    <main>
      <Head
        title="Profile analytics"
        lead="Aggregate counts only. AURA stores no visitor identity; your own visits are not counted. A Brand is named only if its member chose to share that."
        current="/creator/profile/analytics"
      />
      <p>
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`?days=${d}`}
            aria-current={d === days ? "page" : undefined}
            style={{ marginRight: "1rem" }}
          >
            Last {d} days
          </Link>
        ))}
      </p>
      <div className="st-grid">
        <Card id="pv" title="Profile views">
          <p style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
            {total.toLocaleString("en-IN")}
          </p>
          <p className="st-hint">
            Over {a.days} days. Counts may include automated visitors.
          </p>
          {a.profile_views.length > 0 && (
            <details>
              <summary>By day</summary>
              <table className="pf-table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {a.profile_views.map((v) => (
                    <tr key={v.day}>
                      <td>{v.day}</td>
                      <td>{v.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </Card>
        <Card id="kv" title="Media-kit link views">
          {a.kit_views.length === 0 ? (
            <p>No links yet.</p>
          ) : (
            <ul className="st-list">
              {a.kit_views.map((k, n) => (
                <li key={n} className="st-item">
                  {k.kit} · {k.link}: {k.views}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card id="bv" title="Brands that chose to share a visit">
          {a.brand_visits.length === 0 ? (
            <p>None yet.</p>
          ) : (
            <ul className="st-list">
              {a.brand_visits.map((b, n) => (
                <li key={n} className="st-item">
                  {b.brand} viewed {b.kit} on {b.at.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card id="enq" title="Enquiries">
          <p>{a.enquiries}</p>
          <p className="st-hint">
            Enquiries are AURA-mediated and open once Brand verification (M14)
            is available.
          </p>
        </Card>
      </div>
    </main>
  );
}
// Portfolio
const itemFields = (
  i: Partial<PortfolioItem>,
  s: ProfileState,
  kind?: string,
): FieldDef[] => [
  {
    name: "kind",
    label: "What is it?",
    type: "select",
    options: portfolioKinds,
    value: i.kind ?? kind ?? "organic",
    required: true,
    hint: "Speculative work is always labelled “not commissioned”. Commercial work names the brand.",
  },
  { name: "title", label: "Title", value: i.title, max: 120, required: true },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    value: i.description,
    max: 2000,
  },
  {
    name: "brand_name",
    label: "Brand",
    value: i.brand_name,
    max: 100,
    showIf: { field: "kind", in: ["commercial", "case_study", "ugc_sample"] },
  },
  { name: "year", label: "Year", type: "number", value: i.year, min: 2000 },
  {
    name: "link",
    label: "Link to the original",
    type: "url",
    value: i.link,
    hint: "A full https:// link to where it is published.",
  },
  {
    name: "content_ref",
    label: "Connect recorded metrics",
    type: "select",
    options: {
      "": "None",
      ...Object.fromEntries(
        s.content.map((c) => [
          c.id,
          `${c.title} (${platformLabel(c.platform)})`,
        ]),
      ),
    },
    value: i.content_ref ?? "",
    hint: "From content you recorded in Social accounts. Metrics are shown only if you tick the box below, always with source and date.",
  },
  {
    name: "show_metrics",
    label: "Show the recorded metrics on this item",
    type: "checkbox",
    value: i.show_metrics,
  },
  {
    name: "objective",
    label: "Objective",
    type: "textarea",
    value: i.objective,
    max: 600,
    rows: 3,
    showIf: { field: "kind", in: ["case_study"] },
  },
  {
    name: "approach",
    label: "Approach",
    type: "textarea",
    value: i.approach,
    max: 1200,
    rows: 4,
    showIf: { field: "kind", in: ["case_study"] },
  },
  {
    name: "contribution",
    label: "Your contribution",
    type: "textarea",
    value: i.contribution,
    max: 600,
    rows: 3,
    showIf: { field: "kind", in: ["case_study"] },
  },
  {
    name: "deliverables",
    label: "Deliverables (one per line)",
    type: "lines",
    value: (i.deliverables ?? []).join("\n"),
    showIf: { field: "kind", in: ["case_study"] },
  },
  {
    name: "outcomes",
    label: "Outcomes (one per line)",
    type: "lines",
    value: (i.outcomes ?? []).map((o) => o.statement).join("\n"),
    hint: "Only what you can stand behind. Each outcome is labelled self-reported.",
    showIf: { field: "kind", in: ["case_study"] },
  },
  {
    name: "visibility",
    label: "Who can see it",
    type: "select",
    options: visibilities,
    value: i.visibility ?? "private",
    required: true,
  },
  {
    name: "featured",
    label: "Feature it (shown first)",
    type: "checkbox",
    value: i.featured,
  },
];
export async function PortfolioView({ sp }: { sp: SP }) {
  const { s } = await load();
  return (
    <main>
      <Head
        title="Portfolio"
        lead="Real work, labelled honestly. Items are private until you choose otherwise."
        current="/creator/portfolio"
        sp={sp}
      />
      <p>
        <Link className="st-btn primary" href="/creator/portfolio/new">
          Add a piece
        </Link>{" "}
        <Link className="st-btn" href="/creator/portfolio/new?kind=case_study">
          Add a case study
        </Link>
      </p>
      <p className="st-hint">
        Content Studio items (M08) can be added here once that module is merged.
        Uploads are switched off until private storage and malware scanning
        exist; link to where your work is published instead.
      </p>
      {s.portfolio.length === 0 ? (
        <p>No portfolio pieces yet.</p>
      ) : (
        <div className="st-grid">
          {s.portfolio.map((i) => (
            <div key={i.id} className="st-card">
              <h2 style={{ fontSize: "1.05rem" }}>
                <Link href={`/creator/portfolio/${i.id}`}>{i.title}</Link>
              </h2>
              <p>
                <Vis v={i.visibility} />{" "}
                <span className="st-badge">{portfolioKinds[i.kind]}</span>
                {i.featured && (
                  <>
                    {" "}
                    <span className="st-badge">Featured</span>
                  </>
                )}
              </p>
              {i.brand_name && <p className="st-hint">{i.brand_name}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
export async function PortfolioNewView({ sp }: { sp: SP }) {
  const { s } = await load();
  const kind =
    typeof sp.kind === "string" && sp.kind in portfolioKinds
      ? sp.kind
      : undefined;
  return (
    <main>
      <p>
        <Link href="/creator/portfolio">Portfolio</Link>
      </p>
      <h1>
        {kind === "case_study" ? "Add a case study" : "Add a portfolio piece"}
      </h1>
      <EntityForm
        action={act.saveItem}
        label="Portfolio piece"
        idPrefix="pi"
        submit="Save"
        fields={itemFields({}, s, kind)}
      />
    </main>
  );
}
export async function PortfolioItemView({ id, sp }: { id: string; sp: SP }) {
  const { s } = await load();
  const i = s.portfolio.find((x) => x.id === id);
  if (!i) notFound();
  return (
    <main>
      <p>
        <Link href="/creator/portfolio">Portfolio</Link>
      </p>
      <h1>{i.title}</h1>
      {sp.created && (
        <p className="st-ok" role="status">
          Saved.
        </p>
      )}
      <EntityForm
        action={act.saveItem}
        label="Portfolio piece"
        idPrefix="pi"
        submit="Save changes"
        fields={[
          { name: "id", label: "", type: "hidden", value: i.id },
          ...itemFields(i, s),
        ]}
      />
      <form action={act.deleteRecord}>
        <input type="hidden" name="kind" value="portfolio" />
        <input type="hidden" name="id" value={i.id} />
        <button className="st-btn">Delete this piece</button>
      </form>
    </main>
  );
}
// Services and rates
export async function ServicesView({ sp }: { sp: SP }) {
  const { s } = await load();
  const fields = (
    v: Partial<ProfileState["services"][number]> = {},
  ): FieldDef[] => [
    {
      name: "kind",
      label: "Type",
      type: "select",
      options: serviceKinds,
      value: v.kind ?? "influencer",
      required: true,
      hint: "UGC services are separate from influencer work and do not need a follower count.",
    },
    {
      name: "name",
      label: "Service name",
      value: v.name,
      max: 80,
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      value: v.description,
      max: 800,
      rows: 3,
    },
    {
      name: "deliverables",
      label: "What is included (one per line)",
      type: "lines",
      value: (v.deliverables ?? []).join("\n"),
    },
    {
      name: "pricing",
      label: "Pricing",
      type: "select",
      options: pricingModes,
      value: v.pricing ?? "quote",
      required: true,
    },
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
      value: v.currency ?? "INR",
      required: true,
      showIf: { field: "pricing", in: ["fixed", "range"] },
    },
    {
      name: "price_min",
      label: "Price (or lower end)",
      type: "number",
      value: v.price_min,
      min: 0,
      showIf: { field: "pricing", in: ["fixed", "range"] },
    },
    {
      name: "price_max",
      label: "Upper end",
      type: "number",
      value: v.price_max,
      min: 0,
      showIf: { field: "pricing", in: ["range"] },
    },
    {
      name: "visibility",
      label: "Who can see the service",
      type: "select",
      options: visibilities,
      value: v.visibility ?? "private",
      required: true,
    },
    {
      name: "rates_visibility",
      label: "Who can see its price",
      type: "select",
      options: {
        private: "Only you",
        restricted: "Restricted media-kit links that include rates",
      },
      value: v.rates_visibility ?? "private",
      required: true,
      hint: "Prices are never shown on your public profile.",
    },
  ];
  return (
    <main>
      <Head
        title="Services"
        lead="What brands can ask you for. Prices stay private unless you include them in a restricted link."
        current="/creator/services"
        sp={sp}
      />
      {s.services.map((v) => (
        <details key={v.id} className="st-card">
          <summary>
            <strong>{v.name}</strong> · {serviceKinds[v.kind]} ·{" "}
            <Vis v={v.visibility} /> ·{" "}
            {v.pricing === "quote"
              ? "quote on request"
              : v.pricing === "fixed"
                ? money(v.currency, v.price_min)
                : `${money(v.currency, v.price_min)} to ${money(v.currency, v.price_max)}`}
          </summary>
          <EntityForm
            action={act.saveService}
            label={`Edit ${v.name}`}
            idPrefix={`sv-${v.id.slice(0, 6)}`}
            submit="Save"
            fields={[
              { name: "id", label: "", type: "hidden", value: v.id },
              ...fields(v),
            ]}
          />
          <form action={act.deleteRecord}>
            <input type="hidden" name="kind" value="service" />
            <input type="hidden" name="id" value={v.id} />
            <button className="st-btn">Delete</button>
          </form>
        </details>
      ))}
      <Card id="new" title="Add a service">
        <EntityForm
          action={act.saveService}
          label="Add a service"
          idPrefix="svn"
          submit="Add service"
          fields={fields()}
        />
      </Card>
      <p className="st-hint">{rateNotice}</p>
    </main>
  );
}
export async function RatesView() {
  const { s } = await load();
  return (
    <main>
      <Head
        title="Rates"
        lead="Your indicative prices in one place. All of it is private by default."
        current="/creator/rates"
      />
      <Card id="svc" title="Service prices">
        {s.services.length === 0 ? (
          <p>
            No services yet. <Link href="/creator/services">Add one</Link>
          </p>
        ) : (
          <table className="pf-table">
            <caption className="sr-only">Service prices</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Price</th>
                <th scope="col">Who can see the price</th>
              </tr>
            </thead>
            <tbody>
              {s.services.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>
                    {v.pricing === "quote"
                      ? "On request"
                      : v.pricing === "fixed"
                        ? money(v.currency, v.price_min)
                        : `${money(v.currency, v.price_min)} to ${money(v.currency, v.price_max)}`}
                  </td>
                  <td>
                    {v.rates_visibility === "restricted"
                      ? "Restricted links with rates"
                      : "Only you"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card id="pk" title="Packages">
        <p>
          {s.packages.length} package{s.packages.length === 1 ? "" : "s"}.{" "}
          <Link href="/creator/rates/packages">Manage packages</Link>
        </p>
      </Card>
      <p className="st-hint">{rateNotice}</p>
    </main>
  );
}
export async function PackagesView({ sp }: { sp: SP }) {
  const { s } = await load();
  const fields = (
    k: Partial<ProfileState["packages"][number]> = {},
  ): FieldDef[] => [
    {
      name: "service_kind",
      label: "Type",
      type: "select",
      options: serviceKinds,
      value: k.service_kind ?? "influencer",
      required: true,
    },
    {
      name: "name",
      label: "Package name",
      value: k.name,
      max: 80,
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      value: k.description,
      max: 800,
      rows: 3,
    },
    {
      name: "deliverables",
      label: "Deliverables, one per line (for example: 3 x Reel)",
      type: "lines",
      value: (k.deliverables ?? [])
        .map((d) => `${d.quantity} x ${d.item}`)
        .join("\n"),
    },
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
      value: k.currency ?? "INR",
      required: true,
    },
    {
      name: "price_min",
      label: "Indicative price (or lower end)",
      type: "number",
      value: k.price_min,
      min: 0,
    },
    {
      name: "price_max",
      label: "Upper end",
      type: "number",
      value: k.price_max,
      min: 0,
    },
    {
      name: "turnaround_days",
      label: "Turnaround (days)",
      type: "number",
      value: k.turnaround_days,
      min: 1,
    },
    {
      name: "revisions",
      label: "Revisions included",
      type: "number",
      value: k.revisions,
      min: 0,
    },
    {
      name: "usage_rights",
      label: "Usage rights",
      type: "textarea",
      value: k.usage_rights,
      max: 400,
      rows: 2,
    },
    {
      name: "terms",
      label: "Terms",
      type: "textarea",
      value: k.terms,
      max: 1200,
      rows: 3,
      hint: "Indicative only. The actual terms are agreed for each collaboration.",
    },
    {
      name: "visibility",
      label: "Who can see it",
      type: "select",
      options: {
        private: "Only you",
        restricted: "Restricted media-kit links",
      },
      value: k.visibility ?? "private",
      required: true,
    },
  ];
  return (
    <main>
      <Head
        title="Packages"
        lead="Bundles with deliverables, indicative compensation and terms. Never public."
        current="/creator/rates"
        sp={sp}
      />
      <p>
        <Link href="/creator/rates">Rates</Link>
      </p>
      {s.packages.map((k) => (
        <details key={k.id} className="st-card">
          <summary>
            <strong>{k.name}</strong> ·{" "}
            {k.visibility === "restricted" ? "Restricted links" : "Only you"}
            {k.price_min !== null
              ? ` · ${money(k.currency, k.price_min)}${k.price_max !== null ? ` to ${money(k.currency, k.price_max)}` : ""}`
              : ""}
          </summary>
          <EntityForm
            action={act.savePackage}
            label={`Edit ${k.name}`}
            idPrefix={`pk-${k.id.slice(0, 6)}`}
            submit="Save"
            fields={[
              { name: "id", label: "", type: "hidden", value: k.id },
              ...fields(k),
            ]}
          />
          <form action={act.deleteRecord}>
            <input type="hidden" name="kind" value="package" />
            <input type="hidden" name="id" value={k.id} />
            <button className="st-btn">Delete</button>
          </form>
        </details>
      ))}
      <Card id="new" title="Add a package">
        <EntityForm
          action={act.savePackage}
          label="Add a package"
          idPrefix="pkn"
          submit="Add package"
          fields={fields()}
        />
      </Card>
      <p className="st-hint">{rateNotice}</p>
    </main>
  );
}
export async function ExperienceView({ sp }: { sp: SP }) {
  const { s } = await load();
  const fields = (
    e: Partial<ProfileState["experience"][number]> = {},
  ): FieldDef[] => [
    {
      name: "organisation",
      label: "Organisation or brand",
      value: e.organisation,
      max: 100,
      required: true,
    },
    { name: "role", label: "Your role", value: e.role, max: 100 },
    {
      name: "year_from",
      label: "From (year)",
      type: "number",
      value: e.year_from,
      min: 1990,
    },
    {
      name: "year_to",
      label: "To (year)",
      type: "number",
      value: e.year_to,
      min: 1990,
    },
    {
      name: "description",
      label: "What you did",
      type: "textarea",
      value: e.description,
      max: 800,
      rows: 3,
    },
    {
      name: "evidence_url",
      label: "Evidence link",
      type: "url",
      value: e.evidence_url,
      hint: "Optional, for example the published campaign. Shown as a link; AURA does not check it.",
    },
    {
      name: "visibility",
      label: "Who can see it",
      type: "select",
      options: visibilities,
      value: e.visibility ?? "private",
      required: true,
    },
  ];
  return (
    <main>
      <Head
        title="Experience"
        lead="Work outside AURA. Always labelled self-reported."
        current="/creator/profile/experience"
        sp={sp}
      />
      {s.experience.map((e) => (
        <details key={e.id} className="st-card">
          <summary>
            <strong>{e.organisation}</strong>
            {e.role ? `, ${e.role}` : ""} · <Vis v={e.visibility} />
          </summary>
          <EntityForm
            action={act.saveExperience}
            label={`Edit ${e.organisation}`}
            idPrefix={`ex-${e.id.slice(0, 6)}`}
            submit="Save"
            fields={[
              { name: "id", label: "", type: "hidden", value: e.id },
              ...fields(e),
            ]}
          />
          <form action={act.deleteRecord}>
            <input type="hidden" name="kind" value="experience" />
            <input type="hidden" name="id" value={e.id} />
            <button className="st-btn">Delete</button>
          </form>
        </details>
      ))}
      <Card id="new" title="Add experience">
        <EntityForm
          action={act.saveExperience}
          label="Add experience"
          idPrefix="exn"
          submit="Add"
          fields={fields()}
        />
      </Card>
    </main>
  );
}
export async function ReviewsView({ sp }: { sp: SP }) {
  const { s } = await load();
  return (
    <main>
      <Head
        title="Testimonials"
        lead="Only real people you worked with can write one, through an invitation. You cannot write or edit them. A reviewer checks each one before you can choose to show it."
        current="/creator/profile/reviews"
        sp={sp}
      />
      <Card id="invite" title="Invite a testimonial">
        <EntityForm
          action={act.createInvite}
          label="Invite a testimonial"
          idPrefix="inv"
          submit="Create invitation link"
          fields={[
            {
              name: "label",
              label: "Who is it for (only you see this)",
              max: 100,
            },
          ]}
        />
        <p className="st-hint">
          Invitations expire after 30 days and work once. The person must sign
          in to AURA.
        </p>
      </Card>
      <Card id="list" title="Testimonials">
        {s.testimonials.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <ul className="st-list">
            {s.testimonials.map((t) => (
              <li key={t.id} className="st-item">
                <blockquote style={{ margin: 0 }}>{t.body}</blockquote>
                <p className="st-hint">
                  {t.author_name}
                  {t.author_role ? `, ${t.author_role}` : ""} ·{" "}
                  {relationships[t.relationship as keyof typeof relationships]}{" "}
                  · {testimonialStatus[t.status]}
                  {t.displayed ? " · shown on your profile" : ""}
                  {t.decision_reason ? ` · reviewer: ${t.decision_reason}` : ""}
                </p>
                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  {t.status === "approved" && (
                    <form action={act.testimonialAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input
                        type="hidden"
                        name="action"
                        value={t.displayed ? "hide" : "show"}
                      />
                      <button className="st-btn">
                        {t.displayed ? "Hide" : "Show on my profile"}
                      </button>
                    </form>
                  )}
                  {(t.status === "approved" || t.status === "pending") && (
                    <form action={act.testimonialAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="action" value="dispute" />
                      <label className="sr-only" htmlFor={`r-${t.id}`}>
                        Reason
                      </label>
                      <input
                        id={`r-${t.id}`}
                        name="reason"
                        placeholder="Why is it wrong?"
                        required
                        minLength={5}
                        maxLength={500}
                      />
                      <button className="st-btn">Dispute</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {s.invites.length > 0 && (
        <Card id="inv-list" title="Invitations">
          <ul className="st-list">
            {s.invites.map((v) => (
              <li key={v.id} className="st-item">
                {v.label ?? "Invitation"} ·{" "}
                {v.used_at
                  ? "used"
                  : v.revoked_at
                    ? "revoked"
                    : new Date(v.expires_at) < new Date()
                      ? "expired"
                      : `open until ${v.expires_at.slice(0, 10)}`}
                {!v.used_at && !v.revoked_at && (
                  <form action={act.revokeInvite} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={v.id} />{" "}
                    <button className="st-btn">Revoke</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
// Media kits
export async function KitsView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const kits = must(await profileApi.kits(c.client, c.workspaceId));
  return (
    <main>
      <Head
        title="Media kits"
        lead="Make a kit for each audience, industry or service. Share it as a web page, a PDF or a QR code, with links you can expire or revoke."
        current="/creator/media-kit"
        sp={sp}
      />
      <p>
        <Link className="st-btn primary" href="/creator/media-kit/new">
          Create a media kit
        </Link>
      </p>
      {kits.length === 0 ? (
        <p>No media kits yet.</p>
      ) : (
        <div className="st-grid">
          {kits.map((k) => (
            <div key={k.id} className="st-card">
              <h2 style={{ fontSize: "1.05rem" }}>{k.name}</h2>
              <p className="st-hint">
                {k.audience ?? "No audience set"} · {kitTemplates[k.template]} ·{" "}
                {k.shares.filter((h) => h.active).length} active link
                {k.shares.filter((h) => h.active).length === 1
                  ? ""
                  : "s"} · {k.versions.length} snapshot
                {k.versions.length === 1 ? "" : "s"}
              </p>
              <p>
                <Link href={`/creator/media-kit/${k.id}/edit`}>Edit</Link> ·{" "}
                <Link href={`/creator/media-kit/${k.id}/share`}>Share</Link> ·{" "}
                <Link href={`/creator/media-kit/${k.id}/history`}>History</Link>
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="st-hint">
        AI help for writing kits arrives with the Growth Assistant (M07). You
        write and choose everything here.
      </p>
    </main>
  );
}
export async function KitNewView() {
  await studioContext();
  return (
    <main>
      <p>
        <Link href="/creator/media-kit">Media kits</Link>
      </p>
      <h1>Create a media kit</h1>
      <EntityForm
        action={act.createKit}
        label="Create a media kit"
        idPrefix="kn"
        submit="Create kit"
        fields={[
          {
            name: "name",
            label: "Kit name",
            max: 80,
            required: true,
            hint: "For example: Travel and hospitality 2026",
          },
          { name: "audience", label: "Who is it for", max: 120 },
          {
            name: "template",
            label: "Template",
            type: "select",
            options: kitTemplates,
            value: "editorial",
            required: true,
          },
          {
            name: "intro",
            label: "Introduction",
            type: "textarea",
            max: 800,
            rows: 3,
          },
          { name: "contact_note", label: "How to work with you", max: 300 },
        ]}
      />
    </main>
  );
}
async function loadKit(id: string) {
  const c = await studioContext();
  const k = must(await profileApi.kits(c.client, c.workspaceId, id))[0];
  if (!k) notFound();
  return { c, k };
}
export async function KitEditView({ id, sp }: { id: string; sp: SP }) {
  const { c, k } = await loadKit(id);
  const s = must(await profileApi.state(c.client, c.workspaceId));
  const restricted = sp.view === "restricted";
  const preview = must(
    await profileApi.kitPreview(
      c.client,
      c.workspaceId,
      id,
      restricted,
      restricted,
    ),
  );
  const options: Partial<
    Record<string, { id: string; label: string; vis: string }[]>
  > = {
    portfolio: s.portfolio
      .filter((i) => i.kind !== "case_study" && i.visibility !== "private")
      .map((i) => ({ id: i.id, label: i.title, vis: i.visibility })),
    case_studies: s.portfolio
      .filter((i) => i.kind === "case_study" && i.visibility !== "private")
      .map((i) => ({ id: i.id, label: i.title, vis: i.visibility })),
    services: s.services
      .filter((x) => x.visibility !== "private")
      .map((x) => ({ id: x.id, label: x.name, vis: x.visibility })),
    packages: s.packages
      .filter((x) => x.visibility === "restricted")
      .map((x) => ({ id: x.id, label: x.name, vis: "restricted" })),
    experience: s.experience
      .filter((x) => x.visibility !== "private")
      .map((x) => ({ id: x.id, label: x.organisation, vis: x.visibility })),
    testimonials: s.testimonials
      .filter((x) => x.displayed)
      .map((x) => ({
        id: x.id,
        label: `${x.author_name}: ${x.body.slice(0, 50)}…`,
        vis: "public",
      })),
    accounts: s.accounts
      .filter((x) => x.sharing_visibility === "published")
      .map((x) => ({
        id: x.id,
        label: `${platformLabel(x.platform)} @${x.handle}`,
        vis: "public",
      })),
  };
  return (
    <main>
      <p>
        <Link href="/creator/media-kit">Media kits</Link>
      </p>
      <h1>{k.name}</h1>
      <p>
        <Link href={`/creator/media-kit/${id}/share`}>Share</Link> ·{" "}
        <Link href={`/creator/media-kit/${id}/history`}>
          History and snapshots
        </Link>
      </p>
      {sp.created && (
        <p className="st-ok" role="status">
          Kit created with every eligible section. Choose what to include.
        </p>
      )}
      <EntityForm
        action={act.saveKit}
        label="Edit media kit"
        idPrefix="ke"
        submit="Save kit"
        fields={[
          { name: "id", label: "", type: "hidden", value: id },
          {
            name: "section_keys",
            label: "",
            type: "hidden",
            value: k.sections.map((x) => x.key).join(","),
          },
          {
            name: "name",
            label: "Kit name",
            value: k.name,
            max: 80,
            required: true,
          },
          {
            name: "audience",
            label: "Who is it for",
            value: k.audience,
            max: 120,
          },
          {
            name: "template",
            label: "Template",
            type: "select",
            options: kitTemplates,
            value: k.template,
            required: true,
          },
          {
            name: "intro",
            label: "Introduction",
            type: "textarea",
            value: k.intro,
            max: 800,
            rows: 3,
          },
          {
            name: "contact_note",
            label: "How to work with you",
            value: k.contact_note,
            max: 300,
          },
        ]}
      >
        <fieldset>
          <legend>Sections</legend>
          <p className="st-hint">
            Private items never appear. Restricted items, packages, audience
            information and rates appear only in restricted links.
          </p>
          {k.sections.map((sec) => {
            const opts = options[sec.key];
            return (
              <div key={sec.key} className="st-item">
                <label>
                  <input
                    type="checkbox"
                    name={`enabled_${sec.key}`}
                    defaultChecked={sec.enabled}
                  />{" "}
                  <strong>{kitSections[sec.key]}</strong>
                </label>
                {opts && opts.length > 0 && (
                  <details>
                    <summary>
                      Choose items (
                      {sec.item_ids
                        ? `${sec.item_ids.length} chosen`
                        : "all eligible"}
                      )
                    </summary>
                    <p>
                      <label>
                        <input
                          type="radio"
                          name={`mode_${sec.key}`}
                          value="all"
                          defaultChecked={!sec.item_ids}
                        />{" "}
                        All eligible
                      </label>{" "}
                      <label>
                        <input
                          type="radio"
                          name={`mode_${sec.key}`}
                          value="chosen"
                          defaultChecked={!!sec.item_ids}
                        />{" "}
                        Only these:
                      </label>
                    </p>
                    {opts.map((o) => (
                      <label key={o.id} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          name={`items_${sec.key}`}
                          value={o.id}
                          defaultChecked={sec.item_ids?.includes(o.id) ?? false}
                        />{" "}
                        {o.label} <span className="st-hint">({o.vis})</span>
                      </label>
                    ))}
                  </details>
                )}
                {opts && opts.length === 0 && (
                  <p className="st-hint">Nothing eligible yet.</p>
                )}
              </div>
            );
          })}
        </fieldset>
      </EntityForm>
      <h2>Preview</h2>
      <p>
        {restricted ? (
          <>
            Showing a <strong>restricted link with rates</strong>.{" "}
            <Link href="?">Show the public-link version</Link>
          </>
        ) : (
          <>
            Showing a <strong>public link</strong>.{" "}
            <Link href="?view=restricted">
              Show the restricted version with rates
            </Link>
          </>
        )}
      </p>
      <div
        style={{
          border: "1px solid #dad6d5",
          borderRadius: "1rem",
          overflow: "hidden",
        }}
      >
        <KitDocument c={preview} />
      </div>
    </main>
  );
}
export async function KitShareView({ id, sp }: { id: string; sp: SP }) {
  const { k } = await loadKit(id);
  return (
    <main>
      <p>
        <Link href="/creator/media-kit">Media kits</Link> ·{" "}
        <Link href={`/creator/media-kit/${id}/edit`}>Edit {k.name}</Link>
      </p>
      <h1>Share {k.name}</h1>
      <Notice sp={sp} />
      <Card id="new" title="Create a link">
        <EntityForm
          action={act.createShare}
          label="Create a share link"
          idPrefix="sh"
          submit="Create link"
          fields={[
            { name: "id", label: "", type: "hidden", value: id },
            {
              name: "kind",
              label: "Link type",
              type: "select",
              options: {
                public: "Public: anyone with the link",
                restricted:
                  "Restricted: only a Brand or Agency workspace you name, signed in",
              },
              value: "public",
              required: true,
            },
            {
              name: "recipient",
              label: "Recipient workspace id",
              showIf: { field: "kind", in: ["restricted"] },
              hint: "Ask the Brand or Agency for their AURA workspace id.",
            },
            {
              name: "include_rates",
              label: "Include rates and packages",
              type: "checkbox",
              showIf: { field: "kind", in: ["restricted"] },
              hint: "Only restricted links can carry rates.",
            },
            {
              name: "version",
              label: "Content",
              type: "select",
              options: {
                "": "Live: always the current kit",
                ...Object.fromEntries(
                  k.versions.map((v) => [
                    v.id,
                    `Snapshot ${v.version}${v.note ? `: ${v.note}` : ""}`,
                  ]),
                ),
              },
              value: "",
              hint: "A snapshot stays as it was, except anything you later make private still disappears.",
            },
            { name: "label", label: "Label (only you see it)", max: 100 },
            {
              name: "days",
              label: "Expires after (days)",
              type: "number",
              min: 1,
              hint: "Restricted links expire after 30 days unless you choose otherwise; public links do not expire unless you set this.",
            },
          ]}
        />
        <p className="st-hint">{downloadNotice}</p>
      </Card>
      <Card id="links" title="Links">
        {k.shares.length === 0 ? (
          <p>No links yet.</p>
        ) : (
          <ul className="st-list">
            {k.shares.map((h) => (
              <li key={h.id} className="st-item">
                <strong>
                  {h.label ??
                    (h.kind === "public" ? "Public link" : "Restricted link")}
                </strong>{" "}
                · {h.kind}
                {h.include_rates ? " · with rates" : ""}
                {h.version_id ? " · snapshot" : " · live"} ·{" "}
                {h.active
                  ? h.expires_at
                    ? `active until ${h.expires_at.slice(0, 10)}`
                    : "active"
                  : h.revoked_at
                    ? "revoked"
                    : "expired"}{" "}
                · {h.views} view{h.views === 1 ? "" : "s"}
                {h.brand_visits
                  ? ` · ${h.brand_visits} Brand visit${h.brand_visits === 1 ? "" : "s"} shared`
                  : ""}
                {h.active && (
                  <form action={act.revokeShare}>
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="kit" value={id} />
                    <button className="st-btn">Revoke now</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="st-hint">
          For your security the full link is shown only once, when you create
          it. Create a new link if you lose one.
        </p>
      </Card>
    </main>
  );
}
export async function KitHistoryView({ id, sp }: { id: string; sp: SP }) {
  const { k } = await loadKit(id);
  return (
    <main>
      <p>
        <Link href="/creator/media-kit">Media kits</Link> ·{" "}
        <Link href={`/creator/media-kit/${id}/edit`}>Edit {k.name}</Link>
      </p>
      <h1>History of {k.name}</h1>
      <Notice sp={sp} />
      <Card id="snap" title="Take a snapshot">
        <form action={act.snapshotKit}>
          <input type="hidden" name="id" value={id} />
          <div className="st-field">
            <label htmlFor="sn">Note</label>
            <input id="sn" name="note" maxLength={200} />
          </div>
          <button className="st-btn primary">Save a fixed snapshot</button>
        </form>
        <p className="st-hint">
          Links can point to a snapshot so the content stays fixed. Anything you
          later make private still disappears from it.
        </p>
      </Card>
      <Card id="list" title="Snapshots">
        {k.versions.length === 0 ? (
          <p>No snapshots yet.</p>
        ) : (
          <ul className="st-list">
            {k.versions.map((v) => (
              <li key={v.id} className="st-item">
                Snapshot {v.version} ·{" "}
                {v.created_at.slice(0, 16).replace("T", " ")}
                {v.note ? ` · ${v.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card id="del" title="Delete this kit">
        <form action={act.deleteRecord}>
          <input type="hidden" name="kind" value="kit" />
          <input type="hidden" name="id" value={id} />
          <p className="st-hint">
            Deleting the kit turns off every link to it.
          </p>
          <button className="st-btn">Delete kit</button>
        </form>
      </Card>
    </main>
  );
}
export async function ModerationView({ sp }: { sp: SP }) {
  const { client } = await eligible();
  const q = await profileApi.moderationQueue(client);
  if (!q.ok) notFound();
  return (
    <main className="shell" style={{ padding: "2rem 1rem" }}>
      <h1>Testimonial moderation</h1>
      <p>
        Restricted to granted reviewers with a verified authenticator. You
        cannot moderate a testimonial you wrote or one about your own workspace.
        The text is never edited.
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
      {q.value.length === 0 ? (
        <p>Nothing is waiting.</p>
      ) : (
        <ul>
          {q.value.map((t) => (
            <li key={t.id} style={{ marginBottom: "1.5rem" }}>
              <p>
                <strong>{t.creator}</strong> · {t.status}
                {t.dispute_reason ? ` · disputed: ${t.dispute_reason}` : ""}
              </p>
              <blockquote>{t.body}</blockquote>
              <p>
                by {t.author_name} ({t.relationship})
              </p>
              <form action={act.moderate}>
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor={`d-${t.id}`}>Decision</label>{" "}
                <select id={`d-${t.id}`} name="decision">
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="removed">Remove</option>
                </select>{" "}
                <label htmlFor={`r-${t.id}`}>Reason</label>{" "}
                <input
                  id={`r-${t.id}`}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />{" "}
                <button>Record decision</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
export type { Kit };
