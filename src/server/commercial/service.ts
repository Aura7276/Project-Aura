import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialSummary } from "@/features/creator-studio/commercial";
import {
  type Ledger,
  units,
  adjusted,
  outstanding,
  money,
} from "@/features/earnings/model";
export async function commercialSummary(
  client: Pick<SupabaseClient, "rpc">,
  workspaceId: string,
): Promise<CommercialSummary> {
  const { data, error } = await client.rpc("aura_commercial_read", {
    p_workspace: workspaceId,
  });
  if (error || !data)
    return {
      status: "unavailable",
      module: "M13",
      text: "Commercial records are currently unavailable.",
    };
  const l = data as Ledger;
  if (!l.obligations.length && !l.receipts.length)
    return {
      status: "none",
      text: "Add an income obligation or record a payment to start your ledger.",
    };
  const currencies = [
    ...l.obligations.map((o) => o.currency),
    ...l.receipts.map((r) => r.currency),
  ];
  const currency = currencies.includes("INR") ? "INR" : currencies[0];
  const obligations = l.obligations.filter((o) => o.currency === currency);
  return {
    status: "exact",
    currency,
    agreed: money(
      obligations.reduce((s, o) => s + adjusted(l, o), 0n),
      currency,
    ),
    received: money(
      l.receipts
        .filter((r) => !r.reversed && r.currency === currency)
        .reduce((s, r) => s + units(r.amount), 0n),
      currency,
    ),
    outstanding: money(
      obligations.reduce((s, o) => s + outstanding(l, o), 0n),
      currency,
    ),
  };
}
