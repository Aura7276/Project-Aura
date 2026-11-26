// Creator-owned public pages (profile site, media kits, testimonial invitations). Minimal chrome: the Creator's page is the product.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="pf-skip" href="#profile">
        Skip to content
      </a>
      {children}
    </>
  );
}
