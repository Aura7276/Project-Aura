// Real-database tests for M04. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 (patched copy), M03 and M04 migrations on a minimal `auth` stub (NOT Supabase).
// Skipped runs are reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const db = `aura_m04_${process.pid}_${Date.now() % 100000}`;
const psqlArgs = (extra: string[] = []) => [
  "-X",
  "-q",
  "-v",
  "ON_ERROR_STOP=1",
  "-d",
  db,
  ...extra,
];
const run = (args: string[]) =>
  execFileSync("psql", args, { encoding: "utf8", maxBuffer: 10_000_000 });
const sql = (q: string) => run(psqlArgs(["-At", "-c", q])).trim();
// M02's migration ends one function with `end $;`, which PostgreSQL rejects. Tests apply a patched copy and do not edit M02.
const m02 = () =>
  readFileSync(
    "supabase/migrations/20261125000100_m02_identity.sql",
    "utf8",
  ).replace(/end \$;\s*$/m, "end $$$$;");
let results: string[] = [];

type Out = { label: string; code: number | null; out: string; err: string };
const session = (label: string, script: string) =>
  new Promise<Out>((resolve) => {
    const child = spawn(
      "psql",
      ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", db],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ label, code, out, err }));
    child.stdin.end(script);
  });
const lastLine = (s: string) => s.trim().split("\n").pop() ?? "";

describe.skipIf(!enabled)(
  "M04 database and RLS (disposable PostgreSQL, auth stub)",
  () => {
    beforeAll(() => {
      execFileSync("psql", [
        "-X",
        "-q",
        "-d",
        "postgres",
        "-c",
        `create database ${db}`,
      ]);
      run(psqlArgs(["-f", "tests/db/fixtures/auth_stub.sql"]));
      execFileSync("psql", psqlArgs(), { input: m02() });
      run(
        psqlArgs([
          "-f",
          "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
        ]),
      );
      run(
        psqlArgs([
          "-f",
          "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
        ]),
      );
      const out = run(psqlArgs(["-f", "tests/db/m04_rls.sql"]));
      results = out
        .split("---RESULTS---")[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^(name|-+|\(\d+ rows?\))$/.test(l));
    }, 120_000);
    afterAll(() => {
      try {
        execFileSync("psql", [
          "-X",
          "-q",
          "-d",
          "postgres",
          "-c",
          `drop database if exists ${db}`,
        ]);
      } catch {
        /* best effort */
      }
    });

    it("runs every SQL scenario group to completion", () => {
      expect(results.length).toBeGreaterThanOrEqual(18);
      for (const must of [
        "anonymous access denied",
        "cross-creator",
        "Brand workspace",
        "Agency workspace",
        "non-owner",
        "incomplete-onboarding",
        "idempotent",
        "observations:",
        "search and ideas",
        "weekly reviews",
        "widget preferences",
        "streak definition",
      ])
        expect(
          results.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("row level security is enabled on every aura_studio table and nothing is granted to anon, authenticated or PUBLIC", () => {
      expect(
        sql("select count(*) from pg_tables where schemaname='aura_studio'"),
      ).toBe("6");
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_studio' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_studio' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_studio'"),
      ).toBe("0");
    });
    it("exactly the 14 intended functions are executable by authenticated and none by anon", () => {
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_studio\\_%' and grantee='authenticated'",
        ),
      ).toBe("14");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema in ('public','aura_studio') and routine_name like 'aura\\_studio%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_studio' and grantee in ('authenticated','anon','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("all SECURITY DEFINER functions pin an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_studio') and p.proname like 'aura%studio%' and p.prosecdef and not (coalesce(p.proconfig,'{}') @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("observations are append-only: no function updates or deletes them", () => {
      const m04 = readFileSync(
        "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
        "utf8",
      );
      expect(m04).not.toMatch(
        /update aura_studio\.goal_observation|delete from aura_studio\.goal_observation/i,
      );
      expect(m04).not.toMatch(
        /alter table aura_(identity|creator)|drop (table|function) /i,
      );
    });
    it("two simultaneous first loads generate one set of three to five actions, and both callers see the same set", async () => {
      sql(
        "delete from aura_studio.daily_action where workspace_id=(select w from t.ids where k='b') and local_date=(now() at time zone 'Asia/Kolkata')::date",
      );
      const mk = (n: number, hold: number) =>
        `select t.me('b');\nbegin;\nselect public.aura_studio_ensure_actions(t.ws('b'), t.acts(${n}));\nselect pg_sleep(${hold});\ncommit;\n`;
      const first = session("three", mk(3, 1.2));
      await new Promise((r) => setTimeout(r, 300));
      const second = session("five", mk(5, 0));
      const [a, b] = await Promise.all([first, second]);
      expect(a.code, a.err).toBe(0);
      expect(b.code, b.err).toBe(0);
      const ids = (o: Out) =>
        (
          JSON.parse(
            lastLine(
              o.out
                .split("\n")
                .filter((l) => l.startsWith("["))
                .pop() ?? "[]",
            ),
          ) as { id: string }[]
        )
          .map((x) => x.id)
          .sort();
      expect(ids(a)).toEqual(ids(b));
      expect(ids(a).length).toBe(3); // the first writer wins; the second sees its rows instead of adding more
      expect(
        sql(
          "select count(*) from aura_studio.daily_action where workspace_id=(select w from t.ids where k='b') and local_date=(now() at time zone 'Asia/Kolkata')::date",
        ),
      ).toBe("3");
    }, 30_000);
    it("duplicate simultaneous observation submits with one request id create exactly one row", async () => {
      const rid = "11111111-2222-4333-8444-555555555555";
      const s = (hold: number) =>
        `select t.me('a');\nbegin;\nselect public.aura_studio_record_observation(t.ws('a'),'${rid}','audience_growth','follower_count',77,current_date,null);\nselect pg_sleep(${hold});\ncommit;\n`;
      const first = session("one", s(1));
      await new Promise((r) => setTimeout(r, 300));
      const second = session("two", s(0));
      const [a, b] = await Promise.all([first, second]);
      expect(a.code, a.err).toBe(0);
      expect(b.code, b.err).toBe(0);
      expect(
        sql(
          `select count(*) from aura_studio.goal_observation where request_id='${rid}'`,
        ),
      ).toBe("1");
    }, 30_000);
    it("conflicting simultaneous status changes never corrupt an action: one final status, and completion time is set once", async () => {
      const id = sql(
        "select id from aura_studio.daily_action where workspace_id=(select w from t.ids where k='b') and local_date=(now() at time zone 'Asia/Kolkata')::date order by created_at limit 1",
      );
      const s = (status: string, hold: number) =>
        `select t.me('b');\nbegin;\nselect public.aura_studio_set_action(t.ws('b'),'${id}','${status}');\nselect pg_sleep(${hold});\ncommit;\n`;
      const first = session("done", s("completed", 1));
      await new Promise((r) => setTimeout(r, 300));
      const second = session("skip", s("skipped", 0));
      const [a, b] = await Promise.all([first, second]);
      expect(a.code, a.err).toBe(0);
      expect(b.code, b.err).toBe(0);
      const row = sql(
        `select status || '|' || (status_at is not null)::text from aura_studio.daily_action where id='${id}'`,
      );
      expect(row).toBe("skipped|true"); // serialized by the row lock: the later change wins deterministically
    }, 30_000);
  },
);
