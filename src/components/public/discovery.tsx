import { EntryHandoff } from "./entry-handoff";
import { notFound } from "next/navigation";
import { publicPreviews } from "@/server/publication/previews";
import { Editorial, PathLink } from "./editorial";
export async function Discovery({
  kind,
  id,
}: {
  kind: "creator" | "campaign";
  id?: string;
}) {
  const { available, items } = await publicPreviews(kind, id);
  const creators = kind === "creator";
  const list = creators ? "/explore/creators" : "/explore/campaigns";
  if (id) {
    const item = items[0];
    if (!item) notFound();
    return (
      <Editorial title={item.title} intro={item.summary ?? undefined}>
        {!creators && (
          <p>
            Applications require sign-in and an eligibility check. Applications
            are currently unavailable.
          </p>
        )}
        {!creators && <EntryHandoff kind="campaign" value={id} />}
        <PathLink href={list}>Back to discovery</PathLink>
      </Editorial>
    );
  }
  return (
    <Editorial
      title={creators ? "Discover creators" : "Discover campaigns"}
      intro={
        creators
          ? "Explore the professional details creators choose to publish."
          : "Explore limited public briefs. Applying requires sign-in and campaign-specific eligibility."
      }
    >
      {items.length ? (
        items.map((item) => (
          <section key={item.slug}>
            <h2>
              <PathLink href={"/" + kind + "/" + item.slug}>
                {item.title}
              </PathLink>
            </h2>
            <p>{item.summary}</p>
          </section>
        ))
      ) : (
        <section>
          <h2>
            {available
              ? "No published previews yet"
              : "Public previews are unavailable"}
          </h2>
          <p>
            {available
              ? "Check back when new work is published."
              : "The verified publication feed is not available. Explore the walkthrough in the meantime."}
          </p>
          <PathLink href="/demo">Explore the walkthrough</PathLink>
        </section>
      )}
    </Editorial>
  );
}
