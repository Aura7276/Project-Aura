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
      <p>Your role · {w.role}</p>
      <p>Onboarding · {w.onboarding}</p>
      <p>Verification · {w.verification}</p>
      <p>
        Next step · {w.next_step}.{" "}
        {w.kind === "creator"
          ? "Creator profile onboarding continues in M03."
          : w.kind === "brand"
            ? "Brand onboarding continues in M14."
            : "Agency onboarding is planned."}
      </p>
      {w.role === "owner" &&
        w.status === "open" &&
        w.onboarding === "not_started" && (
          <form action={chooseWorkspace}>
            <input type="hidden" name="workspace" value={id} />
            <input type="hidden" name="begin" value="yes" />
            <button>Begin onboarding</button>
          </form>
        )}
      <Link href="/workspaces">Switch workspace</Link>
    </>
  );
}
