import { studioContext } from "@/server/studio/service";
import { EarningsStudio } from "@/features/earnings/studio";
import { emptyLedger } from "@/features/earnings/model";
import { executeCommercial } from "@/features/earnings/actions";
export const metadata = { title: "Invoices" };
export default async function Page() {
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_commercial_read", {
    p_workspace: workspaceId,
  });
  return (
    <EarningsStudio
      initial={error ? emptyLedger : data}
      offline={!!error}
      execute={executeCommercial}
      initialTab="Invoices"
    />
  );
}
