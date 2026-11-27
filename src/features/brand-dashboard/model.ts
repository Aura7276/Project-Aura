import { z } from "zod";
export const tracks = [
  "Owned content",
  "Creator marketing",
  "Business",
] as const;
export const metrics = [
  "Followers",
  "Reach",
  "Engagements",
  "Website visits",
  "Enquiries",
] as const;
export type Task = {
  id: string;
  title: string;
  track: (typeof tracks)[number];
  due: string;
  note: string;
  done: boolean;
  created_at: string;
};
export type Observation = {
  id: string;
  metric: (typeof metrics)[number];
  value: number;
  date: string;
  source: string;
  note: string;
  channel: string;
};
export type Focus = {
  objective: string;
  audience: string;
  resources: string;
  horizon: 7 | 30 | 90;
};
export type Home = {
  workspace: {
    id: string;
    name: string;
    role: string;
    verification: string;
    status: string;
  };
  revision: number;
  focus: Focus;
  tasks: Task[];
  observations: Observation[];
  activity: { id: string; action: string; at: string }[];
  collaborations: {
    id: string;
    title: string;
    creator: string;
    category: string;
    status: string;
  }[];
  collaborationsAvailable: boolean;
};
const text = z.string().trim().min(1).max(180);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("focus"),
    objective: text,
    audience: z.string().max(1000),
    resources: z.string().max(1000),
    horizon: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  }),
  z.object({
    type: z.literal("task"),
    id: z.uuid(),
    title: text,
    track: z.enum(tracks),
    due: z.union([z.literal(""), z.iso.date()]),
    note: z.string().max(3000),
  }),
  z.object({ type: z.literal("complete"), id: z.uuid(), done: z.boolean() }),
  z.object({
    type: z.literal("observation"),
    metric: z.enum(metrics),
    value: z.number().int().min(0).max(1e12),
    date: z.iso.date(),
    source: text,
    note: z.string().max(2000),
    channel: text,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Execute = (
  command: Command,
  request: string,
  revision: number,
) => Promise<{ home?: Home; error?: string }>;
export const defaultFocus: Focus = {
  objective: "",
  audience: "",
  resources: "",
  horizon: 30,
};
export function dateKey(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
