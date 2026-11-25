import { PublicHeader } from "@/components/public/header";
import { Wordmark, DestinationItem } from "@/components/public/destination";
import { footerGroups } from "@/config/navigation";
import "./public.css";
export const metadata = {
  title: { default: "AURA", template: "%s · AURA" },
  description: "Creator growth and brand collaboration in India.",
};
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <PublicHeader />
      <main className="shell public-main" id="content" tabIndex={-1}>
        {children}
      </main>
      <footer className="public-foot">
        <div className="shell">
          <Wordmark />
          <p>Creator growth and brand collaboration in India.</p>
          <nav aria-label="Footer" className="foot-grid">
            {Object.entries(footerGroups).map(([name, ids]) => (
              <section key={name}>
                <h2>{name}</h2>
                {ids.map((id) => (
                  <DestinationItem key={id} id={id} />
                ))}
                {process.env.NODE_ENV === "development" && name === "Legal" && (
                  <small>Pending implementation</small>
                )}
              </section>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
