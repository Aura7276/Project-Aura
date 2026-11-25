import Link from "next/link";
import { rollout } from "@/config/collaborations";
import Image from "next/image";
import { ArrowUpRight, NotebookPen, ScanLine, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { destinationPath } from "@/config/navigation";
import "./home.css";
export const metadata = { title: "Creator growth & brand collaboration" };
const faq = [
  [
    "Who can use AURA?",
    "AURA is designed for adult creators, businesses and marketing teams, with India as its first market. Agency Studio is planned.",
  ],
  [
    "Can beginners join?",
    "Yes. The planned Creator journey starts with your interests and goals, even before you have a social account.",
  ],
  [
    "Do I need a large following?",
    "Growth tools are designed for every stage. Standard influencer eligibility starts at 100 followers on one relevant account. Each campaign can have additional requirements. UGC has separate criteria.",
  ],
  [
    "Can a business start without social accounts?",
    "Yes. Brand onboarding is designed to begin with your business and marketing objectives. Verification is required before formal campaign publishing and outreach.",
  ],
  ["What collaborations are planned?", rollout],
  [
    "Is AURA free to get started?",
    "The plan includes free core Creator tools, eligible applications and basic Brand onboarding. Advanced capabilities may become paid later.",
  ],
  [
    "Does AURA process commercial payments?",
    "No. Settlement happens outside AURA. Planned commercial tools distinguish agreed compensation, externally recorded payments and outstanding amounts.",
  ],
];
function Entries() {
  return (
    <div className="home-actions">
      {(["creators", "brands"] as const).map((id, i) => (
        <Button asChild key={id}>
          <a href={destinationPath(id)}>
            {i === 0 ? "I’m a Creator" : "I’m a Brand"}
            <ArrowUpRight />
          </a>
        </Button>
      ))}
    </div>
  );
}
const creatorSteps = [
  "Set your profile and objectives",
  "Develop a content and growth strategy",
  "Discover eligible opportunities",
  "Manage collaborations and commercial records",
];
const brandSteps = [
  "Define business and marketing objectives",
  "Identify suitable approaches and creators",
  "Plan and execute collaborations",
  "Evaluate outcomes against available evidence",
];
export default function Home() {
  return (
    <article className="aura-home">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="kicker">India-first creator & brand platform</p>
          <h1>
            Your creativity deserves <em>more.</em>
          </h1>
          <p>
            Plan your content, grow your audience and find creative
            partnerships. AURA brings creators and brands into the same
            conversation.
          </p>
          <Entries />
        </div>
        <figure>
          <picture>
            <source
              media="(max-width:767px)"
              type="image/avif"
              srcSet="/images/home/studio-mobile.avif"
            />
            <Image
              src="/images/home/studio.webp"
              alt="Editorial illustration of a creator filming a ceramicist in a sunlit studio"
              width={1100}
              height={1375}
              sizes="(min-width: 1100px) 580px, (min-width: 768px) 48vw, 100vw"
              loading="eager"
              fetchPriority="high"
            />
          </picture>
        </figure>
      </section>
      <section className="position">
        <h2>Growth comes before the brief.</h2>
        <p>
          Creator Growth OS turns practice into a publishing plan. Brand Growth
          OS starts with your own channels. The collaboration marketplace is
          where those two paths meet.
        </p>
      </section>
      <section className="workbench">
        <div>
          <p className="kicker">Product experience</p>
          <h2>Inside the studios</h2>
          <p>Explore two ways to shape a creative brief.</p>
          <Link className="path-link underline" href="/demo">
            Walk through both studios
          </Link>
        </div>
        <Tabs defaultValue="creator">
          <TabsList aria-label="Illustrative studio">
            <TabsTrigger value="creator">Creator</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
          </TabsList>
          {[
            [
              "creator",
              "Content notebook",
              "Choose a skill to practise",
              "Plan a post around it",
              "Review what resonated",
            ],
            [
              "brand",
              "Marketing brief",
              "Define your audience",
              "Choose a channel and format",
              "Set a measurable objective",
            ],
          ].map(([id, title, ...steps]) => (
            <TabsContent key={id} value={id}>
              <small>Illustrative preview</small>
              <h3>{title}</h3>
              {steps.map((step, i) => {
                const Icon = [Target, NotebookPen, ScanLine][i];
                return (
                  <p className="note" key={step}>
                    <Icon size={19} />
                    {step}
                  </p>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </section>
      <div className="journeys">
        {[
          [
            "creators",
            "Creator Growth OS",
            "Find your creative rhythm.",
            "Personalized guidance, social analytics and AI-assisted content planning are designed to help you diagnose, experiment, publish, measure and learn. Start before you qualify for standard influencer work.",
            "Build a professional profile and media kit. As opportunities become available, discover eligible campaigns and manage deliverables and earnings.",
            creatorSteps,
          ],
          [
            "brands",
            "Brand Growth OS",
            "Give your brand a point of view.",
            "Start with business-specific marketing intelligence, owned-channel goals and a content plan. Your audience and objectives shape the brief.",
            "Creator discovery, campaign management, commercial coordination and evidence-based reporting are planned as the Brand workspace develops.",
            brandSteps,
          ],
        ].map(([id, label, title, body, detail, steps]) => (
          <section id={String(id)} key={String(id)}>
            <p className="kicker">{label}</p>
            <h2>{title}</h2>
            <p>{body}</p>
            <p>{detail}</p>
            <h3>How it works</h3>
            <ol>
              {(steps as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <section className="opportunities">
        <p className="kicker">Collaboration marketplace</p>
        <h2>More ways to work together.</h2>
        <p>{rollout}</p>
        <p className="empty-line">
          <Link href="/explore/campaigns" className="underline">
            View public campaign previews
          </Link>
        </p>
      </section>
      <section className="audiences">
        <h2>Built for different stages</h2>
        <div>
          <h3>From first post to established practice</h3>
          <p>
            Aspiring creators can explore skills. Emerging creators can build
            consistency. Growing and established creators can refine their media
            kits and collaboration workflows. Follower counts are one
            eligibility input.
          </p>
          <h3>From new business to marketing team</h3>
          <p>
            New businesses can define their audience, growing brands can plan
            their channels, and established teams can align briefs with
            measurable objectives.
          </p>
          <h3>For agencies</h3>
          <p>
            Agency Studio is planned for teams working across explicitly
            delegated client accounts.
          </p>
        </div>
      </section>
      <section className="questions">
        <h2>Frequently asked questions</h2>
        <div>
          {faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="closing">
        <h2>Where will you start?</h2>
        <Entries />
      </section>
    </article>
  );
}
