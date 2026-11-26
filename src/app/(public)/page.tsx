import { rollout } from "@/config/collaborations";
import Link from "next/link";

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
export default function Home() {
  return (
    <article className="aura-home">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="kicker">India-first creator & brand platform</p>
          <h1>
            Your creativity deserves <em>more.</em>
          </h1>
          <p>Plan your next release. Find your next creative partner.</p>
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

      <section className="workbench">
        <div>
          <h2>Inside the studios</h2>

          <Link className="path-link underline" href="/demo">
            Try the walkthrough
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
      <nav className="exchange-links" aria-label="Explore collaborations">
        <Link href="/explore/campaigns">
          Browse campaign briefs <ArrowUpRight />
        </Link>
        <Link href="/explore/creators">
          Discover creators <ArrowUpRight />
        </Link>
      </nav>
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
