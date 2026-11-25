import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "About AURA" };
export default function Page() {
  return (
    <Editorial
      title="About AURA"
      intro="AURA is an India-first Creator growth, Brand marketing and collaboration platform."
    >
      <section>
        <h2>Growth before a campaign</h2>
        <p>
          Creators can develop their craft before qualifying for standard
          influencer opportunities. Businesses can plan owned content before
          hiring a creator.
        </p>
      </section>
      <section>
        <h2>Professional sharing</h2>
        <p>
          Public discovery depends on deliberate publication and scoped sharing.
          Growth goals, private strategy and financial details belong in their
          respective workspaces.
        </p>
      </section>
      <nav aria-label="Related pages">
        <PathLink href="/features">Explore the product</PathLink>
        <PathLink href="/resources">Read the guides</PathLink>
      </nav>
    </Editorial>
  );
}
