// Real-database tests for M20. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M20 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m20_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m20${x}_${stamp}`);
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
  "supabase/migrations/20261210000100_m18_selection.sql",
  "supabase/migrations/20261211000100_m19_monitoring.sql",
  "supabase/migrations/20261212000100_m20_brand_ai.sql",
  "supabase/migrations/20261212000200_reserve_brand_assistant_route.sql",
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
  "M20 database, Brand AI assistant: context, allowance, drafts and approvals (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m20_rls.sql"]));
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
    it("runs every M20 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(5);
      for (const must of [
        "access:",
        "context:",
        "allowance and history:",
        "drafts:",
        "gates:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M19, M18 and M11 suites still pass on the M20 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m19_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[1], ["-f", "tests/db/m18_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[2], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
    }, 600_000);
    it("RLS is on for every aura_brand_ai table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_tables where schemaname='aura_brand_ai'",
          ),
        ),
      ).toBe(7);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_brand_ai' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_brand_ai' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_brand\\_ai\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_brand_ai' or (n.nspname='public' and p.proname like 'aura\\_brand\\_ai\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("defaults: 100 requests a month, memory off, budget and competitors not shared, the assistant route is reserved", () => {
      expect(
        sql(
          "select value from aura_brand_ai.setting where key='monthly_requests'",
        ),
      ).toBe("100");
      expect(
        sql(
          "select column_default from information_schema.columns where table_schema='aura_brand_ai' and table_name='memory' and column_name='enabled'",
        ),
      ).toBe("false");
      expect(
        sql(
          "select count(*) from aura_brand.reserved_slug where word='assistant'",
        ),
      ).toBe("1");
    });

    describe("concurrency (separate database connections)", () => {
      it("parallel requests never exceed the monthly allowance", async () => {
        sql(
          "update aura_brand_ai.setting set value='3' where key='monthly_requests'",
        );
        sql("delete from aura_brand_ai.usage");
        const res = await Promise.all(
          [1, 2, 3, 4, 5, 6].map((n) =>
            session(
              `r${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_brand_ai_reserve(t.ws('c'));\nselect pg_sleep(0.2);\ncommit;\n`,
            ),
          ),
        );
        sql(
          "update aura_brand_ai.setting set value='100' where key='monthly_requests'",
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          res
            .map((r) =>
              r.out
                .trim()
                .split("\n")
                .filter((l) => l === "t" || l === "f")
                .pop(),
            )
            .filter((x) => x === "t"),
        ).toHaveLength(3);
        expect(sql("select sum(used) from aura_brand_ai.usage")).toBe("3");
      }, 60_000);
    });
  },
);
