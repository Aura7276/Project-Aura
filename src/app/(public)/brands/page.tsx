import { Button } from "@/components/ui/button";
import { VisualSlot } from "@/components/public/visual-slot";
import { destinationPath } from "@/config/navigation";
import { rollout } from "@/config/collaborations";
import "./brands.css";
export const metadata = {
  title: "Brand Growth OS",
  description:
    "Explore planned tools for business-owned social channels, creator marketing and commercial coordination.",
};
function Registration() {
  return (
    <Button asChild>
      <a href={destinationPath("register")}>Brand registration ↗</a>
    </Button>
  );
}
const modes = [
  [
    "Marketing strategy",
    "Example brief",
    "“Our first product is ready. What could we publish this week?”",
    "Authored example guidance",
    "Choose one customer segment. Film a demonstration addressing its most common question, then review the replies before choosing a second topic.",
  ],
  [
    "Creator discovery",
    "Sample search criteria",
    "Language, region, niche and platform narrow the brief. Compare creative skills and portfolio samples alongside follower bands.",
    "Before an invitation",
    "Review UGC services, commercial preferences, availability and campaign eligibility using authorized information.",
  ],
  [
    "Campaign operations",
    "Example approval checklist",
    "Agree the objective, creative scope, usage rights and compensation before production.",
    "Handoff",
    "Review deliverables against the brief and record revisions separately from invoice and external settlement status.",
  ],
  [
    "Content planning & analytics",
    "Example editorial plan",
    "Choose a content pillar, draft a hook and script, then route the asset for internal approval.",
    "Learning question",
    "Which audience questions did the post answer? Compare observations from the same period and note gaps in reporting.",
  ],
];
const faq = [
  [
    "Can small businesses join?",
    "The planned Brand workspace serves individual owners, small businesses, startups, D2C brands and established teams. India is the primary market and eligible international businesses can participate.",
  ],
  [
    "Do I need an existing social media account?",
    "No. Begin with your business objectives, customer segments and available resources.",
  ],
  [
    "Can we use AURA without hiring creators?",
    "Yes. Private strategy, owned-channel planning and content production are part of the intended experience.",
  ],
  [
    "When is business verification required?",
    "Unverified businesses may use approved private planning tools. Formal campaign publication, invitations and commercial enquiries require verification for that workspace.",
  ],
  [
    "Can we commission UGC?",
    "UGC briefs can focus on production capability independently of audience size. Confirm eligibility, deliverables and usage rights for each brief.",
  ],
  [
    "How will we discover creators?",
    "The planned discovery tools combine authorized profile and portfolio information with audience fit, capabilities, location, language and availability.",
  ],
  ["Which campaign categories are planned?", rollout],
  [
    "Is AURA free to get started?",
    "Registration and basic Brand onboarding are planned to be free. Advanced tools may be paid later.",
  ],
  [
    "Does AURA process commercial payments?",
    "No. Initial commercial tools record external settlements. AURA does not collect, hold or process commercial funds.",
  ],
  [
    "Can marketing teams collaborate?",
    "Role-based team access is planned. Agency representation requires an explicit client delegation and scoped permissions.",
  ],
];
export default function Brands() {
  return (
    <article className="brand-book">
      <section className="brand-cover">
        <div>
          <p className="brand-label">AURA for business</p>
          <h1>Grow your brand beyond the campaign.</h1>
          <p>
            Build a presence on your own channels, commission original content
            and coordinate creator partnerships around one marketing plan.
          </p>
          <div className="brand-actions">
            <Registration />
            <a href="#brand-studio">Explore Brand Studio ↓</a>
          </div>
        </div>
        <VisualSlot
          asset="brand-hero"
          label="Reserved for a marketing team planning a product launch"
          caption="Brand planning session"
        />
      </section>
      <details className="capability">
        <summary>Campaign planning</summary>{" "}
        <section className="brand-spread">
          <h2>One brief, many moving parts.</h2>
          <div>
            <p>
              A lean team can lose its publishing rhythm between production,
              approvals and creator searches. When agreements sit in messages,
              it becomes hard to see what shipped, what worked and what is still
              owed.
            </p>
            <p>
              Brand Growth OS is planned around three connected jobs: grow owned
              channels, acquire UGC and creator-led promotion, and coordinate
              campaign execution, marketing intelligence and commercial records.
              Start with your own content even before hiring a creator.
            </p>
          </div>
        </section>
      </details>
      <section id="brand-studio" className="brand-studio">
        <header>
          <p className="brand-label">
            Illustrative workspace · Planned capabilities
          </p>
          <h2>Inside Brand Studio</h2>
          <p>Open a working note to explore the proposed workflow.</p>
        </header>
        <div>
          {modes.map(([title, a, b, c, d], i) => (
            <details key={title} name="brand-preview" open={i === 0}>
              <summary>{title}</summary>
              <dl>
                <dt>{a}</dt>
                <dd>{b}</dd>
                <dt>{c}</dt>
                <dd>{d}</dd>
              </dl>
            </details>
          ))}
        </div>
      </section>
      <details className="capability">
        <summary>Strategy and content</summary>{" "}
        <section className="brand-spread">
          <h2>A strategy shaped by your business.</h2>
          <div>
            <h3>AI Brand Growth Assistant</h3>
            <p>
              The planned assistant uses confirmed business context to develop
              positioning, customer segments and editable 7-, 30- and 90-day
              plans. Explore social growth, content ideas, creator
              recommendations and budget scenarios in English, Hindi or
              Hinglish. Performance analysis depends on the evidence available.
            </p>
            <h3>Brand Content Studio</h3>
            <p>
              Connect strategy and pillars to an idea library, hooks, scripts,
              captions and a production calendar. Internal approvals and asset
              management support manual publication, authorized repurposing and
              social analytics. Automatic publishing and advanced media
              generation are future capabilities.
            </p>
          </div>
        </section>
      </details>
      <details className="capability">
        <summary>Creator partnerships</summary>{" "}
        <section className="brand-feature">
          <p className="brand-label">Creator partnerships</p>
          <h2>
            Commission the craft.
            <br />
            Choose the right reach.
          </h2>
          <div>
            <section>
              <h3>Discovery for a specific brief</h3>
              <p>
                Consider niche, platform, language and market alongside follower
                bands. Review portfolio quality, creative capability, commercial
                preferences, availability and eligibility before outreach.
              </p>
            </section>
            <section>
              <h3>UGC for your own channels</h3>
              <p>
                Commission product demos, educational content and brand stories
                based on production skills. Define organic reuse and advertising
                rights in the agreement. Commissioning an asset does not grant
                unrestricted ownership or use.
              </p>
            </section>
          </div>
        </section>
      </details>
      <details className="capability">
        <summary>Campaign workflow</summary>{" "}
        <section className="brand-spread">
          <div>
            <p className="brand-label">Planned campaign workflow</p>
            <h2>From brief to review.</h2>
            <p>{rollout}</p>
          </div>
          <ol>
            {[
              "Define objectives and requirements",
              "Discover or invite eligible creators",
              "Review applications and proposals",
              "Select candidates against the brief",
              "Confirm the commercial agreement",
              "Coordinate deliverables, revisions and approvals",
              "Evaluate supported outcomes",
            ].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </details>
      <details className="capability">
        <summary>Reporting</summary>{" "}
        <section className="brand-ledger">
          <h2>Three different measures of progress</h2>
          {[
            [
              "Delivery",
              "Track fulfilment against agreed deliverables and approvals.",
            ],
            [
              "Marketing performance",
              "Review creator- and content-level observations, reporting coverage and campaign learnings. Document missing evidence before comparing commercial efficiency.",
            ],
            [
              "Commercial settlement",
              "Plan budgets, track creator compensation commitments and obligations, reconcile invoices with external payment records. AURA initially does not hold, collect or process funds.",
            ],
          ].map(([h, p]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </section>
      </details>
      <details className="capability">
        <summary>Team size</summary>{" "}
        <section className="brand-spread">
          <h2>Plan for the team you have.</h2>
          <div>
            <h3>New businesses</h3>
            <p>
              Set an audience and choose a manageable publishing cadence, even
              with no social accounts.
            </p>
            <h3>Growing brands</h3>
            <p>
              Use existing channel observations to decide where original content
              or commissioned UGC could help.
            </p>
            <h3>Established marketing teams</h3>
            <p>
              Align owned content, creator partnerships, approval roles and
              budgets. Engage an agency through explicit delegation where
              supported.
            </p>
          </div>
        </section>
      </details>
      <details className="capability">
        <summary>Brand journey</summary>{" "}
        <section className="brand-spread">
          <h2>Your Brand journey</h2>
          <ol>
            {[
              "Establish business identity and objectives.",
              "Develop a marketing strategy around your resources.",
              "Plan owned content and relevant creator campaigns.",
              "Coordinate production, approvals and commercial commitments.",
              "Measure supported outcomes and refine the next brief.",
            ].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </details>
      <section className="brand-spread">
        <h2>Brand questions</h2>
        <div>
          {faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="brand-close">
        <h2>Start with your business objective.</h2>
        <Registration />
      </section>
    </article>
  );
}
