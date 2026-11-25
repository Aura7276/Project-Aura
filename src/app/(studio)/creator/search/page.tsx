import Link from "next/link";
import {
  normalizeQuery,
  safeHits,
  searchCatalogues,
  searchOwnProfile,
  unsearchedModules,
  type SearchGroup,
} from "@/features/creator-studio/search";
import { studio, studioContext } from "@/server/studio/service";
import { Card } from "@/features/creator-studio/views";
import { rateLimited } from "@/server/security/rate-limit";
export const metadata = { title: "Search" };
const typeLabel: Record<string, string> = {
  idea: "Ideas",
  action: "Daily actions",
  plan: "Growth plan",
  goal: "Goals",
  observation: "Progress notes",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await studioContext();
  const q = normalizeQuery((await searchParams).q);
  let groups: SearchGroup[] = [],
    failed = false,
    limited = false;
  if (q) {
    if (rateLimited("studio-search:" + ctx.userId, 60)) limited = true;
    else {
      const r = await studio.search(ctx.client, ctx.workspaceId, q); // authorization is enforced inside the database function
      failed = !r.ok;
      const own = new Map<string, SearchGroup>();
      if (r.ok)
        for (const h of safeHits(r.value))
          own.set(h.type, {
            id: h.type,
            label: typeLabel[h.type] ?? h.type,
            hits: [...(own.get(h.type)?.hits ?? []), h],
          });
      groups = [
        ...own.values(),
        searchOwnProfile(q, ctx.state),
        ...searchCatalogues(q),
      ]
        .map((g) => ({ ...g, hits: safeHits(g.hits) }))
        .filter((g) => g.hits.length);
    }
  }
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  return (
    <>
      <h1>Search</h1>
      <form
        role="search"
        action="/creator/search"
        method="get"
        className="st-field"
      >
        <label htmlFor="sq">Search your studio</label>
        <input
          id="sq"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          minLength={2}
          maxLength={60}
          autoComplete="off"
        />
        <button className="st-btn primary" style={{ justifySelf: "start" }}>
          Search
        </button>
      </form>
      {!q && (
        <p className="st-hint">
          Enter at least two characters. Search covers your own ideas, actions,
          plan and goals, plus tools and guides. Nothing you search is stored.
        </p>
      )}
      {limited && (
        <p className="st-notice" role="alert">
          You are searching a little fast. Please wait a moment.
        </p>
      )}
      {failed && (
        <p className="st-notice" role="alert">
          Your own records could not be searched right now. Tools and guides are
          still shown.
        </p>
      )}
      {q && !limited && (
        <p role="status" aria-live="polite">
          {total} result{total === 1 ? "" : "s"} for “{q}”.
        </p>
      )}
      {groups.map((g) => (
        <Card key={g.id} id={`s-${g.id}`} title={g.label}>
          <ul className="st-list">
            {g.hits.map((h) => (
              <li
                key={g.id + h.id}
                className="st-item"
                style={{ gridTemplateColumns: "1fr" }}
              >
                <Link href={h.href}>
                  <strong>{h.title}</strong>
                </Link>
                {h.snippet && <span className="st-hint">{h.snippet}</span>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {q && (
        <p className="st-hint">
          Not searched yet:{" "}
          {unsearchedModules.map((m) => `${m.label} (${m.module})`).join(", ")}.
          They will be included when those modules exist.
        </p>
      )}
    </>
  );
}
