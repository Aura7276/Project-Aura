import { z } from "zod";
export const resourceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["pillar", "reference"]),
  name: z.string().trim().min(1).max(120),
  note: z.string().max(6000),
  url: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(2048)]),
  mix: z.number().int().min(0).max(100).nullable(),
});
export type Resource = z.infer<typeof resourceSchema>;
