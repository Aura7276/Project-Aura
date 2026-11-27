// Real-database tests for M23. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M23 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m23_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m23${x}_${stamp}`);
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
  "supabase/migrations/20261216000100_m23_agency.sql",
  "supabase/migrations/20261216000200_reserve_agency_creator_route.sql",
  "supabase/migrations/20261216000300_reserve_agency_brand_routes.sql",
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
  "M23 database, Agency delegation enforced in the shared access checks: Brand AI assistant: context, allowance, drafts and approvals (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m23_rls.sql"]));
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
    it("runs every M23 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(6);
      for (const must of [
        "foundation:",
        "grants:",
        "enforcement:",
        "approvals and revocation:",
        "dual representation:",
        "fees and offboarding:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M21, M11 and M05 suites still pass with delegation in the shared access checks (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m21_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(5);
      expect(
        results(run(extra[1], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
      expect(
        results(run(extra[2], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
    }, 900_000);
    it("RLS is on for every aura_agency table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_agency'"),
        ),
      ).toBe(12);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_agency' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_agency' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema in ('public','aura_agency') and routine_name like 'aura\\_agency%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_agency' or (n.nspname='public' and p.proname like 'aura\\_agency\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("every public function is either in a delegable area or refused; consent, verification, deletion and Agency functions are never delegable", () => {
      const unmapped = sql(
        "select string_agg(proname, ' ') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'aura\\_%' and not exists(select 1 from aura_agency.scope_rule r where p.proname ~ r.pattern)",
      );
      // Unmapped functions are refused by delegation (fail closed); they must be identity/public functions that never reach the shared checks.
      for (const f of unmapped.split(" ").filter(Boolean))
        expect(f, f).toMatch(
          /^aura_(workspaces|identity_state|security_state|is_admin|privileged_mfa|complete_identity|attribute_referral|public_|collaboration_|commercial_)/,
        );
      for (const f of [
        "aura_monitor_consent",
        "aura_social_grant_share",
        "aura_brand_delete",
        "aura_brand_verification_submit",
        "aura_social_submit_evidence",
        "aura_analytics_grant_audience",
        "aura_agency_client_grant",
        "aura_profile_create_share",
      ])
        expect(
          sql(
            `select (select scope from aura_agency.scope_rule r where '${f}' ~ r.pattern order by position limit 1)`,
          ),
          f,
        ).toBe("never");
      expect(
        sql(
          "select string_agg(distinct q.s, ',') from (select (select r.scope from aura_agency.scope_rule r where p.proname ~ r.pattern order by r.position limit 1) s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname ~ '^aura_(apply_confirm|selection_respond|apply_respond_invitation)$') q",
        ),
      ).toBe("applications");
      expect(
        sql(
          "select count(*) from aura_brand.reserved_slug where word in ('agency','agencies')",
        ),
      ).toBe("2");
    });

    describe("concurrency (separate database connections)", () => {
      it("one invitation accepted twice at the same time makes one relationship", async () => {
        sql(
          "delete from aura_agency.relationship where agency_ws = t.ws('d') and client_ws = t.ws('e')",
        );
        const tok = run(main, [
          "-At",
          "-c",
          "select t.mfa('d'); select public.aura_agency_invite_client(t.ws('d'), 'creator', 'Creator e', '[\"view\"]', false, 3, null);",
        ])
          .trim()
          .split("\n")
          .pop();
        const res = await Promise.all(
          [1, 2].map((n) =>
            session(
              `a${n}`,
              `select t.mfa('e');\nbegin;\nselect public.aura_agency_accept('${tok}', t.ws('e'), '["view"]', false, 3)->>'relationship';\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          sql(
            "select count(*) from aura_agency.relationship where agency_ws = t.ws('d') and client_ws = t.ws('e') and status = 'active'",
          ),
        ).toBe("1");
      }, 60_000);
      it("simultaneous grant changes leave exactly one current grant", async () => {
        const rel = sql(
          "select id from aura_agency.relationship where agency_ws = t.ws('d') and client_ws = t.ws('e') and status = 'active'",
        );
        const res = await Promise.all(
          [["view"], ["view", "content"], ["view", "results"]].map((s, n) =>
            session(
              `g${n}`,
              `select t.mfa('e');\nbegin;\nselect public.aura_agency_client_grant(t.ws('e'), '${rel}', '${JSON.stringify(s)}', false, 2)->>'grant';\nselect pg_sleep(0.2);\ncommit;\n`,
            ),
          ),
        );
        expect(res.some((r) => r.code === 0)).toBe(true);
        expect(
          sql(
            `select count(*) from aura_agency.grant_ where relationship_id = '${rel}' and ended_at is null`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
