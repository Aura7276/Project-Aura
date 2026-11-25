// Real-database tests. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 + M03 migrations on top of a minimal `auth` stub (tests/db/fixtures/auth_stub.sql).
// This is NOT Supabase: Auth, PostgREST and Storage are not exercised. Skipped runs are reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  challengeCodes,
  industryCodes,
  nicheCodes,
} from "@/features/creator-onboarding/taxonomy";

const enabled = process.env.AURA_TEST_DB === "1";
const db = `aura_m03_${process.pid}_${Date.now() % 100000}`;
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
let taxonomyCsv: string[] = [];

describe.skipIf(!enabled)(
  "M03 database and RLS (disposable PostgreSQL, auth stub)",
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
      const out = run(psqlArgs(["-f", "tests/db/m03_rls.sql"]));
      const [csv, res] = out.split("---RESULTS---");
      taxonomyCsv = csv
        .trim()
        .split("\n")
        .filter((l) => /^(niche|industry|challenge),/.test(l));
      results = res
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

    it("runs every SQL scenario group to completion (anonymous, cross-creator, Brand, Agency, non-owner, activation, social, preferences, rates, atomicity)", () => {
      expect(results.length).toBeGreaterThanOrEqual(17);
      for (const must of [
        "anonymous access denied",
        "cross-creator",
        "Brand access",
        "Agency access",
        "non-owner",
        "duplicate activation",
        "aspiring creator activates",
      ])
        expect(
          results.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("row level security is enabled on every aura_creator table and nothing is granted to anon or authenticated", () => {
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_creator' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_creator'"),
        ),
      ).toBeGreaterThanOrEqual(15);
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_creator' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_creator'"),
      ).toBe("0"); // default deny, no permissive policy
    });
    it("only the six intended functions are executable by authenticated, and none by anon", () => {
      const fns = sql(
        "select string_agg(routine_name, ',' order by routine_name) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura_creator_%' and grantee='authenticated'",
      );
      expect(fns).toBe(
        "aura_creator_activate,aura_creator_begin,aura_creator_save_section,aura_creator_set_action,aura_creator_skip_step,aura_creator_state",
      );
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema in ('public','aura_creator') and routine_name like 'aura_creator_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("all SECURITY DEFINER functions pin an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_creator') and p.proname like 'aura_creator%' and p.prosecdef and not (coalesce(p.proconfig,'{}') @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("taxonomy in code matches the database reference tables exactly", () => {
      const db = (k: string) =>
        taxonomyCsv
          .filter((l) => l.startsWith(k + ","))
          .map((l) => l.split(",")[1])
          .sort();
      expect(db("niche")).toEqual([...nicheCodes].sort());
      expect(db("industry")).toEqual([...industryCodes].sort());
      expect(db("challenge")).toEqual([...challengeCodes].sort());
    });
    it("resumes persisted state from a brand new database connection (save and exit, then login)", () => {
      const out = run(
        psqlArgs([
          "-At",
          "-c",
          "select t.me('b')",
          "-c",
          "select public.aura_creator_state(t.ws('b'))->'onboarding'->'steps'->>'identity'",
        ]),
      )
        .trim()
        .split("\n")
        .pop();
      expect(out).toBe("completed");
    });
    it("two simultaneous writers cannot corrupt state: exactly one wins, the other gets a revision conflict", async () => {
      const rev = Number(
        run(
          psqlArgs([
            "-At",
            "-c",
            "select t.me('b')",
            "-c",
            "select (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int",
          ]),
        )
          .trim()
          .split("\n")
          .pop(),
      );
      const writer = (label: string, hold: number) =>
        new Promise<{ label: string; code: number | null; err: string }>(
          (resolve) => {
            const input = `select t.me('b');\nbegin;\nselect public.aura_creator_save_section(t.ws('b'),'challenges','{"challenges":[{"code":"${label}"}]}',${rev});\nselect pg_sleep(${hold});\ncommit;\n`;
            const child = spawn(
              "psql",
              ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", db],
              { stdio: ["pipe", "ignore", "pipe"] },
            );
            let err = "";
            child.stderr.on("data", (d) => (err += d));
            child.on("close", (code) => resolve({ label, code, err }));
            child.stdin.end(input);
          },
        );
      const first = writer("content_ideas", 1.5);
      await new Promise((r) => setTimeout(r, 400));
      const second = writer("hooks", 0);
      const [a, b] = await Promise.all([first, second]);
      const winners = [a, b].filter((r) => r.code === 0);
      const losers = [a, b].filter((r) => r.code !== 0);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(losers[0].err).toMatch(/Revision conflict/);
      const stored = sql(
        "select string_agg(code, ',') from aura_creator.challenge where workspace_id=(select w from t.ids where k='b')",
      );
      expect(stored).toBe(winners[0].label);
    }, 30_000);
    it("the M03 migration touches no M02 table definitions", () => {
      const m03 = readFileSync(
        "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
        "utf8",
      );
      expect(m03).not.toMatch(
        /alter table aura_identity|drop (table|function) /i,
      );
    });
  },
);
