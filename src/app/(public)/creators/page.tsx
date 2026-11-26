import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioPreview } from "@/components/public/studio-preview";
import { VisualSlot } from "@/components/public/visual-slot";
import { destinationPath } from "@/config/navigation";
import { rollout } from "@/config/collaborations";
import "./creator.css";
export const metadata = {
  title: "Creator Growth OS",
  description:
    "Explore AURA’s planned Creator tools for creative practice, portfolio building and eligible collaborations.",
};
function Register() {
  return (
    <Button asChild>
      <a href={destinationPath("register")}>
        Creator registration <ArrowUpRight />
      </a>
    </Button>
  );
}
const previews = [
  [
    "Growth",
    "Plan a creative experiment",
    "Illustrative coaching exchange",
    "Creator: I can film twice this week. Where should I start?",
    "Example guidance: Try two openings for the same tutorial. Keep the format consistent and review the responses.",
  ],
  [
    "Analytics",
    "Learn from each post",
    "Illustrative experiment worksheet",
    "Question: Does showing the finished piece first help viewers stay?",
    "Compare similar posts over the same window. Record the observation date and source, then choose the next experiment.",
  ],
  [
    "Content",
    "From idea to publish day",
    "Illustrative weekly planner",
    "Monday · Choose a pillar and test a hook. Tuesday · Draft the script, storyboard and shot list.",
    "Thursday · Film and review. Saturday · Add captions, schedule your post and write down what you learned.",
  ],
] as const;
const faq = [
  [
    "Can I join without followers?",
    "Yes. The planned aspiring Creator path starts with goals and practice, even with no social account.",
  ],
  [
    "Do I need to connect Instagram?",
    "No. Manual observations and content planning support growth without an Instagram connection. Automatic social integrations are deferred.",
  ],
  [
    "Can I join with a personal Instagram account?",
    "Yes. Personal, Creator and Business Instagram accounts are supported by the approved onboarding plan.",
  ],
  [
    "Can I manage multiple social accounts?",
    "The plan supports up to ten accounts initially, including multiple accounts on one platform, with one overall primary account.",
  ],
  [
    "What is the 100-follower requirement?",
    "Standard influencer discovery and opportunities require at least 100 followers on one applicable account. Campaign-specific eligibility and selection still apply.",
  ],
  [
    "Can I become a UGC creator?",
    "UGC eligibility is assessed separately using creative capabilities and the brief. A large following is unnecessary.",
  ],
  [
    "Is AURA free to get started?",
    "Core Creator growth tools and eligible applications are planned to be free initially. Advanced capabilities may become paid.",
  ],
  [
    "Does AURA guarantee collaborations?",
    "No. Eligibility allows consideration. Fit, availability and the Brand’s selection determine the outcome.",
  ],
  [
    "Does AURA process Creator payments?",
    "No. Initial commercial tools record agreements and externally settled payments. AURA does not hold funds.",
  ],
  [
    "Who controls my profile and private information?",
    "You decide when to publish your profile and which professional details to share. Private goals and coaching conversations stay outside Brand-facing profiles.",
  ],
];
export default function Creators() {
  return (
    <article className="creator-page">
      <section className="creator-hero">
        <div>
          <p className="overline">AURA / Creator Growth OS</p>
          <h1>
            You create.
            <br />
            We help you <em>grow.</em>
          </h1>
          <p>
            Give your next idea a plan, your best work a portfolio and your next
            collaboration a clear brief.
          </p>
          <div className="creator-actions">
            <Register />
            <a href="#studio">Explore the studio ↓</a>
          </div>
        </div>
        <VisualSlot
          asset="creator-hero"
          label="Reserved for a portrait of a creator at work"
        />
      </section>
      <details className="capability">
        <summary>Creative practice</summary>{" "}
        <section className="spread">
          <h2>Make room for the work.</h2>
          <div>
            <p>
              When ideas run dry or your schedule slips, a small experiment
              gives you somewhere to start. Learn which formats connect with
              your audience and what deserves another try.
            </p>
            <p>
              Turn scattered samples into a media kit. Find briefs that fit your
              skills and keep negotiations, revisions and payment records
              together.
            </p>
          </div>
        </section>
      </details>
      <section id="studio" className="studio-sample">
        <p className="overline">Illustrative studio · Planned tools</p>
        <h2>Your creative workbench</h2>
        <StudioPreview notes={previews} />
      </section>
      <details className="capability">
        <summary>Studio tools</summary>{" "}
        <section className="feature-lines">
          {[
            [
              "AI Growth Assistant",
              "Choose a 7-, 30- or 90-day plan. Planned coaching in English, Hindi and Hinglish combines content ideas, growth diagnostics and daily priorities with your own goals, even without connected accounts.",
            ],
            [
              "Social analytics & growth",
              "Compare account and content performance, track a meaningful goal and look for patterns backed by observations. Run a structured experiment and revisit the evidence over time.",
            ],
            [
              "Content Studio",
              "Collect ideas in a library, organize content pillars and turn hooks into scripts, captions, storyboards and shot lists. A calendar connects production planning, creative review and content experiments.",
            ],
          ].map(([h, p]) => (
            <div key={h}>
              <h2>{h}</h2>
              <p>{p}</p>
            </div>
          ))}
        </section>
      </details>
      <details className="capability">
        <summary>Media kit</summary>{" "}
        <section className="kit spread">
          <div>
            <p className="overline">Professional identity</p>
            <h2>A portfolio you control.</h2>
            <p>
              The planned personal AURA profile URL brings your portfolio,
              creative services, UGC samples and optional rates together.
              Publish and share only what you authorize.
            </p>
          </div>
          <aside>
            <small>Illustrative media kit</small>
            <span className="initials" aria-label="Neutral sample avatar">
              C
            </span>
            <h3>Creator portfolio</h3>
            <dl>
              <dt>Selected work</dt>
              <dd>UGC samples & creative projects</dd>
              <dt>Services</dt>
              <dd>Formats, scope & optional rate card</dd>
              <dt>Sharing</dt>
              <dd>Private until published</dd>
            </dl>
          </aside>
        </section>
      </details>
      <details className="capability">
        <summary>Campaign eligibility</summary>{" "}
        <section className="spread">
          <h2>Find a brief that fits.</h2>
          <div>
            <p>{rollout}</p>
            <p>
              Discovery will consider capabilities, preferences and campaign
              eligibility. These workflows are in development.
            </p>
          </div>
        </section>
      </details>
      <details className="capability">
        <summary>Creator stages</summary>{" "}
        <section className="stages">
          <h2>Start where you are.</h2>
          <p>
            Aspiring creators can develop a practice before building an
            audience. Follower ranges describe audience size. Your skills and
            creative fit matter at every stage.
          </p>
          <ul>
            {[
              "Aspiring · No audience or under 100",
              "Emerging · 100–999",
              "Nano · 1,000–4,999",
              "Growing · 5,000–9,999",
              "Established · 10,000–19,999",
              "Scaling · 20,000+",
            ].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Standard influencer discovery and participation require 100
            followers on one applicable account, plus any brief-specific
            conditions. UGC has separate capability-based eligibility.
          </p>
        </section>
      </details>
      <details className="capability">
        <summary>Your collaboration journey</summary>{" "}
        <section className="spread">
          <div>
            <p className="overline">Collaboration & earnings</p>
            <h2>From invitation to invoice.</h2>
            <p>
              Planned tools connect applications and Brand invitations with
              negotiations, agreements, deliverables and revisions. Track
              invoices, earnings records and external payments. AURA does not
              process or hold funds.
            </p>
          </div>
          <div>
            <h3>Your Creator journey</h3>
            <ol>
              {[
                "Establish your profile and goals.",
                "Create and grow with personalized guidance.",
                "Build your professional identity.",
                "Discover eligible opportunities.",
                "Manage collaborations and learn from outcomes.",
              ].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </section>
      </details>
      <section className="creator-faq spread">
        <h2>Creator questions</h2>
        <div>
          {faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="creator-close">
        <h2>Start with your next idea.</h2>
        <Register />
      </section>
    </article>
  );
}
