import type { Home } from "./model";
export const previewHome: Home = {
  workspace: {
    id: "15000000-0000-4000-8000-000000000001",
    name: "Studio North",
    role: "owner",
    verification: "pending",
    status: "open",
  },
  revision: 0,
  focus: {
    objective: "Build a recognizable voice for our everyday collection.",
    audience:
      "Design-conscious people discovering intentional everyday essentials.",
    resources:
      "A small in-house team, one shoot day each week, and a growing library of product stories.",
    horizon: 30,
  },
  tasks: [
    {
      id: "15000000-0000-4000-8000-000000000011",
      title: "Define three stories for the next collection",
      track: "Owned content",
      due: "2026-12-02",
      note: "Start with the materials, the making and the everyday ritual.",
      done: false,
      created_at: "2026-11-27T08:00:00Z",
    },
    {
      id: "15000000-0000-4000-8000-000000000012",
      title: "Describe the ideal creative partner",
      track: "Creator marketing",
      due: "2026-12-04",
      note: "Write a private brief covering the audience, format and tone.",
      done: false,
      created_at: "2026-11-27T08:00:00Z",
    },
    {
      id: "15000000-0000-4000-8000-000000000013",
      title: "Agree on the audience we want to reach",
      track: "Business",
      due: "2026-12-01",
      note: "Use customer conversations to clarify the first segment.",
      done: true,
      created_at: "2026-11-27T08:00:00Z",
    },
  ],
  observations: [],
  activity: [],
  collaborations: [],
  collaborationsAvailable: true,
};
