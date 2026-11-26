import Link from "next/link";
import "@/features/creator-studio/studio.css";
import "@/features/marketplace/market.css";
// Minimal Brand area for M10 campaign authoring. The full Brand workspace arrives with M14/M15.
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
            gap: "1rem",
            padding: "0.8rem 1rem",
            alignItems: "center",
          }}
        >
          <strong>AURA for Brands</strong>
          <Link href="/brand/campaigns">Campaigns</Link>
          <Link href="/workspaces">Switch workspace</Link>
        </nav>
      </header>
      <div id="brand-main" className="mk-brand-area">
        {children}
      </div>
    </>
  );
}
