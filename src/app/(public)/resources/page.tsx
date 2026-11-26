import { Editorial, PathLink } from "@/components/public/editorial";
import { articles } from "@/features/public-site/resources";
export const metadata = { title: "Resource library" };
export default function Resources() {
  return (
    <Editorial
      title="The resource library"
      intro="Practical guides for the work before, during and after a brief."
    >
      {articles.map((a) => (
        <section className="resource-index-row" key={a.slug}>
          <small>{a.category}</small>
          <h2>
            <PathLink href={"/resources/" + a.slug}>{a.title}</PathLink>
          </h2>
          <p>{a.intro}</p>
        </section>
      ))}
    </Editorial>
  );
}
