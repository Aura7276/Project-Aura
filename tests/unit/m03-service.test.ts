// MOCKED contract tests: a fake RPC client verifies function names, argument keys and error mapping.
// They do not prove live Supabase behaviour; that is covered by tests/unit/db-m03.test.ts (database) and is still unexecuted against Supabase.
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ eligible: vi.fn() }));
import { classify, repository } from "@/server/creator/service";
import { rateLimited } from "@/server/security/rate-limit";
import { identityDefaults } from "@/server/creator/defaults";
import { reminderDue } from "@/features/creator-onboarding/integration";

const fake = (data: unknown, error: { code?: string } | null = null) => {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc } as unknown as Parameters<typeof repository.state>[0] & {
    rpc: typeof rpc;
  };
};
describe("M03 service contract (mocked RPC)", () => {
  it("maps database failures to safe categories without leaking messages", () => {
    expect(classify({ code: "40001" })).toBe("conflict");
    expect(classify({ code: "42501" })).toBe("denied");
    expect(classify({ code: "55000" })).toBe("incomplete");
    for (const c of ["22023", "23514", "22P02", "23505"])
      expect(classify({ code: c })).toBe("invalid");
    expect(classify({ code: "XX000" })).toBe("failed");
    expect(classify(null)).toBe("failed");
  });
  it("calls the intended functions with workspace, revision and request identifiers", async () => {
    const c = fake({ ok: 1 });
    await repository.save(c, "ws", "goals", { goals: [] }, 4, "challenges");
    expect(c.rpc).toHaveBeenCalledWith("aura_creator_save_section", {
      p_workspace: "ws",
      p_section: "goals",
      p_payload: { goals: [] },
      p_revision: 4,
      p_next: "challenges",
    });
    await repository.activate(c, "ws", "req", { actions: [] });
    expect(c.rpc).toHaveBeenLastCalledWith("aura_creator_activate", {
      p_workspace: "ws",
      p_request: "req",
      p_plan: { actions: [] },
    });
  });
  it("never reports success when the database call failed", async () => {
    expect(await repository.state(fake(null, { code: "42501" }), "ws")).toEqual(
      { ok: false, error: "denied" },
    );
    expect(
      await repository.save(
        fake(null, { code: "40001" }),
        "ws",
        "goals",
        {},
        0,
        null,
      ),
    ).toEqual({ ok: false, error: "conflict" });
    expect(
      await repository.setAction(
        fake(null, { code: "42501" }),
        "ws",
        "a",
        true,
      ),
    ).toEqual({ ok: false, error: "denied" });
  });
  it("limits request bursts per user", () => {
    const now = 1_000_000;
    const results = Array.from({ length: 6 }, () =>
      rateLimited("test-user", 5, 60_000, now),
    );
    expect(results).toEqual([false, false, false, false, false, true]);
    expect(rateLimited("test-user", 5, 60_000, now + 61_000)).toBe(false);
  });
  it("reuses only safe M02 identity metadata as form defaults", () => {
    expect(
      identityDefaults({ user_metadata: { name: "Asha", country: "IN" } }),
    ).toEqual({ name: "Asha", country: "IN" });
    expect(
      identityDefaults({ user_metadata: { name: 42, country: "india" } }),
    ).toEqual({});
  });
  it("computes in-app refresh reminders from timestamps only", () => {
    expect(
      reminderDue("2026-01-01T00:00:00Z", Date.parse("2026-06-01T00:00:00Z")),
    ).toBe(true);
    expect(
      reminderDue("2026-05-20T00:00:00Z", Date.parse("2026-06-01T00:00:00Z")),
    ).toBe(false);
    expect(reminderDue(null)).toBe(false);
  });
});
