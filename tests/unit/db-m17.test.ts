// Real-database tests for M17. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M17 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m17_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m17${x}_${stamp}`);
const migrations = [
  "tests/db/fixtures/auth_stub.sql",
  "supabase/migrations/20261125000100_m02_identity.sql",
  "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
  "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  "tests/db/fixtures/storage_stub.sql",
  "supabase/migrations/20261128000100_m05_social_accounts.sql",
  "supabase/migrations/20261129000100_m06_creator_analytics.sql",
  "supabase/migrations/20261130000100_m07_growth_studio.sql",
  "supabase/migrations/20261130000200_m08_content_studio.sql",
  "supabase/migrations/20261201000100_m09_creator_profile.sql",
  "supabase/migrations/20261202000100_m10_campaign_marketplace.sql",
  "supabase/migrations/20261203000100_m11_applications.sql",
  "supabase/migrations/20261204000100_reserve_m07_m08_routes.sql",
  "supabase/migrations/20261205000100_m12_collaboration_workspace.sql",
  "supabase/migrations/20261206000100_m13_commercial_workspace.sql",
  "supabase/migrations/20261207000100_m14_brand_onboarding.sql",
  "supabase/migrations/20261207000200_reserve_m12_m13_routes.sql",
  "supabase/migrations/20261208000100_m15_brand_dashboard.sql",
  "supabase/migrations/20261208000200_reserve_brand_studio_routes.sql",
  "supabase/migrations/20261209000100_m17_campaign_management.sql",
];
const run = (db: string, args: string[]) =>
  execFileSync(
    "psql",
    ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args],
    { encoding: "utf8", maxBuffer: 20_000_000 },
  );
const sql = (q: string, db = main) => run(db, ["-At", "-c", q]).trim();
const build = (db: string) => {
  execFileSync("psql", [
    "-X",
    "-q",
    "-d",
    "postgres",
    "-c",
    `create database ${db}`,
  ]);
  for (const f of migrations) run(db, ["-f", f]);
};
const results = (out: string) =>
  out
    .split("---RESULTS---")[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(name|-+|\(\d+ rows?\))$/.test(l));
type Out = { label: string; code: number | null; out: string; err: string };
const session = (label: string, script: string) =>
  new Promise<Out>((resolve) => {
    const c = spawn(
      "psql",
      ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", main],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ label, code, out, err }));
    c.stdin.end(script);
  });
let scenario: string[] = [];

describe.skipIf(!enabled)(
  "M17 database, campaign management rules and guards (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m17_rls.sql"]));
    }, 240_000);
    afterAll(() => {
      for (const d of [main, ...extra])
        try {
          execFileSync("psql", [
            "-X",
            "-q",
            "-d",
            "postgres",
            "-c",
            `drop database if exists ${d}`,
          ]);
        } catch {
          /* best effort */
        }
    });
    it("runs every M17 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(6);
      for (const must of [
        "access:",
        "rollout:",
        "plan:",
        "positions:",
        "changes:",
        "management:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M14, M11 and M10 suites still pass with the M17 guards on the M10 tables (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m14_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        results(run(extra[1], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
      expect(
        results(run(extra[2], ["-f", "tests/db/m10_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(10);
    }, 600_000);
    it("RLS is on for every aura_campaign table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_tables where schemaname='aura_campaign'",
          ),
        ),
      ).toBe(3);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_campaign' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_campaign' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_campaign\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_campaign' or (n.nspname='public' and p.proname like 'aura\\_campaign\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("the rollout and positions guards live on the M10 tables, so no route can bypass them", () => {
      expect(
        sql(
          "select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid in ('aura_market.campaign'::regclass, 'aura_market.campaign_version'::regclass) and tgname like 'm17%'",
        ),
      ).toBe("m17_guard_publish,m17_version_published");
    });
    it("the TypeScript builder covers every M10 editor field exactly once", async () => {
      const { stepFields } = await import("@/features/campaigns/rules");
      const all = Object.values(stepFields).flat();
      expect(new Set(all).size).toBe(all.length);
      const src = readFileSync("src/features/marketplace/brand.tsx", "utf8");
      const block = src.slice(
        src.indexOf("export function fields("),
        src.indexOf("export async function BrandCampaignView"),
      );
      const names = [...block.matchAll(/name: "([a-z_]+)"/g)]
        .map((m) => m[1])
        .filter((n) => !["id", "w", "category"].includes(n));
      expect([...names].sort()).toEqual([...all].sort());
    });

    describe("concurrency (separate database connections)", () => {
      it("a cut in positions and a new selection at the same time never leave more Creators selected than positions", async () => {
        const camp = sql(
          "select id from aura_market.campaign where workspace_id = t.ws('c') and category = 'ugc' and status = 'published' and (select content->>'positions' from aura_market.campaign_version v where v.campaign_id = campaign.id and v.version = campaign.published_version) = '3'",
        );
        sql(
          `do $$ begin perform t.mkcreator('z'); perform t.activate('z'); perform t.me('z'); insert into t.x values ('acc_z', t.set_followers('z', 'zed.race', 500)); end $$;`,
        );
        const app = sql(`select t.apply('z', '${camp}', t.g('acc_z'))`);
        sql(
          `select t.mfa('c'); select public.aura_market_save_campaign(t.ws('c'), '${camp}', 'public', false, t.content('Two UGC creators wanted', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":3200}}}'))`,
        );
        const res = await Promise.all([
          session(
            "cut",
            `select t.mfa('c');\nbegin;\nselect public.aura_market_publish(t.ws('c'), '${camp}');\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
          session(
            "sel",
            `select t.mfa('c');\nbegin;\nselect public.aura_apply_decide(t.ws('c'), '${app}', 'select');\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
        ]);
        expect(
          res.filter((r) => r.code === 0).length,
          res.map((r) => r.err).join("|"),
        ).toBe(1);
        const pos = Number(
          sql(
            `select v.content->>'positions' from aura_market.campaign c join aura_market.campaign_version v on v.campaign_id = c.id and v.version = c.published_version where c.id = '${camp}'`,
          ),
        );
        const selected = Number(
          sql(
            `select count(*) from aura_apply.application where campaign_id = '${camp}' and status = 'selected'`,
          ),
        );
        expect(selected).toBeLessThanOrEqual(pos);
      }, 60_000);
      it("simultaneous duplicate requests with one request id make one copy", async () => {
        const camp = sql(
          "select id from aura_market.campaign where workspace_id = t.ws('c') and category = 'paid' limit 1",
        );
        const rid = "17171717-1717-4717-8717-171717171717";
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `d${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_campaign_duplicate(t.ws('c'), '${camp}', '${rid}')->>'id';\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          new Set(res.map((r) => r.out.trim().split("\n").pop())).size,
        ).toBe(1);
        expect(
          sql(
            `select count(*) from aura_market.campaign where request_id = '${rid}'`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
