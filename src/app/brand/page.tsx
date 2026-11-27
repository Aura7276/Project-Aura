import Link from "next/link";
import { redirect } from "next/navigation";
import { eligible } from "@/server/auth/session";
export const metadata = { title: "Brand workspaces" };
export default async function Page() {
  const { client, state } = await eligible();
  const { data, error } = await client.rpc("aura_workspaces");
  if (error) throw Error("Unable to load your workspaces.");
  const brands = (data as { id: string; name: string; kind: string }[]).filter(
    (w) => w.kind === "brand",
  );
  const selected = brands.find((w) => w.id === state.last_workspace);
  if (selected) redirect("/brand/workspaces/" + selected.id);
  if (brands.length === 1) redirect("/brand/workspaces/" + brands[0].id);
  return (
    <main style={{ maxWidth: 700, margin: "80px auto", padding: 24 }}>
      <h1>Choose your Brand workspace</h1>
      {brands.map((w) => (
        <p key={w.id}>
          <Link href={"/brand/workspaces/" + w.id}>{w.name}</Link>
        </p>
      ))}
      <Link href="/workspaces">
        {brands.length ? "Manage workspaces" : "Create a Brand workspace"}
      </Link>
    </main>
  );
}
