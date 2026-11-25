import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Support centre" };
export default function Page() {
  return (
    <Editorial
      title="Support centre"
      intro="Find guidance on AURA’s public website, account readiness and commercial boundaries."
    >
      <section>
        <h2>Getting started</h2>
        <p>
          Explore the public studios and walkthrough. Live account registration
          will arrive with the authentication module.
        </p>
      </section>
      <section>
        <h2>Publication and privacy</h2>
        <p>
          Creator publication controls and support requests about account data
          depend on the relevant workspace and support services. Avoid sending
          financial records or verification documents through general enquiries.
        </p>
      </section>
      <nav aria-label="Related pages">
        <PathLink href="/faq">Frequently asked questions</PathLink>
        <PathLink href="/contact">Contact support</PathLink>
        <PathLink href="/resources">Browse the resource library</PathLink>
      </nav>
    </Editorial>
  );
}
