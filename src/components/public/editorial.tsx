import Link from "next/link";
export function Editorial({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="editorial">
      <header>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </header>
      {children}
    </article>
  );
}
export function PathLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="path-link" href={href}>
      {children} <span aria-hidden>↗</span>
    </Link>
  );
}
