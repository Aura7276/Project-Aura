import Link from "next/link";
import "@/features/creator-studio/studio.css";
import "@/features/marketplace/market.css";
import "@/features/applications/apply.css";
import "@/features/brand/brand.css";
// Minimal private Brand area (M14 onboarding and business tools, M10 campaigns, M11 inbox). Not the M15 Brand navigation, which is not approved. The full Brand workspace arrives with M14/M15.
export const metadata = {
  title: { default: "Brand · AURA", template: "%s · Brand · AURA" },
  robots: { index: false, follow: false },
};
export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip" href="#brand-main">
        Skip to content
      </a>
      <header style={{ borderBottom: "1px solid #e6e1dc", background: "#fff" }}>
        <nav
          aria-label="Brand"
          className="shell"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem 1rem",
            padding: "0.8rem 1rem",
            alignItems: "center",
          }}
        >
          <strong>AURA for Brands</strong>
          <Link href="/brand">Home</Link>
          <Link href="/brand/profile">Business</Link>
          <Link href="/brand/verification">Verification</Link>
          <Link href="/brand/campaigns">Campaigns</Link>
          <Link href="/brand/inbox">Inbox</Link>
          <Link href="/workspaces">Switch workspace</Link>
        </nav>
      </header>
      <div id="brand-main" className="mk-brand-area">
        {children}
      </div>
    </>
  );
}
