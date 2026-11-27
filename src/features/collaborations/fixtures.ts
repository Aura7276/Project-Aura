import type { Workspace } from "./model";
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
/** Fictional records for the explicitly labelled development preview only. */
export const previewWorkspace: Workspace = {
  access: { side: "creator", manage: true, review: true },
  collaboration: {
    id: "10000000-0000-4000-8000-000000000010",
    title: "The everyday collection",
    brand: "Studio North",
    creator: "Riya",
    category: "UGC",
    revision: 0,
    status: "Active",
    financialStatus: "Settlement not recorded",
    agreements: [
      {
        version: 1,
        title: "Everyday collection · UGC production",
        terms:
          "Preview agreement. Produce two original vertical videos and a set of stills for the everyday collection. Submit draft and final versions for Brand review. Deliver approved files through an authorized handover link. Social posting is optional and requires a separate agreement.",
        compensation:
          "Illustrative agreed fee ₹24,000. Payment evidence has not been recorded.",
        rights:
          "Illustrative licence • Brand organic channels • India • 90 days from handover. Paid advertising and ownership transfer require separate agreement.",
        exclusivity: "No exclusivity in this illustrative agreement.",
        aiPermission:
          "AI training, synthetic likeness and voice use are not authorized in this preview agreement.",
        externalUrl: "",
        templateApproved: true,
        acceptances: [
          {
            side: "creator",
            actor: "Preview Creator",
            at: "2026-11-24T08:00:00Z",
          },
          { side: "brand", actor: "Preview Brand", at: "2026-11-24T09:00:00Z" },
        ],
      },
    ],
    deliverables: [
      {
        id: ids[0],
        title: "A slower kind of morning",
        format: "Vertical video · 30 seconds",
        description:
          "Product in use, natural light, original voiceover. Include the product name and an unboxing moment.",
        due: "2026-12-04",
        stages: ["Draft", "Final", "Handover"],
        stage: "Draft",
        review: null,
        submissions: [],
      },
      {
        id: ids[1],
        title: "Details worth keeping",
        format: "Vertical video · 15 seconds",
        description:
          "Three tactile close-ups and a clean end frame. Keep the final frame clear for Brand copy.",
        due: "2026-12-06",
        stages: ["Draft", "Final", "Handover"],
        stage: "Draft",
        review: null,
        submissions: [
          {
            id: "10000000-0000-4000-8000-000000000020",
            stage: "Draft",
            number: 1,
            url: "https://example.com/illustrative-draft",
            note: "Illustrative submission. A placeholder link demonstrates the review workflow.",
            at: "2026-11-25T10:30:00Z",
          },
        ],
      },
      {
        id: ids[2],
        title: "The still-life edit",
        format: "Product photography · 6 images",
        description:
          "Six original landscape and portrait compositions, delivered as an approved image set.",
        due: "2026-12-08",
        stages: ["Final", "Handover"],
        stage: "Final",
        review: null,
        submissions: [],
      },
    ],
    changes: [],
    disputes: [],
    messages: [
      {
        id: "10000000-0000-4000-8000-000000000030",
        body: "The sample pack is on its way. Looking forward to seeing your first cut.",
        side: "brand",
        at: "2026-11-25T09:00:00Z",
      },
    ],
    activity: [
      {
        id: "10000000-0000-4000-8000-000000000040",
        action: "Agreement accepted by both parties",
        actor: "Preview Brand",
        side: "brand",
        at: "2026-11-24T09:00:00Z",
      },
    ],
    dependencies: [
      {
        id: "10000000-0000-4000-8000-000000000050",
        title: "Deliver product samples",
        side: "brand",
        due: "2026-11-30",
        done: false,
        note: "Dispatch confirmed in this illustrative preview.",
      },
    ],
    performance: [],
    completion: [],
  },
};
