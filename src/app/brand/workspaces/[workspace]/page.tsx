import { z } from "zod";
import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { BrandDashboard } from "@/features/brand-dashboard/dashboard";
import { saveBrandHome } from "@/features/brand-dashboard/actions";
import { defaultFocus, type Home } from "@/features/brand-dashboard/model";
export const metadata = { title: "Brand workspace" };
export default async function Page({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!z.uuid().safeParse(workspace).success) notFound();
  const { client } = await eligible();
  const { data: memberships, error: denied } =
    await client.rpc("aura_workspaces");
  const member = (memberships as Home["workspace"][] | null)?.find(
    (w) => w.id === workspace,
  );
  if (
    denied ||
    !member ||
    (member as Home["workspace"] & { kind?: string }).kind !== "brand"
  )
    notFound();
  const { data, error } = await client.rpc("aura_brand_home_read", {
    p_workspace: workspace,
  });
  const fallback: Home = {
    workspace: member,
    revision: 0,
    focus: defaultFocus,
    tasks: [],
    observations: [],
    activity: [],
    collaborations: [],
    collaborationsAvailable: false,
  };
  return (
    <main>
      <BrandDashboard
        initial={error || !data ? fallback : data}
        offline={!!error || !data}
        execute={saveBrandHome.bind(null, workspace)}
      />
    </main>
  );
}
