import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Frequently asked questions" };
export default function Page() {
  return (
    <Editorial title="Frequently asked questions">
      <details className="capability">
        <summary>Can I start without a social account?</summary>
        <p>
          Yes. The planned Creator and Brand onboarding paths support starting
          without an established account.
        </p>
      </details>
      <details className="capability">
        <summary>What is public?</summary>
        <p>
          Only explicitly published professional profile fields and approved
          campaign summaries are intended for discovery.
        </p>
      </details>
      <details className="capability">
        <summary>Can I apply from a preview?</summary>
        <p>
          Applications require a real account and campaign-specific eligibility.
          Public previews do not create applications.
        </p>
      </details>
      <details className="capability">
        <summary>How are payments handled?</summary>
        <p>
          Settlement occurs externally. AURA initially does not hold or process
          commercial funds.
        </p>
      </details>
      <nav aria-label="Related pages">
        <PathLink href="/contact">Contact support</PathLink>
        <PathLink href="/pricing">View pricing</PathLink>
      </nav>
    </Editorial>
  );
}
