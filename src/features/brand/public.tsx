import Link from "next/link";
import type { PublicBrand } from "@/server/brand/service";
import { platforms } from "./rules";
import "./brand.css";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
/** The published Brand profile (F46, F47). Only fields the Brand chose to publish; never legal or private planning data. */
export function PublicBrandPage({
  b,
  signedInCreator = false,
}: {
  b: PublicBrand;
  signedInCreator?: boolean;
}) {
  return (
    <>
      <header className="bp-hero">
        <p>
          <span className="br-pill">
            Business verified
            {b.verified_since ? ` since ${day(b.verified_since)}` : ""}
          </span>
          {b.industry ? <span className="br-pill">{b.industry}</span> : null}
          <span className="br-pill">{b.country}</span>
        </p>
        <h1>{b.name}</h1>
        {b.tagline && (
          <p>
            <b>{b.tagline}</b>
          </p>
        )}
        {b.website && (
          <p>
            <a
              href={b.website}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {b.website.replace(/^https:\/\//, "")}
            </a>
          </p>
        )}
      </header>
      {b.about && (
        <section className="bp-section" aria-labelledby="bp-about">
          <h2 id="bp-about">About</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{b.about}</p>
        </section>
      )}
      {b.products.length > 0 && (
        <section className="bp-section" aria-labelledby="bp-prod">
          <h2 id="bp-prod">Products and services</h2>
          <div className="bp-products">
            {b.products.map((p) => (
              <article key={p.name}>
                <h3>{p.name}</h3>
                <p className="st-hint">{p.kind}</p>
                {p.description && <p>{p.description}</p>}
                {p.url && (
                  <a
                    href={p.url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    Learn more
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {b.socials.length > 0 && (
        <section className="bp-section" aria-labelledby="bp-soc">
          <h2 id="bp-soc">On social media</h2>
          <p>
            {b.socials
              .map(
                (s) =>
                  `${platforms[s.platform as keyof typeof platforms] ?? s.platform} @${s.handle}`,
              )
              .join(" · ")}
          </p>
        </section>
      )}
      <section className="bp-section">
        <p className="st-hint">
          {b.live_campaigns} public campaign{b.live_campaigns === 1 ? "" : "s"}{" "}
          live on AURA.{" "}
          {signedInCreator ? null : (
            <Link href="/login">
              Creators: sign in to see campaigns and apply.
            </Link>
          )}
        </p>
      </section>
    </>
  );
}
