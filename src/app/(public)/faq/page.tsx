import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Frequently asked questions" };
export default function Page() {
  return (
    <Editorial
      title="Frequently asked questions"
      intro="Answers about getting started and public access."
    >
      <section>
        <h2>Can I start without a social account?</h2>
        <p>
          Yes. The planned Creator and Brand onboarding paths support starting
          without an established account.
        </p>
      </section>
      <section>
        <h2>What is public?</h2>
        <p>
          Only explicitly published professional profile fields and approved
          campaign summaries are intended for discovery.
        </p>
      </section>
      <section>
        <h2>Can I apply from a preview?</h2>
        <p>
          Applications require a real account and campaign-specific eligibility.
          Public previews do not create applications.
        </p>
      </section>
      <section>
        <h2>How are payments handled?</h2>
        <p>
          Settlement occurs externally. AURA initially does not hold or process
          commercial funds.
        </p>
      </section>
      <nav aria-label="Related pages">
        <PathLink href="/contact">Contact support</PathLink>
        <PathLink href="/pricing">Review the initial offer</PathLink>
      </nav>
    </Editorial>
  );
}
