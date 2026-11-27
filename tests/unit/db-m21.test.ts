// Real-database tests for M21. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M21 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m21_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m21${x}_${stamp}`);
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
  "supabase/migrations/20261213000100_m21_brand_content.sql",
  "supabase/migrations/20261213000200_m21_assistant_content.sql",
  "supabase/migrations/20261213000300_reserve_brand_content_route.sql",
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
  "M21 database, Brand AI assistant: context, allowance, drafts and approvals (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m21_rls.sql"]));
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
    it("runs every M21 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(5);
      for (const must of [
        "access:",
        "workflow:",
        "repurposing:",
        "results and assets:",
        "one product:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M20, M19 and M11 suites still pass on the M21 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m20_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(5);
      expect(
        results(run(extra[1], ["-f", "tests/db/m19_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[2], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
    }, 600_000);
    it("RLS is on for every aura_brand_content table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_tables where schemaname='aura_brand_content'",
          ),
        ),
      ).toBe(7);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_brand_content' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_brand_content' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_brand\\_content\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname in ('aura_brand_content','aura_brand_ai') or (n.nspname='public' and (p.proname like 'aura\\_brand\\_content\\_%' or p.proname like 'aura\\_brand\\_ai\\_%'))) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("no content function can post to a platform or reach Creators, and the content route is reserved", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\\_brand\\_content\\_%' and pg_get_functiondef(p.oid) ~* 'http_|net\\.|aura_apply_invite|aura_apply_enquire|aura_collaboration_command'",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from aura_brand.reserved_slug where word='content'",
        ),
      ).toBe("1");
    });

    describe("concurrency (separate database connections)", () => {
      it("two people saving the same version: one wins, the other is told to reload", async () => {
        const item = sql(
          "select id from aura_brand_content.item where title = 'Bunk bed makeover'",
        );
        const v = sql(
          `select version from aura_brand_content.item where id = '${item}'`,
        );
        const res = await Promise.all(
          ["Edit A", "Edit B"].map((title, n) =>
            session(
              `e${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_brand_content_save(t.ws('c'), '${item}', ${v}, '{"title":"${title}","hook":"x"}')->>'version';\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          res
            .filter((r) => r.code !== 0)
            .map((r) => r.err)
            .join(""),
        ).toMatch(/newer version/);
        expect(
          sql(
            `select version from aura_brand_content.item where id = '${item}'`,
          ),
        ).toBe(String(Number(v) + 1));
      }, 60_000);
      it("parallel pillars never push the mix past 100%", async () => {
        const before = Number(
          sql(
            "select coalesce(sum(mix), 0) from aura_brand_content.pillar where not archived and workspace_id = t.ws('c')",
          ),
        );
        const room = 100 - before;
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `p${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_brand_content_save_pillar(t.ws('c'), null, 'Race ${n}', null, ${Math.ceil(room / 2)})->>'mix_total';\nselect pg_sleep(0.2);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0).length).toBeLessThanOrEqual(2);
        expect(
          Number(
            sql(
              "select sum(mix) from aura_brand_content.pillar where not archived and workspace_id = t.ws('c')",
            ),
          ),
        ).toBeLessThanOrEqual(100);
      }, 60_000);
    });
  },
);
