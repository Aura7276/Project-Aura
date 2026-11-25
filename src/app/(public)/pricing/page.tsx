import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Free to get started" };
export default function Page() {
  return (
    <Editorial
      title="Free to get started"
      intro="The initial offer includes core Creator tools and basic Brand registration and onboarding."
    >
      <section>
        <h2>For creators</h2>
        <p>
          Core growth tools, marketplace discovery and eligible applications are
          planned to be free initially. Individual campaigns have their own
          requirements.
        </p>
      </section>
      <section>
        <h2>For brands</h2>
        <p>
          Start with basic onboarding. Advanced intelligence, higher usage and
          subscriptions are future decisions under M27. Prices and paid tiers
          have not been announced.
        </p>
      </section>
      <nav aria-label="Related pages">
        <PathLink href="/creators">Explore the Creator journey</PathLink>
        <PathLink href="/brands">Explore the Brand journey</PathLink>
      </nav>
    </Editorial>
  );
}
