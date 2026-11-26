import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Explore the studios" };
export default function Page() {
  return (
    <Editorial title="Explore the studios">
      <nav className="studio-picker" aria-label="Choose a studio">
        {[
          ["Creator", "Plan your next release", "/creators"],
          ["Brand", "Build a campaign brief", "/brands"],
          ["Agency", "Explore the planned studio", "/agencies"],
        ].map(([role, action, url]) => (
          <a key={url} href={url}>
            <span>{role}</span>
            <strong>{action}</strong>
            <span aria-hidden>↗</span>
          </a>
        ))}
      </nav>
      <PathLink href="/demo">Try the walkthrough</PathLink>
    </Editorial>
  );
}
