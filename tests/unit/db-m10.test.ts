// Real-database tests for M10. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, M09 and M10 migrations on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m10_${stamp}`;
const extra = ["a", "b", "c", "d", "e"].map((x) => `aura_m10${x}_${stamp}`);
const migrations = [
  "tests/db/fixtures/auth_stub.sql",
  "supabase/migrations/20261125000100_m02_identity.sql",
  "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
  "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  "tests/db/fixtures/storage_stub.sql",
  "supabase/migrations/20261128000100_m05_social_accounts.sql",
  "supabase/migrations/20261129000100_m06_creator_analytics.sql",
  "supabase/migrations/20261201000100_m09_creator_profile.sql",
  "supabase/migrations/20261202000100_m10_campaign_marketplace.sql",
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
  "M10 database, RLS and marketplace rules (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m10_rls.sql"]));
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
    it("runs every M10 SQL scenario group to completion", () => {
      expect(scenario.length).toBeGreaterThanOrEqual(10);
      for (const must of [
        "anonymous and direct",
        "brand drafting",
        "interim verification",
        "disclosure:",
        "eligibility:",
        "feed:",
        "versions:",
        "saved searches",
        "reports need visibility",
        "tenant isolation",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M09, M06, M05, M04 and M03 database suites still pass on the M10 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m09_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(8);
      expect(
        results(run(extra[1], ["-f", "tests/db/m06_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(12);
      expect(
        results(run(extra[2], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
      expect(
        results(run(extra[3], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
      expect(
        results(run(extra[4], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
    }, 600_000);
    it("RLS is on for every aura_market table; nothing is granted to anon, authenticated or PUBLIC; no policies exist", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_market'"),
        ),
      ).toBeGreaterThanOrEqual(12);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_market' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_market' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_market'"),
      ).toBe("0");
    });
    it("anon can only read the allowlisted public campaign preview; no marketplace function is executable by anon", () => {
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_market\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_schema='public' and table_name='m01_public_campaign_previews' and grantee='anon'",
        ),
      ).toBe("SELECT");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_market' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("every SECURITY DEFINER function pins an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_market') and p.proname like 'aura%market%' and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("the marketplace Studio route is a reserved username, and the TypeScript category list matches the database", async () => {
      expect(
        sql(
          "select count(*) from aura_profile.reserved_username where word='marketplace'",
        ),
      ).toBe("1");
      const { categories } = await import("@/features/marketplace/rules");
      const def = sql(
        "select pg_get_constraintdef(oid) from pg_constraint where conrelid='aura_market.campaign'::regclass and conname like '%category%'",
      );
      for (const k of Object.keys(categories)) expect(def).toContain(`'${k}'`);
      const { collaborationCategories } =
        await import("@/features/creator-onboarding/taxonomy");
      expect(Object.keys(categories)).toHaveLength(6);
      expect((collaborationCategories as readonly unknown[]).length).toBe(6);
    });
    it("the migration rewrites no earlier history", () => {
      const m = readFileSync(
        "supabase/migrations/20261202000100_m10_campaign_marketplace.sql",
        "utf8",
      );
      expect(m).not.toMatch(
        /drop table|drop function aura_(identity|studio|social|creator|analytics|profile)|delete from aura_(social|creator|analytics|profile|identity)|alter table aura_identity/i,
      );
    });

    describe("concurrency (separate database connections)", () => {
      it("two simultaneous publications of one draft go live once with one version", async () => {
        const id = sql(
          "select t.mfa('c'); select t.campaign('c', 'barter', 'Race barter campaign', '{\"compensation\":{\"products\":{\"description\":\"A hamper\"}}}')",
        )
          .split("\n")
          .pop()!;
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `p${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_market_publish(t.ws('c'), '${id}');\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0).length).toBeGreaterThanOrEqual(
          1,
        );
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /Nothing to publish/.test(r.err)),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            `select count(*) from aura_market.campaign_version where campaign_id='${id}' and published_at is not null`,
          ),
        ).toBe("1");
      }, 60_000);
      it("a duplicated create request with one request id makes exactly one campaign", async () => {
        const rid = "12121212-3434-4565-8787-909090909090";
        const res = await Promise.all(
          [1, 2, 3, 4].map((n) =>
            session(
              `d${n}`,
              `select t.mfa('c');\nbegin;\nselect (public.aura_market_create_campaign(t.ws('c'), '${rid}', 'paid', 'Duplicate request campaign'))->>'id';\nselect pg_sleep(0.3);\ncommit;\n`,
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
            `select count(*) from aura_market.campaign where request_id='${rid}'`,
          ),
        ).toBe("1");
      }, 60_000);
      it("simultaneous reports by one Creator on one campaign leave one open report", async () => {
        const id = sql(
          "select id from aura_market.campaign where status='published' and visibility='public' order by published_at desc limit 1",
        );
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `r${n}`,
              `select t.me('e');\nbegin;\nselect public.aura_market_report(t.ws('e'), '${id}', 'spam', null);\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          sql(
            `select count(*) from aura_market.report where campaign_id='${id}' and reporter_workspace_id=(select w from t.ids where k='e') and status='open'`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
