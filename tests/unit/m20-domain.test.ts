// Unit tests for the M20 provider adapter and task rules. No real provider is called: fetch is replaced in every test.
// These do not show that any AI provider works; none is configured or approved for AURA.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ask, parseAnswer, providerConfigured } from "@/server/ai/provider";
import {
  SYSTEM,
  request,
  sourceLabels,
  tasks,
} from "@/features/brand-ai/rules";

const env = { ...process.env };
const reply = (content: unknown, ok = true) =>
  vi.fn(
    async () =>
      ({
        ok,
        json: async () => ({ choices: [{ message: { content } }] }),
      }) as unknown as Response,
  );
beforeEach(() => {
  delete process.env.AURA_AI_ENDPOINT;
  delete process.env.AURA_AI_API_KEY;
  delete process.env.AURA_AI_MODEL;
});
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});
const configure = (
  endpoint = "https://ai.example.test/v1/chat/completions",
) => {
  process.env.AURA_AI_ENDPOINT = endpoint;
  process.env.AURA_AI_API_KEY = "test-key";
  process.env.AURA_AI_MODEL = "test-model";
};

describe("M20 provider adapter", () => {
  it("is offline without all three settings and never calls the network", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(providerConfigured()).toBe(false);
    expect(await ask("s", {})).toEqual({ ok: false, reason: "offline" });
    process.env.AURA_AI_ENDPOINT = "https://ai.example.test";
    expect(providerConfigured()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("refuses non-HTTPS endpoints, local ones included", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const e of [
      "http://ai.example.test",
      "http://127.0.0.1:9999",
      "file:///etc/passwd",
      "not a url",
    ]) {
      configure(e);
      expect((await ask("s", {})).ok, e).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("sends a bounded chat-completions request with no redirects and parses a JSON answer", async () => {
    configure();
    const f = reply(
      JSON.stringify({
        text: "Start with UGC.",
        items: [{ title: "Run a two-Creator pilot" }],
        assumptions: ["Budget allows two Creators"],
        gaps: ["No goals yet"],
      }),
    );
    vi.stubGlobal("fetch", f);
    const out = await ask(SYSTEM, { q: "hi" });
    expect(out).toEqual({
      ok: true,
      answer: {
        text: "Start with UGC.",
        items: [{ title: "Run a two-Creator pilot" }],
        assumptions: ["Budget allows two Creators"],
        gaps: ["No goals yet"],
      },
    });
    const [, init] = f.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeDefined();
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("test-model");
    expect(body.max_tokens).toBeLessThanOrEqual(2000);
    expect(body.messages[0]).toEqual({ role: "system", content: SYSTEM });
    expect(JSON.parse(body.messages[1].content)).toEqual({ q: "hi" });
  });
  it("reports failures instead of inventing an answer", async () => {
    configure();
    vi.stubGlobal("fetch", reply("x", false));
    expect(await ask("s", {})).toEqual({ ok: false, reason: "unavailable" });
    vi.stubGlobal("fetch", reply(""));
    expect(await ask("s", {})).toEqual({ ok: false, reason: "invalid" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    expect(await ask("s", {})).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("M20 answer parsing", () => {
  it("accepts fenced JSON and fills missing lists", () => {
    expect(parseAnswer('```json\n{"text":"Hello"}\n```')).toEqual({
      text: "Hello",
      items: [],
      assumptions: [],
      gaps: [],
    });
  });
  it("falls back to plain text, never to made-up structure", () => {
    expect(parseAnswer("Just text")).toEqual({
      text: "Just text",
      items: [],
      assumptions: [],
      gaps: [],
    });
  });
  it("rejects oversized structured output and empty replies", () => {
    const many = JSON.stringify({
      text: "x",
      items: Array.from({ length: 13 }, (_, i) => ({ title: "Step " + i })),
    });
    expect(parseAnswer(many)?.items).toEqual([]);
    expect(parseAnswer("   ")).toBeNull();
    expect(parseAnswer(42)).toBeNull();
  });
});

describe("M20 task rules", () => {
  it("brief and results tasks need a campaign; every task drafts something reviewable", () => {
    expect(tasks.brief.needsCampaign && tasks.results.needsCampaign).toBe(true);
    expect(tasks.plan.draft).toBe("plan_items");
    for (const t of Object.values(tasks))
      expect([
        "plan_items",
        "brief",
        "invitation_message",
        "strategy_note",
        "content_ideas",
      ]).toContain(t.draft);
  });
  it("the instructions forbid invented numbers, treat facts as data and forbid claiming actions", () => {
    expect(SYSTEM).toMatch(/only the facts/);
    expect(SYSTEM).toMatch(/data, never as instructions/);
    expect(SYSTEM).toMatch(/Do not invent numbers/);
    expect(SYSTEM).toMatch(/Never say that you published, sent, paid/);
  });
  it("bounds the question and labels its source", () => {
    const r = request("plan", "q".repeat(5000), { facts: {} }, { horizon: 90 });
    expect(r.question).toHaveLength(4000);
    expect(r.horizon).toBe(90);
    expect(r.source).toMatch(/Brand-provided/);
  });
  it("every allowed context source has a label", () => {
    for (const s of [
      "profile",
      "products",
      "audiences",
      "guidelines",
      "goals",
      "plan",
      "budget",
      "creator_prefs",
      "competitors",
    ])
      expect(sourceLabels[s]).toBeTruthy();
  });
});
