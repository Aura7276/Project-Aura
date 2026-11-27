// Real-database tests for M19. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M19 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m19_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m19${x}_${stamp}`);
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
  "M19 database, campaign monitoring and versioned reports (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m19_rls.sql"]));
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
    it("runs every M19 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(6);
      for (const must of [
        "access:",
        "recording:",
        "totals:",
        "separation:",
        "reports:",
        "creator view:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M18, M17 and M11 suites still pass on the M19 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m18_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[1], ["-f", "tests/db/m17_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[2], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
    }, 600_000);
    it("RLS is on for every aura_monitor table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_monitor'"),
        ),
      ).toBe(5);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_monitor' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_monitor' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_monitor\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_monitor' or (n.nspname='public' and p.proname like 'aura\\_monitor\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("every metric has a label and a definition, and reach is marked as not unique", async () => {
      const defs = JSON.parse(
        sql("select value from aura_monitor.setting where key = 'metrics'"),
      ) as Record<
        string,
        { label: string; definition: string; not_unique?: boolean }
      >;
      for (const [k, d] of Object.entries(defs)) {
        expect(d.label.length, k).toBeGreaterThan(2);
        expect(d.definition.length, k).toBeGreaterThan(20);
      }
      expect(defs.reach.not_unique).toBe(true);
    });

    describe("concurrency (separate database connections)", () => {
      it("simultaneous reports with the same name get distinct versions", async () => {
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `r${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_monitor_create_report(t.ws('c'), t.g('mon'), 'Race report', array['delivery'], null, null)->>'version';\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          new Set(res.map((r) => r.out.trim().split("\n").pop())).size,
        ).toBe(3);
        expect(
          sql(
            "select string_agg(version::text, ',' order by version) from aura_monitor.report where name = 'Race report'",
          ),
        ).toBe("1,2,3");
      }, 60_000);
    });
  },
);
