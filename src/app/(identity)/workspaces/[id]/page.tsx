import Link from "next/link";
import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { chooseWorkspace } from "@/features/auth/actions";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await eligible();
  const { id } = await params;
  const { data, error } = await client.rpc("aura_workspaces");
  if (error) throw Error("Unable to load workspace");
  const w = (
    data as {
      id: string;
      name: string;
      kind: string;
      status: string;
      next_step: string;
      role: string;
      onboarding: string;
      verification: string;
    }[]
  ).find((w) => w.id === id);
  if (!w) notFound();
  return (
    <>
      <h1>{w.name}</h1>
      <dl className="workspace-facts">
        {[
          ["Role", w.role],
          ["Onboarding", w.onboarding],
          ["Verification", w.verification],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.replaceAll("_", " ")}</dd>
          </div>
        ))}
      </dl>
      {w.kind === "brand" && ["owner", "admin"].includes(w.role) && (
        <p>
          {w.onboarding === "completed" ? (
            <Link href={"/brand/workspaces/" + w.id}>Open Brand Studio</Link>
          ) : (
            <Link href={`/brand/onboarding?w=${id}`}>Continue Brand setup</Link>
          )}
        </p>
      )}
      {w.kind === "brand" && w.role === "member" && (
        <p>
          <Link href={"/brand/workspaces/" + w.id}>Open Brand Studio</Link>
        </p>
      )}
      {w.kind === "agency" && <p>Agency onboarding is planned.</p>}
      {w.kind === "creator" &&
        w.role === "owner" &&
        w.status === "open" &&
        w.onboarding === "not_started" && (
          <form action={chooseWorkspace}>
            <input type="hidden" name="workspace" value={id} />
            <input type="hidden" name="begin" value="yes" />
            <button>Begin onboarding</button>
          </form>
        )}
      {w.kind === "creator" &&
        w.onboarding !== "not_started" &&
        w.role === "owner" && (
          <p>
            <Link href="/onboarding/creator">Continue Creator onboarding</Link>
          </p>
        )}
      <Link href="/workspaces">Switch workspace</Link>
    </>
  );
}
