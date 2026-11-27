// Real-database tests for M18. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, migrations through M18 on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m18_${stamp}`;
const extra = ["a", "b", "c"].map((x) => `aura_m18${x}_${stamp}`);
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
  "M18 database, selection holds, comparison and the M12 hand-off (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m18_rls.sql"]));
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
    it("runs every M18 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(6);
      for (const must of [
        "access:",
        "holds:",
        "responses:",
        "revalidation:",
        "inbox:",
        "hand-off:",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M17, M14 and M11 suites still pass with the M18 triggers on the M11 tables (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m17_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(6);
      expect(
        results(run(extra[1], ["-f", "tests/db/m14_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        results(run(extra[2], ["-f", "tests/db/m11_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(11);
    }, 600_000);
    it("RLS is on for every aura_selection table, nothing is granted, no function is open to anon, search_path is pinned", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_tables where schemaname='aura_selection'",
          ),
        ),
      ).toBe(4);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_selection' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_selection' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_selection\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='aura_selection' or (n.nspname='public' and p.proname like 'aura\\_selection\\_%')) and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("holds and the hand-off are enforced by triggers on the M11 tables, and M12 provisioning stays internal", () => {
      expect(
        sql(
          "select string_agg(tgname, ',' order by tgname) from pg_trigger where tgname like 'm18%'",
        ),
      ).toBe("m18_guard_select,m18_handoff");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_collaboration' and routine_name='provision' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });

    describe("concurrency (separate database connections)", () => {
      it("two simultaneous holds for the last place hold exactly one", async () => {
        sql(
          `do $$ declare id uuid; begin perform t.mfa('c'); id := t.campaign('c', 'ugc', 'One place race', '{"positions":1,"compensation":{"money":{"type":"fixed","currency":"INR","min":2000}}}'); insert into t.x values ('race', id); perform public.aura_market_publish(t.ws('c'), id); reset role; end $$;`,
        );
        sql(
          `do $$ begin perform t.mkcreator('h'); perform t.activate('h'); perform t.me('h'); insert into t.x values ('acc_h', t.set_followers('h', 'hal.race', 700)); reset role; perform t.mkcreator('i'); perform t.activate('i'); perform t.me('i'); insert into t.x values ('acc_i', t.set_followers('i', 'ivy.race', 800)); reset role; end $$;`,
        );
        const ah = sql("select t.apply('h', t.g('race'), t.g('acc_h'))");
        const ai = sql("select t.apply('i', t.g('race'), t.g('acc_i'))");
        const res = await Promise.all(
          [ah, ai].map((app, n) =>
            session(
              `h${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_selection_hold(t.ws('c'), '${app}');\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(res.find((r) => r.code !== 0)!.err).toMatch(/filled or held/);
        expect(
          sql(
            "select count(*) from aura_selection.hold where campaign_id = t.g('race') and status = 'held'",
          ),
        ).toBe("1");
      }, 60_000);
      it("a Creator accepting while the Brand selects someone else directly never exceeds capacity", async () => {
        const held = sql(
          "select application_id from aura_selection.hold where campaign_id = t.g('race') and status = 'held'",
        );
        const other = sql(
          `select id from aura_apply.application where campaign_id = t.g('race') and id <> '${held}'`,
        );
        const who = sql(
          `select (select k from t.ids where w = creator_workspace_id) from aura_apply.application where id = '${held}'`,
        );
        const res = await Promise.all([
          session(
            "acc",
            `select t.me('${who}');\nbegin;\nselect public.aura_selection_respond(t.ws('${who}'), '${held}', true);\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
          session(
            "sel",
            `select t.mfa('c');\nbegin;\nselect public.aura_apply_decide(t.ws('c'), '${other}', 'select');\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
        ]);
        expect(
          res.filter((r) => r.code === 0).length,
          res.map((r) => r.err).join("|"),
        ).toBe(1);
        expect(
          Number(
            sql(
              "select count(*) from aura_apply.application where campaign_id = t.g('race') and status = 'selected'",
            ),
          ),
        ).toBe(1);
      }, 60_000);
    });
  },
);
