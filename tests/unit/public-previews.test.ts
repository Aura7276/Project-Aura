import { it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/config/environment", () => ({
  providerConfig: () => ({ url: "https://example.invalid", key: "fixture" }),
}));
import { publicPreviews } from "../../src/server/publication/previews";
import { entryIntent } from "../../src/features/public-site/intent";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("projects only the public creator contract", async () => {
  vi.stubEnv("AURA_PUBLIC_PROJECTIONS_ENABLED", "true");
  const get = vi.fn().mockResolvedValue(
    Response.json([
      {
        slug: "sample",
        display_name: "Preview",
        bio: null,
        email: "private@example.invalid",
      },
    ]),
  );
  vi.stubGlobal("fetch", get);
  expect((await publicPreviews("creator", "sample")).items).toEqual([
    { slug: "sample", title: "Preview", summary: null },
  ]);
  expect(get.mock.calls[0][0].searchParams.get("select")).toBe(
    "slug,display_name,bio",
  );
  expect(get.mock.calls[0][1].cache).toBe("no-store");
});
it("fails closed on a provider error", async () => {
  vi.stubEnv("AURA_PUBLIC_PROJECTIONS_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
  );
  expect(await publicPreviews("campaign")).toEqual({
    available: false,
    items: [],
  });
});
it("rejects foreign and malformed entry targets", () => {
  expect(entryIntent("invite", "//elsewhere")).toBeNull();
  expect(entryIntent("campaign", "sample")?.returnTo).toBe("/campaign/sample");
});
