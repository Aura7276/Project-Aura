import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Explore the studios" };
export default function Page() {
  return (
    <Editorial
      title="Explore the studios"
      intro="Choose a path through the planned product."
    >
      <section>
        <h2>Creator Studio</h2>
        <p>
          Develop your practice, plan content, review observations and build a
          professional media kit.
        </p>
      </section>
      <section>
        <h2>Brand Studio</h2>
        <p>
          Define your audience, plan owned-channel content and coordinate
          eligible creator partnerships.
        </p>
      </section>
      <nav aria-label="Related pages">
        <PathLink href="/demo">Take the interactive walkthrough</PathLink>
        <PathLink href="/agencies">Explore Agency Studio</PathLink>
      </nav>
    </Editorial>
  );
}
