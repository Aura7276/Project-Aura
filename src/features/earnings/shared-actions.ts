"use server";
import { z } from "zod";
import { eligible } from "@/server/auth/session";
import { studioContext } from "@/server/studio/service";
import { amountSchema, type Command } from "./model";
import { executeCommercial } from "./actions";
const sharedSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("report"),
    amount: amountSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    date: z.iso.date(),
    reference: z.string().max(180),
    note: z.string().min(1).max(3000),
    evidence: z.union([
      z.literal(""),
      z.url({ protocol: /^https?$/ }).max(2048),
    ]),
  }),
  z.object({
    type: z.literal("respond"),
    report: z.uuid(),
    decision: z.enum(["Confirmed", "Disputed"]),
    note: z.string().min(1).max(3000),
  }),
  z.object({
    type: z.literal("reverse"),
    report: z.uuid(),
    note: z.string().min(1).max(3000),
  }),
  z.object({
    type: z.literal("confirmReversal"),
    report: z.uuid(),
    note: z.string().min(1).max(3000),
  }),
]);
export type PaymentReport = {
  id: string;
  amount: string;
  currency: string;
  date: string;
  reference: string;
  note: string;
  evidence: string;
  side: "creator" | "brand";
  status: string;
  response: string | null;
  created_at: string;
};
export type SharedPayments = {
  side: "creator" | "brand";
  manage: boolean;
  title: string;
  reports: PaymentReport[];
};
export async function sharedPayments(
  id: string,
): Promise<{ data?: SharedPayments; error?: string }> {
  if (!z.uuid().safeParse(id).success)
    return { error: "Invalid collaboration." };
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_commercial_reports", {
    p_collaboration: id,
  });
  return error
    ? { error: "Payment records are unavailable for this collaboration." }
    : { data: data as SharedPayments };
}
export async function reportPayment(
  id: string,
  command: unknown,
  request: string,
): Promise<{ data?: SharedPayments; error?: string }> {
  const parsed = sharedSchema.safeParse(command);
  if (
    !parsed.success ||
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(request).success
  )
    return { error: "Check the amount, date and required details." };
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_commercial_report_command", {
    p_collaboration: id,
    p_request: request,
    p_command: parsed.data,
  });
  return error
    ? {
        error:
          "Could not save. Check the reporting party, payment reference and current confirmation state.",
      }
    : { data: data as SharedPayments };
}
export async function importConfirmedReport(
  id: string,
  reportId: string,
  request: string,
): Promise<{ error?: string }> {
  const shared = await sharedPayments(id);
  const report = shared.data?.reports.find((r) => r.id === reportId);
  if (
    !report ||
    report.status !== "Confirmed" ||
    shared.data?.side !== "creator"
  )
    return { error: "Choose a mutually confirmed payment." };
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_commercial_read", {
    p_workspace: workspaceId,
  });
  if (error) return { error: "Your private ledger is unavailable." };
  const command: Command = {
    type: "receipt",
    payer: shared.data.title,
    amount: report.amount,
    currency: report.currency,
    date: report.date,
    reference: "AURA-" + report.id,
    method: "Reported external payment",
    evidence: report.evidence,
    allocations: [],
    sourceReport: report.id,
  };
  const result = await executeCommercial(command, request, data.revision);
  return result.error ? { error: result.error } : {};
}
