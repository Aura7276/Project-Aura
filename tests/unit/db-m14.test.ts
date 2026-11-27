// Real-database tests for M14. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, M07 to M11 and M14 migrations on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m14_${stamp}`;
const extra = ["a", "b", "c", "d", "e", "f", "g"].map(
  (x) => `aura_m14${x}_${stamp}`,
);
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
  "M14 database, RLS, Brand onboarding and business verification (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m14_rls.sql"]));
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
    it("runs every M14 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(10);
      for (const must of [
        "anonymous, direct",
        "onboarding:",
        "catalogue,",
        "Brand social accounts",
        "maturity has no score",
        "verification:",
        "rejection with reasons",
        "revalidation:",
        "public profile:",
        "tenant isolation",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M11, M10, M09, M06, M05, M04 and M03 database suites still pass on the M14 schema, with M07 and M08 applied (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
      expect(
        results(run(extra[1], ["-f", "tests/db/m10_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        results(run(extra[2], ["-f", "tests/db/m09_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(8);
      expect(
        results(run(extra[3], ["-f", "tests/db/m06_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(12);
      expect(
        results(run(extra[4], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
      expect(
        results(run(extra[5], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
      expect(
        results(run(extra[6], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
    }, 900_000);
    it("RLS is on for every aura_brand table; nothing is granted to anon, authenticated or PUBLIC; no policies exist", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_brand'"),
        ),
      ).toBeGreaterThanOrEqual(15);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_brand' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_brand' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_brand'"),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_brand' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("anon can execute only the public Brand profile function, and every function pins an empty search_path", () => {
      expect(
        sql(
          "select string_agg(routine_name, ',') from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_brand\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("aura_brand_public");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_brand' or (n.nspname='public' and p.proname like 'aura\\_brand\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
      expect(
        Number(
          sql(
            "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\\_brand\\_%'",
          ),
        ),
      ).toBeGreaterThanOrEqual(26);
    });
    it("every static Brand route is a reserved public address, and the TypeScript evidence matrix and business types match the database", async () => {
      const reserved = sql(
        "select string_agg(word, ',') from aura_brand.reserved_slug",
      ).split(",");
      const routes = [
        ...readdirSync("src/app/(brand)/brand", { withFileTypes: true }),
        ...readdirSync("src/app/brand", { withFileTypes: true }),
      ]
        .filter((d) => d.isDirectory() && !d.name.startsWith("["))
        .map((d) => d.name);
      for (const r of routes) expect(reserved, r).toContain(r);
      const { evidenceMatrix, businessTypes } =
        await import("@/features/brand/rules");
      expect(
        JSON.parse(
          sql(
            "select value from aura_brand.setting where key='evidence_matrix'",
          ),
        ),
      ).toEqual(evidenceMatrix);
      const def = sql(
        "select pg_get_constraintdef(oid) from pg_constraint where conrelid='aura_brand.profile'::regclass and conname like '%business_type%'",
      );
      const db = def
        .match(/'([a-z0-9_]+)'/g)!
        .map((x) => x.slice(1, -1))
        .sort();
      expect(db).toEqual(Object.keys(businessTypes).sort());
    });
    it("the M14 migration only redefines the M09 enquiry stub and rewrites no earlier history", () => {
      const m = readFileSync(
        "supabase/migrations/20261207000100_m14_brand_onboarding.sql",
        "utf8",
      );
      expect(m).not.toMatch(
        /drop table|drop function|delete from aura_(social|creator|analytics|profile|identity|market|apply)|alter table aura_(identity|market|apply|profile)/i,
      );
      expect(m.match(/create or replace function (\S+)/gi)).toEqual([
        "create or replace function aura_profile.brand_verified(p_workspace",
      ]);
    });

    describe("concurrency (separate database connections)", () => {
      it("simultaneous additions never take a Brand past 10 social accounts (AC08)", async () => {
        sql(
          "select t.mfa('r3'); select public.aura_brand_save_social(t.ws('c2'), jsonb_build_object('platform','instagram','handle','base' || i)) from generate_series(1, 8) i;",
        );
        const res = await Promise.all(
          [1, 2, 3, 4, 5].map((n) =>
            session(
              `s${n}`,
              `select t.mfa('r3');\nbegin;\nselect public.aura_brand_save_social(t.ws('c2'), '{"platform":"youtube","handle":"race${n}"}');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(2);
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /Limit reached/.test(r.err)),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_brand.social_account where workspace_id = t.ws('c2')",
          ),
        ).toBe("10");
      }, 60_000);
      it("simultaneous drafts open exactly one verification case per workspace", async () => {
        sql(
          "do $$ declare a uuid[]; wid uuid; begin a := t.mkuser('m14race@example.test', true); insert into t.ids(k,u,s) values ('z', a[1], a[2]); insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) values (a[1], gen_random_uuid(), 'brand', 'Race Brand', 'startup') returning id into wid; insert into aura_identity.membership values (wid, a[1], 'owner', true); update t.ids set w = wid where k = 'z'; end $$;",
        );
        sql(
          "select t.mfa('z'); select public.aura_complete_identity('Test z','IN',true,''); select public.aura_brand_save_profile(t.ws('z'), '{\"public_name\":\"Race Brand\"}');",
        );
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `c${n}`,
              `select t.mfa('z');\nbegin;\nselect public.aura_brand_verification_save(t.ws('z'), '{"legal_name":"Race ${n} Ltd"}');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_brand.verification_case where workspace_id = t.ws('z')",
          ),
        ).toBe("1");
      }, 60_000);
      it("two reviewers deciding one case at the same time record exactly one decision", async () => {
        sql(
          'select t.mfa(\'z\'); select public.aura_brand_verification_save(t.ws(\'z\'), \'{"legal_name":"Race Ltd","registration_number":"U12345","registered_address":"1 Road","representative_name":"Zed","representative_role":"Founder"}\'); select public.aura_brand_verification_submit(t.ws(\'z\'), true);',
        );
        const id = sql(
          "select id from aura_brand.verification_case where workspace_id = t.ws('z')",
        );
        const res = await Promise.all(
          [
            ["r", "approved"],
            ["r2", "rejected"],
          ].map(([k, d]) =>
            session(
              k,
              `select t.mfa('${k}');\nbegin;\nselect public.aura_brand_review_decide('${id}', '${d}', 'Decided in a race test');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(res.find((r) => r.code !== 0)!.err).toMatch(/already decided/);
        expect(
          sql(
            `select count(*) from aura_brand.verification_event where case_id = '${id}' and side = 'reviewer'`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
