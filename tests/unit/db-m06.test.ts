// Real-database tests for M06. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06 migrations on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m06_${stamp}`;
const extra = [
  `aura_m06a_${stamp}`,
  `aura_m06b_${stamp}`,
  `aura_m06c_${stamp}`,
];
const migrations = [
  "tests/db/fixtures/auth_stub.sql",
  "supabase/migrations/20261125000100_m02_identity.sql",
  "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
  "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  "tests/db/fixtures/storage_stub.sql",
  "supabase/migrations/20261128000100_m05_social_accounts.sql",
  "supabase/migrations/20261129000100_m06_creator_analytics.sql",
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
  "M06 database, RLS and analytics rules (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m06_rls.sql"]));
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

    it("runs every M06 SQL scenario group to completion", () => {
      expect(scenario.length).toBeGreaterThanOrEqual(12);
      for (const must of [
        "anonymous and direct",
        "metric semantics are versioned",
        "series returns only current",
        "manual tags",
        "audience snapshots",
        "insights deduplicate",
        "experiments: draft",
        "active-experiment limit",
        "peer cohorts",
        "audience sharing",
        "exports require purpose",
        "cross-tenant",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the existing M03, M04 and M05 database suites still pass on the M06 schema (regression)", () => {
      build(extra[0]);
      build(extra[1]);
      build(extra[2]);
      expect(
        results(run(extra[0], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
      expect(
        results(run(extra[1], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
      expect(
        results(run(extra[2], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
    }, 360_000);
    it("RLS is on for every aura_analytics table; nothing is granted to anon, authenticated or PUBLIC; no policies exist", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_tables where schemaname='aura_analytics'",
          ),
        ),
      ).toBeGreaterThanOrEqual(13);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_analytics' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_analytics' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_policies where schemaname='aura_analytics'",
        ),
      ).toBe("0");
    });
    it("M06 adds no competing observation or metric table and no score column", () => {
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_analytics' and tablename ~ '(observation|metric_def|snapshot_metric)'",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.columns where table_schema='aura_analytics' and column_name ~* '(score|rank|quality|rating)'",
        ),
      ).toBe("0");
    });
    it("only intended public functions are executable by authenticated, none by anon or PUBLIC, and private helpers are not exposed", () => {
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_analytics\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        Number(
          sql(
            "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_analytics\\_%' and grantee='authenticated'",
          ),
        ),
      ).toBe(
        Number(
          sql(
            "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\\_analytics\\_%'",
          ),
        ),
      );
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_analytics' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("no client function can create a proposed or AI-confirmed tag, a competitor or any provider data", () => {
      // Only reviewing an existing proposal is exposed; there is no function that inserts source 'ai_proposed'.
      const src = readFileSync(
        "supabase/migrations/20261129000100_m06_creator_analytics.sql",
        "utf8",
      );
      const inserts = [
        ...src.matchAll(/insert into aura_analytics\.content_tag[^;]*;/g),
      ].map((m) => m[0]);
      expect(inserts.length).toBeGreaterThan(0);
      for (const i of inserts)
        expect(i).not.toMatch(/ai_proposed|ai_confirmed|proposed/);
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ 'competitor'",
        ),
      ).toBe("0");
    });
    it("every SECURITY DEFINER function pins an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_analytics') and p.proname like 'aura%analytics%' and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("database metric semantics and derived calculations match the TypeScript definitions", async () => {
      const { aggregations } =
        await import("@/features/creator-analytics/semantics");
      const { derivedDefs } =
        await import("@/features/creator-analytics/engagement");
      const rows = sql(
        "select metric || '=' || array_to_string(aggregations, ',') from aura_analytics.metric_semantics where version = 1 order by metric",
      ).split("\n");
      expect(rows).toEqual(
        Object.entries(aggregations)
          .map(([m, a]) => `${m}=${a.join(",")}`)
          .sort(),
      );
      const d = sql(
        "select code || ':' || denominator_metric from aura_analytics.derived_def where scope='content' order by code",
      ).split("\n");
      expect(d).toEqual(
        Object.entries(derivedDefs)
          .map(([k, v]) => `${k}:${v.denominator}`)
          .sort(),
      );
      const win = sql(
        "select metric || '=' || window_semantics from aura_analytics.metric_semantics where metric in ('followers','reach','views','posts_total') order by metric",
      ).split("\n");
      expect(win).toEqual([
        "followers=snapshot",
        "posts_total=cumulative",
        "reach=interval",
        "views=either",
      ]);
    });
    it("no migration step deletes observations or rewrites applied history", () => {
      const m06 = readFileSync(
        "supabase/migrations/20261129000100_m06_creator_analytics.sql",
        "utf8",
      );
      expect(m06).not.toMatch(
        /delete from aura_social\.(account|content)_observation|drop table|drop function aura_(identity|studio|social|creator)|alter table aura_social\.(account|content)_observation/i,
      );
    });

    describe("concurrency (separate database connections)", () => {
      const mk = (k: string) =>
        sql(
          `do $$ declare a uuid[]; wid uuid; begin a := t.mkuser('${k}@example.test', false); insert into t.ids(k,u,s) values ('${k}',a[1],a[2]); perform t.me('${k}'); perform public.aura_complete_identity('Test ${k}','IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator ${k}',null); reset role; update t.ids set w=wid where t.ids.k='${k}'; end $$`,
        );
      const seed = async (k: string, handle: string) => {
        const r = await session(
          "seed",
          `select t.me('${k}');\nselect public.aura_social_add_account(t.ws('${k}'), gen_random_uuid(), '{"platform":"instagram","handle":"${handle}"}');\n`,
        );
        expect(r.code, r.err).toBe(0);
      };
      const acct = (k: string) =>
        sql(
          `select id from aura_creator.social_account where workspace_id=(select w from t.ids where k='${k}') limit 1`,
        );
      const draft = (k: string, n: number, extra = "") =>
        `select (public.aura_analytics_create_experiment(t.ws('${k}'), gen_random_uuid(), '${acct(k)}', '{"name":"Exp ${n}","hypothesis":"Hypothesis ${n}","metric":"followers","evaluation_days":7,"baseline_unavailable_reason":"new account"${extra}}'))->>'id'`;
      beforeAll(async () => {
        mk("m1");
        mk("m2");
        mk("m3");
        await seed("m1", "conc.one");
        await seed("m2", "conc.two");
        await seed("m3", "conc.three");
      });

      it("two simultaneous activations of one experiment: exactly one succeeds, the other is refused as already active", async () => {
        const id = (
          await session("c", `select t.me('m1');\n${draft("m1", 1)};\n`)
        ).out.trim();
        const act = (n: number) =>
          session(
            `a${n}`,
            `select t.me('m1');\nbegin;\nselect public.aura_analytics_activate_experiment(t.ws('m1'), '${id}');\nselect pg_sleep(0.5);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3].map(act));
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /Already active|cannot be started/.test(r.err)),
        ).toBe(true);
        expect(
          sql(
            `select count(*) from aura_analytics.experiment_event where experiment_id='${id}' and event='activated'`,
          ),
        ).toBe("1");
      }, 60_000);
      it("the active-experiment limit holds when five drafts are activated at the same time", async () => {
        const ids: string[] = [];
        for (let n = 1; n <= 5; n++)
          ids.push(
            (
              await session("c", `select t.me('m2');\n${draft("m2", n)};\n`)
            ).out.trim(),
          );
        const res = await Promise.all(
          ids.map((id, n) =>
            session(
              `l${n}`,
              `select t.me('m2');\nbegin;\nselect public.aura_analytics_activate_experiment(t.ws('m2'), '${id}');\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(3);
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /Too many active/.test(r.err)),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_analytics.experiment where status='active' and workspace_id=(select w from t.ids where k='m2')",
          ),
        ).toBe("3");
      }, 60_000);
      it("a duplicated create request with one request id makes exactly one experiment", async () => {
        const rid = "11111111-2222-4333-8444-555555555555";
        const one = (n: number) =>
          session(
            `d${n}`,
            `select t.me('m3');\nbegin;\nselect (public.aura_analytics_create_experiment(t.ws('m3'), '${rid}', '${acct("m3")}', '{"name":"Dup","hypothesis":"Hypothesis","metric":"followers","evaluation_days":7}'))->>'id';\nselect pg_sleep(0.4);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3, 4].map(one));
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          new Set(res.map((r) => r.out.trim().split("\n").pop())).size,
        ).toBe(1);
        expect(
          sql(
            "select count(*) from aura_analytics.experiment where name='Dup'",
          ),
        ).toBe("1");
      }, 60_000);
      it("simultaneous insight syncs with the same findings create each finding once", async () => {
        const items = JSON.stringify(
          [1, 2, 3].map((n) => ({
            fingerprint: `race:${n}`,
            category: "data_quality",
            rule_key: "rule.race",
            rule_version: 1,
            priority: 50,
            title: `Finding ${n}`,
            explanation: "Because.",
            evidence: { n },
            limitations: [],
            action: "Do",
            link: "/creator/analytics",
            data_hash: `h${n}`,
          })),
        ).replace(/'/g, "''");
        const res = await Promise.all(
          [1, 2, 3, 4].map((n) =>
            session(
              `s${n}`,
              `select t.me('m3');\nbegin;\nselect public.aura_analytics_sync_insights(t.ws('m3'), '${items}'::jsonb, array['rule.race']);\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_analytics.insight where rule_key='rule.race'",
          ),
        ).toBe("3");
      }, 60_000);
      it("a duplicated audience request with one request id stores one snapshot", async () => {
        const rid = "99999999-2222-4333-8444-555555555555";
        const one = (n: number) =>
          session(
            `u${n}`,
            `select t.me('m3');\nbegin;\nselect (public.aura_analytics_record_audience(t.ws('m3'), '${rid}', '${acct("m3")}', 'language', '[{"bucket":"English","share":55}]', current_date, null, null, 'unknown', null, null))->>'id';\nselect pg_sleep(0.3);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3].map(one));
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            `select count(*) from aura_analytics.audience_snapshot where request_id='${rid}'`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
