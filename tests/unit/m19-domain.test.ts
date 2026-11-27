import { describe, expect, it } from "vitest";
import {
  deliveryStats,
  metricCoverage,
  reportCsv,
  reportLines,
  type Rollup,
} from "@/features/monitor/rules";

const r: Rollup = {
  delivery: [
    {
      collaboration_id: "c1",
      m12: "m1",
      creator: "Asha",
      status: "Active",
      completed: false,
      open_disputes: 0,
      shared: true,
      notes: [],
      deliverables: [
        {
          id: "d1",
          title: "Video 1 of 2",
          format: "video",
          stage: "Publication",
          review: "Approved",
          due: "",
          overdue: false,
          published_on: "2026-11-20",
          url: "https://x",
          revisions: 0,
          submissions: 1,
          results: {
            views: {
              value: 1500,
              observed_on: "2026-11-26",
              source: "platform_insights",
              side: "brand",
              stale: false,
            },
            reach: {
              value: 900,
              observed_on: "2026-11-26",
              source: "screenshot",
              side: "creator",
              stale: false,
            },
          },
          windows: [],
        },
        {
          id: "d2",
          title: "Video 2 of 2",
          format: "video",
          stage: "Draft",
          review: null,
          due: "2026-11-20",
          overdue: true,
          published_on: null,
          url: null,
          revisions: 2,
          submissions: 2,
          results: {},
          windows: [],
        },
      ],
    },
    {
      collaboration_id: "c2",
      m12: "m2",
      creator: "Bo",
      status: "Completed",
      completed: true,
      open_disputes: 0,
      shared: true,
      notes: [],
      deliverables: [
        {
          id: "d3",
          title: "Reel",
          format: "reel",
          stage: "Publication",
          review: "Approved",
          due: "",
          overdue: false,
          published_on: "2026-11-18",
          url: null,
          revisions: 0,
          submissions: 1,
          results: {
            views: {
              value: 500,
              observed_on: "2026-11-25",
              source: "platform_export",
              side: "brand",
              stale: false,
            },
          },
          windows: [],
        },
      ],
    },
  ],
  payments: [
    {
      collaboration_id: "c1",
      creator: "Asha",
      agreed: { currency: "INR", amount: 3000 },
      recorded: [{ currency: "INR", status: "Confirmed", amount: 1000 }],
    },
    {
      collaboration_id: "c2",
      creator: "Bo",
      agreed: { currency: "INR", amount: 2000 },
      recorded: [],
    },
  ],
  exceptions: [
    {
      kind: "overdue",
      creator: "Asha",
      deliverable: "Video 2 of 2",
      detail: "Due 2026-11-20, not delivered",
      m12: "m1",
    },
  ],
  totals: { views: 2000, reach: 900 },
  metrics: {
    views: { label: "Views", definition: "Times shown", unit: "count" },
    reach: {
      label: "Reach",
      definition: "Not unique",
      unit: "count",
      not_unique: true,
    },
  },
  coverage: { published: 2, with_results: 2 },
  period: { from: null, to: null },
  generated_at: "2026-11-27T10:00:00Z",
};

describe("M19 presentation rules", () => {
  it("shows how many deliverables each total comes from", () => {
    expect(metricCoverage(r)).toEqual({ views: 2, reach: 1 });
  });
  it("counts delivery without implying payment or success", () => {
    expect(deliveryStats(r)).toEqual({
      total: 3,
      published: 2,
      overdue: 1,
      approved: 2,
    });
  });
  it("exports only the chosen sections, with source, date and who entered each figure", () => {
    const csv = reportCsv(r, ["performance"]);
    expect(csv).toContain(
      "result,Asha,Video 1 of 2,Reach,900,lifetime (latest),2026-11-26,screenshot,creator",
    );
    expect(csv).toContain(
      "total,,,Reach,900,sum of per-post values (not unique people)",
    );
    expect(csv).not.toContain("recorded payment");
    expect(reportCsv(r, ["payments"])).toContain(
      "recorded by the parties, not verified by AURA",
    );
  });
  it("neutralizes spreadsheet formulas in exported text", () => {
    const evil = {
      ...r,
      exceptions: [{ ...r.exceptions[0], creator: "=HYPERLINK(1)" }],
    };
    expect(reportCsv(evil, ["exceptions"])).toContain("'=HYPERLINK(1)");
  });
  it("writes PDF lines that state the counting rule, the payment caveat and the absence of a score", () => {
    const l = reportLines(
      "Campaign",
      r,
      ["performance", "delivery", "payments", "exceptions"],
      { name: "Weekly", version: 2 },
    ).join("\n");
    expect(l).toContain("Weekly (version 2)");
    expect(l).toContain("Reach: 900 (from 1 deliverables) - not unique people");
    expect(l).toContain("There is no overall score.");
    expect(l).toContain("Delivery does not mean payment or success.");
    expect(l).toContain(
      "PAYMENTS (recorded by the parties, not verified by AURA)",
    );
  });
});
