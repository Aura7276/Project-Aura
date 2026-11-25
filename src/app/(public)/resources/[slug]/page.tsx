import { notFound } from "next/navigation";
import { Editorial, PathLink } from "@/components/public/editorial";
import { articles } from "@/features/public-site/resources";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: articles.find((a) => a.slug === slug)?.title ?? "Resource" };
}
export default async function Article({ params }: Props) {
  const { slug } = await params;
  const a = articles.find((a) => a.slug === slug);
  if (!a) notFound();
  return (
    <Editorial title={a.title} intro={a.intro}>
      {a.steps.map(([h, p]) => (
        <section key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
      <PathLink href="/resources">All resources</PathLink>
    </Editorial>
  );
}
