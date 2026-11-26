import { z } from "zod";

export const formats = [
  "Reel",
  "Short",
  "Carousel",
  "Story",
  "Post",
  "Video",
] as const;
export const stages = [
  "Idea",
  "Drafting",
  "Recording",
  "Editing",
  "Review",
  "Ready",
] as const;
const link = z.union([
  z.literal(""),
  z.url({ protocol: /^https?$/ }).max(2048),
]);
export const itemSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(180),
  format: z.enum(formats),
  stage: z.enum(stages),
  pillar: z.string().max(100),
  tags: z.string().max(500),
  body: z.string().max(30000),
  caption: z.string().max(10000),
  production: z.string().max(6000),
  checklist: z.string().max(3000),
  reference: link,
  published: link,
  day: z.union([z.literal(""), z.iso.date()]),
  recurring: z.enum(["Once", "Weekly", "Monthly"]),
  commercial: z.boolean(),
  parent: z.uuid().nullable(),
  idea: z.uuid().nullable(),
  template: z.boolean(),
  observation: z.string().max(3000),
});
export type Item = z.infer<typeof itemSchema>;
export type RecordItem = { item: Item; revision: number };
export type Idea = { id: string; title: string; note: string | null };
export type Version = { item: Item; revision: number; at: string };
export function fresh(): Item {
  return {
    id: crypto.randomUUID(),
    title: "Untitled draft",
    format: "Reel",
    stage: "Idea",
    pillar: "",
    tags: "",
    body: "",
    caption: "",
    production: "",
    checklist: "",
    reference: "",
    published: "",
    day: "",
    recurring: "Once",
    commercial: false,
    parent: null,
    idea: null,
    template: false,
    observation: "",
  };
}
export const outlines: Record<Item["format"], string> = {
  Reel: "Hook\n\nShot sequence\n\nCall to action",
  Short: "Opening frame\n\nDemonstration\n\nPayoff",
  Carousel: "Cover\n\nSlide sequence\n\nClosing slide",
  Story: "First frame\n\nNext frame\n\nAudience prompt",
  Post: "Opening line\n\nMain point\n\nCaption",
  Video: "Cold open\n\nChapters\n\nClosing shot",
};
export function dayKey(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function occurs(i: Item, day: string) {
  if (!i.day || day < i.day) return false;
  if (day === i.day) return true;
  const a = new Date(i.day + "T12:00:00"),
    b = new Date(day + "T12:00:00");
  return i.recurring === "Weekly"
    ? a.getDay() === b.getDay()
    : i.recurring === "Monthly" && a.getDate() === b.getDate();
}
