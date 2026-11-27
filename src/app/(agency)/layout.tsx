import Link from "next/link";
import "@/features/creator-studio/studio.css";
import "@/features/agency/agency.css";
// M23 Agency Studio. Every page re-checks access in the database; this layout only frames the area.
export const metadata = {
  title: {
    default: "Agency Studio · AURA",
    template: "%s · Agency Studio · AURA",
  },
  robots: { index: false, follow: false },
};
export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="ag-skip" href="#agency-main">
        Skip to content
      </a>
      <header style={{ borderBottom: "1px solid #e4e1ec", background: "#fff" }}>
        <nav
          aria-label="Agency area"
          className="shell"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem 1rem",
            padding: "0.8rem 1rem",
            alignItems: "center",
          }}
        >
          <strong>AURA for Agencies</strong>
          <Link href="/agency">Dashboard</Link>
          <Link href="/agency/clients">Clients</Link>
          <Link href="/agency/approvals">Approvals</Link>
          <Link href="/workspaces">Switch workspace</Link>
        </nav>
      </header>
      <div id="agency-main" className="ag-area">
        {children}
      </div>
    </>
  );
}
