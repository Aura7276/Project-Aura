import Link from "next/link";
import {
  availabilityLabels,
  downloadNotice,
  initials,
  kitSections,
  money,
  portfolioKinds,
  profileSections,
  rateNotice,
  relationships,
} from "./rules";
import type {
  KitContent,
  PublicAccount,
  PublicExperience,
  PublicItem,
  PublicPackage,
  PublicProfile,
  PublicService,
  PublicTestimonial,
} from "./types";
import { platformLabel } from "@/features/creator-social/catalogue";
import { metricLabel } from "@/features/creator-social/metrics";
import "./profile.css";

const sourceText = (s: string) =>
  s === "provider"
    ? "provider-derived"
    : s === "ai_confirmed"
      ? "AI-extracted, confirmed by the creator"
      : "self-reported";
export function Cover({ kind }: { kind: string }) {
  return (
    <div className="pf-cover" data-cover={kind} aria-hidden="true">
      {kind === "waves" && (
        <svg viewBox="0 0 1200 240" preserveAspectRatio="none">
          <path
            d="M0 160 C 200 100 400 220 600 160 S 1000 100 1200 150 V240 H0Z"
            fill="var(--pf-cover-b)"
            opacity="0.7"
          />
          <path
            d="M0 190 C 250 150 450 240 700 190 S 1050 150 1200 185 V240 H0Z"
            fill="var(--pf-cover-c)"
            opacity="0.8"
          />
        </svg>
      )}
      {kind === "aurora" && (
        <svg viewBox="0 0 1200 240" preserveAspectRatio="none">
          <circle cx="980" cy="40" r="160" fill="#ffffff" opacity="0.14" />
          <circle cx="180" cy="220" r="120" fill="#ffffff" opacity="0.1" />
        </svg>
      )}
    </div>
  );
}
function Accounts({ items }: { items: PublicAccount[] }) {
  return (
    <ul
      className="pf-meta"
      style={{ listStyle: "none", padding: 0, margin: 0 }}
      aria-label="Social accounts"
    >
      {items.map((a) => (
        <li key={a.ref_id} className="pf-chip">
          {platformLabel(a.platform)} @{a.handle}
          <span className="pf-small">
            ·{" "}
            {a.ownership === "verified"
              ? "ownership verified"
              : "ownership not verified"}
          </span>
          {a.followers && (
            <span className="pf-small">
              · {a.followers.value.toLocaleString("en-IN")} followers,
              self-reported {a.followers.observed_on}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
function Item({ i }: { i: PublicItem }) {
  return (
    <article className={`pf-card${i.featured ? " featured" : ""}`}>
      <div className="pf-thumb" aria-hidden="true">
        {portfolioKinds[i.kind]}
      </div>
      <div className="pf-meta" style={{ marginBottom: "0.4rem" }}>
        {i.featured && <span className="pf-chip">Featured</span>}
        {i.speculative ? (
          <span className="pf-chip" data-tone="label">
            Speculative, self-initiated: not commissioned
          </span>
        ) : (
          <span className="pf-chip" data-tone="label">
            {portfolioKinds[i.kind]}
          </span>
        )}
      </div>
      <h3>{i.title}</h3>
      {(i.brand_name || i.year) && (
        <p className="pf-small">
          {[i.brand_name, i.year].filter(Boolean).join(" · ")}
        </p>
      )}
      {i.description && <p>{i.description}</p>}
      {i.metrics && i.metrics.length > 0 && (
        <div className="pf-metrics" aria-label="Recorded metrics">
          {i.metrics.map((m) => (
            <span key={m.metric + m.window}>
              <strong>{m.value.toLocaleString("en-IN")}</strong>{" "}
              {metricLabel(m.metric).toLowerCase()}{" "}
              <span className="pf-small">
                (
                {m.window === "lifetime"
                  ? `lifetime as of ${m.observed_on}`
                  : `${m.period_start} to ${m.period_end}`}
                , {sourceText(m.source)})
              </span>
            </span>
          ))}
        </div>
      )}
      {i.link && (
        <p>
          <a href={i.link} rel="nofollow noopener noreferrer" target="_blank">
            View the original
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </article>
  );
}
function CaseStudy({ i }: { i: PublicItem }) {
  const c = i.case_study;
  return (
    <article className="pf-card">
      <h3>{i.title}</h3>
      {(i.brand_name || i.year) && (
        <p className="pf-small">
          {[i.brand_name, i.year].filter(Boolean).join(" · ")}
        </p>
      )}
      {i.description && <p>{i.description}</p>}
      {c && (
        <dl className="pf-case">
          {c.objective && (
            <div>
              <dt>Objective</dt>
              <dd>{c.objective}</dd>
            </div>
          )}
          {c.approach && (
            <div>
              <dt>Approach</dt>
              <dd>{c.approach}</dd>
            </div>
          )}
          {c.contribution && (
            <div>
              <dt>My contribution</dt>
              <dd>{c.contribution}</dd>
            </div>
          )}
          {c.deliverables.length > 0 && (
            <div>
              <dt>Deliverables</dt>
              <dd>
                <ul>
                  {c.deliverables.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {c.outcomes.length > 0 && (
            <div>
              <dt>Outcomes</dt>
              <dd>
                <ul>
                  {c.outcomes.map((o) => (
                    <li key={o.statement}>
                      {o.statement}{" "}
                      <span className="pf-small">
                        (
                        {o.source === "observation"
                          ? "from a recorded observation"
                          : "self-reported"}
                        )
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
function Services({
  items,
  withRates,
}: {
  items: PublicService[];
  withRates?: boolean;
}) {
  return (
    <div className="pf-grid">
      {items.map((s) => (
        <article key={s.ref_id} className="pf-card">
          <span className="pf-chip" data-tone="label">
            {s.kind === "ugc"
              ? "UGC"
              : s.kind === "influencer"
                ? "Influencer"
                : "Service"}
          </span>
          <h3 style={{ marginTop: "0.6rem" }}>{s.name}</h3>
          {s.description && <p>{s.description}</p>}
          {s.deliverables.length > 0 && (
            <ul>
              {s.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <p className="kit-price">
            {s.pricing.mode === "on_request" || s.pricing.mode === "quote"
              ? "Rates on request"
              : s.pricing.mode === "fixed"
                ? money(s.pricing.currency, s.pricing.min)
                : `${money(s.pricing.currency, s.pricing.min)} to ${money(s.pricing.currency, s.pricing.max)}`}
          </p>
          {withRates && s.pricing.mode !== "on_request" && (
            <p className="pf-small">{rateNotice}</p>
          )}
        </article>
      ))}
    </div>
  );
}
function Packages({ items }: { items: PublicPackage[] }) {
  return (
    <div className="pf-grid">
      {items.map((k) => (
        <article key={k.ref_id} className="pf-card">
          <h3>{k.name}</h3>
          {k.description && <p>{k.description}</p>}
          <ul>
            {k.deliverables.map((d) => (
              <li key={d.item}>
                {d.quantity} × {d.item}
              </li>
            ))}
          </ul>
          <p className="pf-small">
            {[
              k.turnaround_days && `${k.turnaround_days}-day turnaround`,
              k.revisions !== null &&
                `${k.revisions} revision${k.revisions === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {k.usage_rights && (
            <p className="pf-small">Usage: {k.usage_rights}</p>
          )}
          {k.terms && <p className="pf-small">Terms: {k.terms}</p>}
          <p className="kit-price">
            {k.price && k.price.min !== null
              ? k.price.max !== null && k.price.max !== k.price.min
                ? `${money(k.price.currency, k.price.min)} to ${money(k.price.currency, k.price.max)}`
                : money(k.price.currency, k.price.min)
              : "Price on request"}
          </p>
        </article>
      ))}
      <p className="pf-small" style={{ gridColumn: "1 / -1" }}>
        {rateNotice}
      </p>
    </div>
  );
}
function Experience({ items }: { items: PublicExperience[] }) {
  return (
    <ol className="pf-timeline">
      {items.map((e, n) => (
        <li key={e.organisation + n}>
          <h3>{e.role ? `${e.role}, ${e.organisation}` : e.organisation}</h3>
          <p className="pf-small">
            {[e.year_from, e.year_to].filter(Boolean).join(" to ") ||
              "Dates not given"}{" "}
            · self-reported
            {e.evidence_url ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={e.evidence_url}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  evidence link
                </a>
              </>
            ) : null}
          </p>
          {e.description && <p>{e.description}</p>}
        </li>
      ))}
    </ol>
  );
}
function Testimonials({ items }: { items: PublicTestimonial[] }) {
  return (
    <div className="pf-grid">
      {items.map((t, n) => (
        <figure key={n} className="pf-card" style={{ margin: 0 }}>
          <blockquote className="pf-quote" style={{ margin: 0 }}>
            {t.body}
          </blockquote>
          <figcaption className="pf-small">
            <strong>{t.author_name}</strong>
            {t.author_role ? `, ${t.author_role}` : ""} ·{" "}
            {relationships[t.relationship as keyof typeof relationships] ??
              t.relationship}{" "}
            · {t.date} · invited and moderated
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
function Availability({ a }: { a: PublicProfile["availability"] }) {
  return (
    <p>
      <span className="pf-chip" data-tone={a.status}>
        {availabilityLabels[a.status]}
      </span>{" "}
      {a.from && <span className="pf-small">from {a.from}</span>}{" "}
      {a.until && <span className="pf-small">until {a.until}</span>}{" "}
      {a.note && <span>{a.note}</span>}
    </p>
  );
}
export function ProfileSite({
  p,
  preview,
}: {
  p: PublicProfile;
  preview?: boolean;
}) {
  const blocks: Record<string, React.ReactNode> = {
    about: p.about ? (
      <section className="pf-section" aria-labelledby="s-about">
        <h2 id="s-about">{profileSections.about}</h2>
        <p
          style={{
            whiteSpace: "pre-line",
            maxWidth: "46rem",
            fontSize: "1.05rem",
          }}
        >
          {p.about}
        </p>
      </section>
    ) : null,
    portfolio: p.portfolio.length ? (
      <section className="pf-section" aria-labelledby="s-portfolio">
        <h2 id="s-portfolio">{profileSections.portfolio}</h2>
        <div className="pf-grid">
          {p.portfolio.map((i) => (
            <Item key={i.ref_id} i={i} />
          ))}
        </div>
      </section>
    ) : null,
    case_studies: p.case_studies.length ? (
      <section className="pf-section" aria-labelledby="s-cases">
        <h2 id="s-cases">{profileSections.case_studies}</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {p.case_studies.map((i) => (
            <CaseStudy key={i.ref_id} i={i} />
          ))}
        </div>
      </section>
    ) : null,
    services: p.services.length ? (
      <section className="pf-section" aria-labelledby="s-services">
        <h2 id="s-services">{profileSections.services}</h2>
        <Services items={p.services} />
      </section>
    ) : null,
    experience: p.experience.length ? (
      <section className="pf-section" aria-labelledby="s-exp">
        <h2 id="s-exp">{profileSections.experience}</h2>
        <Experience items={p.experience} />
      </section>
    ) : null,
    testimonials: p.testimonials.length ? (
      <section className="pf-section" aria-labelledby="s-test">
        <h2 id="s-test">{profileSections.testimonials}</h2>
        <Testimonials items={p.testimonials} />
      </section>
    ) : null,
    accounts: p.accounts.length ? (
      <section className="pf-section" aria-labelledby="s-acc">
        <h2 id="s-acc">{profileSections.accounts}</h2>
        <Accounts items={p.accounts} />
        <p className="pf-small" style={{ marginTop: "0.6rem" }}>
          Each indicator says exactly what was checked. Follower counts, when
          shown, are self-reported with their date.
        </p>
      </section>
    ) : null,
    availability: (
      <section className="pf-section" aria-labelledby="s-avail">
        <h2 id="s-avail">{profileSections.availability}</h2>
        <Availability a={p.availability} />
      </section>
    ),
  };
  return (
    <div className="pf" data-theme={p.theme}>
      {preview && (
        <div className="pf-banner" role="note">
          Preview: this is how your profile looks to visitors.{" "}
          <Link href="/creator/profile">Back to your profile settings</Link>
        </div>
      )}
      <Cover kind={p.cover} />
      <div className="pf-wrap">
        <header className="pf-hero">
          <div className="pf-avatar" aria-hidden="true">
            {initials(p.display_name)}
          </div>
          <h1>{p.display_name}</h1>
          {p.headline && <p className="pf-headline">{p.headline}</p>}
          <div className="pf-meta">
            {p.niche && <span className="pf-chip">{p.niche}</span>}
            <span className="pf-chip" data-tone={p.availability.status}>
              {availabilityLabels[p.availability.status]}
            </span>
            <span className="pf-small">aura · @{p.username}</span>
          </div>
          <div className="pf-actions no-print">
            <Link
              className="pf-btn"
              href={`/login?next=${encodeURIComponent(`/creator/${p.username}`)}`}
            >
              Work with {p.display_name.split(" ")[0]}
            </Link>
          </div>
          <p className="pf-small">
            Enquiries go through AURA. Brand outreach opens once Brand
            verification is available.
          </p>
        </header>
        <main id="profile">
          {p.section_order.map((k) => (
            <div key={k}>{blocks[k]}</div>
          ))}
        </main>
        <footer className="pf-foot">
          {p.show_branding && (
            <>
              Created with <Link href="/">AURA</Link> ·{" "}
            </>
          )}
          No rating or score is shown for any creator.
        </footer>
      </div>
    </div>
  );
}
export function KitDocument({
  c,
  banner,
}: {
  c: KitContent;
  banner?: React.ReactNode;
}) {
  const render = (s: KitContent["sections"][number]) => {
    const t = s.text as Record<string, unknown> | string | null;
    const items = s.items as never[];
    switch (s.key) {
      case "about": {
        const a = (t ?? {}) as {
          headline?: string;
          about?: string;
          niche?: string;
        };
        return a.headline || a.about ? (
          <>
            {a.headline && <p className="pf-headline">{a.headline}</p>}
            {a.about && <p style={{ whiteSpace: "pre-line" }}>{a.about}</p>}
            {a.niche && <span className="pf-chip">{a.niche}</span>}
          </>
        ) : null;
      }
      case "accounts":
        return items.length ? <Accounts items={items} /> : null;
      case "portfolio":
        return items.length ? (
          <div className="pf-grid">
            {(items as PublicItem[]).map((i) => (
              <Item key={i.ref_id} i={i} />
            ))}
          </div>
        ) : null;
      case "case_studies":
        return items.length ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {(items as PublicItem[]).map((i) => (
              <CaseStudy key={i.ref_id} i={i} />
            ))}
          </div>
        ) : null;
      case "services":
        return items.length ? (
          <Services items={items} withRates={c.rates_included} />
        ) : null;
      case "packages":
        return items.length ? <Packages items={items} /> : null;
      case "experience":
        return items.length ? <Experience items={items} /> : null;
      case "testimonials":
        return items.length ? <Testimonials items={items} /> : null;
      case "audience":
        return items.length ? (
          <div className="pf-grid">
            {(
              items as {
                dimension: string;
                buckets: { bucket: string; share: number }[];
                observed_on: string;
                source: string;
                coverage_pct: number | null;
              }[]
            ).map((a, n) => (
              <div key={n} className="pf-card">
                <h3>{a.dimension.replace("_", " ")}</h3>
                <ul>
                  {a.buckets.map((b) => (
                    <li key={b.bucket}>
                      {b.bucket}: {b.share}%
                    </li>
                  ))}
                </ul>
                <p className="pf-small">
                  Observed {a.observed_on}, {sourceText(a.source)}
                  {a.coverage_pct !== null
                    ? `, covers ${a.coverage_pct}% of the audience`
                    : ""}
                  .
                </p>
              </div>
            ))}
          </div>
        ) : null;
      case "availability":
        return t ? (
          <Availability a={t as unknown as PublicProfile["availability"]} />
        ) : null;
      case "contact":
        return (
          <p>{(typeof t === "string" && t) || "Get in touch through AURA."}</p>
        );
    }
  };
  return (
    <div className="pf" data-theme={c.creator.theme}>
      {banner}
      <div className="pf-wrap kit" data-template={c.kit.template}>
        <header className="kit-head">
          <p
            className="pf-small"
            style={{ color: "inherit", opacity: 0.85, margin: 0 }}
          >
            Media kit{c.kit.audience ? ` · ${c.kit.audience}` : ""}
          </p>
          <h1>{c.creator.display_name}</h1>
          <p style={{ margin: 0, fontWeight: 600 }}>{c.kit.name}</p>
          {c.kit.intro && <p style={{ margin: 0 }}>{c.kit.intro}</p>}
          {c.creator.username && (
            <p style={{ margin: 0 }}>
              <Link
                href={`/creator/${c.creator.username}`}
                style={{ color: "inherit" }}
              >
                Full profile
              </Link>
            </p>
          )}
        </header>
        {c.sections.map((s) => {
          const body = render(s);
          return body ? (
            <section
              key={s.key}
              className="pf-section"
              aria-labelledby={`k-${s.key}`}
            >
              <h2 id={`k-${s.key}`}>{kitSections[s.key]}</h2>
              {body}
            </section>
          ) : null;
        })}
        <footer className="pf-foot">
          {c.show_branding && (
            <>
              Created with <Link href="/">AURA</Link> ·{" "}
            </>
          )}
          {c.rates_included
            ? "Includes indicative rates shared with you privately. "
            : ""}
          {downloadNotice}
        </footer>
      </div>
    </div>
  );
}
