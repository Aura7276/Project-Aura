import { Editorial, PathLink } from "@/components/public/editorial";
import { Check } from "lucide-react";
export const metadata = { title: "Free to get started" };
export default function Page() {
  return (
    <Editorial title="Free to get started">
      <div className="offer-spread">
        {[
          {
            role: "Creator",
            benefits: [
              "Core growth tools",
              "Campaign discovery",
              "Eligible applications",
            ],
            href: "/creators",
          },
          {
            role: "Brand",
            benefits: ["Basic registration", "Workspace onboarding"],
            href: "/brands",
          },
        ].map(({ role, benefits, href }) => (
          <section key={role}>
            <h2>{role}</h2>
            <ul>
              {benefits.map((text) => (
                <li key={text}>
                  <Check size={16} aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
            <PathLink href={href}>Explore {role} tools</PathLink>
          </section>
        ))}
      </div>
      <p className="offer-note">
        Campaign eligibility varies by brief. Premium plans are planned.
      </p>
    </Editorial>
  );
}
