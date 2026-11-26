import { z } from "zod";
export const draftSchema = z.object({
  id: z.uuid(),
  brief: z.string().trim().min(1).max(3000),
  body: z.string().max(8000),
  kind: z.enum(["Plan", "Content", "Opportunity", "Pitch"]),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  language: z.enum(["English", "Hindi", "Hinglish"]),
});
export type Draft = z.infer<typeof draftSchema>;
export type Saved = Draft & {
  history?: { prompt: string; reply: string }[];
  approved: boolean;
};
export type Memory = {
  cadence?: "off" | "daily" | "weekly";
  enabled: boolean;
  preferences: string;
  delete_requested_at?: string | null;
};
export type StudioState = {
  checkin?: string | null;
  drafts: Saved[];
  memory: Memory | null;
};
export type Reply = { ok: boolean; message: string; body?: string };
export type Commands = {
  save: (d: Draft) => Promise<Reply>;
  generate: (d: Draft) => Promise<Reply>;
  approve: (id: string) => Promise<Reply>;
  memory: (m: Memory, remove: boolean) => Promise<Reply>;
};
