import { z } from "zod";
export const categories = [
  "Paid influencer",
  "UGC",
  "Barter",
  "Event",
  "Ambassador",
  "Affiliate",
] as const;
export const stages = [
  "Concept",
  "Script",
  "Draft",
  "Final",
  "Publication",
  "Handover",
] as const;
export type Side = "creator" | "brand";
export type Stage = (typeof stages)[number];
export type Review = "Approved" | "Revision requested" | "Concern raised";
export type Agreement = {
  version: number;
  title: string;
  terms: string;
  compensation: string;
  rights: string;
  exclusivity: string;
  aiPermission: string;
  externalUrl: string;
  templateApproved: boolean;
  acceptances: { side: Side; actor: string; at: string }[];
};
export type Deliverable = {
  id: string;
  title: string;
  format: string;
  description: string;
  due: string;
  stages: Stage[];
  stage: Stage;
  review: Review | null;
  submissions: Submission[];
  fulfilment?: { url: string; date: string; note: string };
};
export type Submission = {
  id: string;
  stage: Stage;
  number: number;
  url: string;
  note: string;
  at: string;
  review?: {
    decision: Review;
    note: string;
    scope: string;
    at: string;
    actor: string;
  };
};
export type Change = {
  id: string;
  kind: "Amendment" | "Reschedule" | "Cancellation" | "Renewal";
  title: string;
  details: string;
  compensation: string;
  date: string;
  deliverable: string;
  side: Side;
  at: string;
  status: "Proposed" | "Accepted" | "Declined";
};
export type Dispute = {
  id: string;
  title: string;
  details: string;
  deliverable: string;
  amount: string;
  side: Side;
  status: "Open" | "Resolution proposed" | "Resolved";
  evidence: { note: string; url: string; side: Side; at: string }[];
  resolution?: { note: string; side: Side; at: string };
};
export type Activity = {
  id: string;
  action: string;
  side: Side;
  actor: string;
  at: string;
};
export type Collaboration = {
  id: string;
  title: string;
  brand: string;
  creator: string;
  category: (typeof categories)[number];
  revision: number;
  status: "Agreement pending" | "Active" | "Completed" | "Cancelled";
  agreements: Agreement[];
  deliverables: Deliverable[];
  changes: Change[];
  disputes: Dispute[];
  messages: { id: string; body: string; side: Side; at: string }[];
  activity: Activity[];
  performance: {
    id: string;
    metric: string;
    value: string;
    period: string;
    source: string;
    at: string;
  }[];
  completion: Side[];
  financialStatus: string;
  dependencies: {
    id: string;
    title: string;
    side: Side;
    due: string;
    note: string;
    done: boolean;
  }[];
};
export type Access = { side: Side; manage: boolean; review: boolean };
export type Workspace = { collaboration: Collaboration; access: Access };
const text = z.string().trim().min(1).max(6000);
const short = z.string().trim().min(1).max(180);
const url = z.url({ protocol: /^https?$/ }).max(2048);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accept"), version: z.number().int().positive() }),
  z.object({
    type: z.literal("submit"),
    deliverable: z.uuid(),
    stage: z.enum(stages),
    url,
    note: text,
  }),
  z.object({
    type: z.literal("share"),
    deliverable: z.uuid(),
    stage: z.enum(stages),
    content: z.uuid(),
    contentRevision: z.number().int().positive(),
    fields: z
      .array(z.enum(["body", "caption"]))
      .min(1)
      .max(2),
  }),
  z.object({
    type: z.literal("review"),
    deliverable: z.uuid(),
    submission: z.uuid(),
    decision: z.enum(["Approved", "Revision requested", "Concern raised"]),
    note: text,
    scope: z.enum([
      "Agreed requirement",
      "Voluntary improvement",
      "Additional request",
    ]),
  }),
  z.object({ type: z.literal("message"), body: text }),
  z.object({
    type: z.literal("change"),
    kind: z.enum(["Amendment", "Reschedule", "Cancellation", "Renewal"]),
    title: short,
    details: text,
    compensation: z.string().max(1000),
    date: z.union([z.literal(""), z.iso.date()]),
    deliverable: z.union([z.literal(""), z.uuid()]),
  }),
  z.object({
    type: z.literal("respond"),
    change: z.uuid(),
    accept: z.boolean(),
  }),
  z.object({
    type: z.literal("fulfil"),
    deliverable: z.uuid(),
    url,
    date: z.iso.date(),
    note: text,
  }),
  z.object({
    type: z.literal("dispute"),
    title: short,
    details: text,
    deliverable: z.union([z.literal(""), z.uuid()]),
    amount: z.string().max(120),
  }),
  z.object({
    type: z.literal("evidence"),
    dispute: z.uuid(),
    note: text,
    url: z.union([z.literal(""), url]),
  }),
  z.object({ type: z.literal("resolve"), dispute: z.uuid(), note: text }),
  z.object({ type: z.literal("confirmResolution"), dispute: z.uuid() }),
  z.object({
    type: z.literal("performance"),
    metric: short,
    value: short,
    period: short,
    source: url,
  }),
  z.object({
    type: z.literal("dependency"),
    dependency: z.uuid(),
    note: text,
    done: z.boolean(),
  }),
  z.object({ type: z.literal("complete") }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Execute = (
  command: Command,
  request: string,
  revision: number,
) => Promise<{ workspace?: Workspace; error?: string }>;
export function currentAgreement(c: Collaboration) {
  return c.agreements[c.agreements.length - 1];
}
export function deliverableDone(d: Deliverable) {
  return (
    d.stage === d.stages[d.stages.length - 1] &&
    d.review === "Approved" &&
    !!d.fulfilment
  );
}
