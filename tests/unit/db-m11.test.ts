// Real-database tests for M11. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06, M09, M10 and M11 migrations on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m11_${stamp}`;
const extra = ["a", "b", "c", "d", "e", "f"].map(
  (x) => `aura_m11${x}_${stamp}`,
);
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
  "supabase/migrations/20261203000100_m11_applications.sql",
  "supabase/migrations/20261204000100_reserve_m07_m08_routes.sql",
  "supabase/migrations/20261207000200_reserve_m12_m13_routes.sql",
  "supabase/migrations/20261216000200_reserve_agency_creator_route.sql",
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
  "M11 database, RLS, applications, invitations and negotiation (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m11_rls.sql"]));
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
    it("runs every M11 SQL scenario group to completion", () => {
      expect(scenario).toHaveLength(11);
      for (const must of [
        "anonymous and direct",
        "rules and screening",
        "applying:",
        "eligibility re-checked at submission",
        "edits create versions",
        "selection capacity",
        "withdrawal with confirmation",
        "invitations:",
        "enquiries:",
        "negotiation:",
        "tenant isolation",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the M10, M09, M06, M05, M04 and M03 database suites still pass on the M11 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m10_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        results(run(extra[1], ["-f", "tests/db/m09_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(8);
      expect(
        results(run(extra[2], ["-f", "tests/db/m06_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(12);
      expect(
        results(run(extra[3], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
      expect(
        results(run(extra[4], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
      expect(
        results(run(extra[5], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
    }, 900_000);
    it("RLS is on for every aura_apply table; nothing is granted to anon, authenticated or PUBLIC; no policies exist", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_apply'"),
        ),
      ).toBeGreaterThanOrEqual(15);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_apply' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_apply' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_apply'"),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_apply' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("no application function is executable by anon, and every one pins an empty search_path", () => {
      expect(
        Number(
          sql(
            "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\\_apply\\_%'",
          ),
        ),
      ).toBeGreaterThanOrEqual(32);
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_apply\\_%' and grantee in ('anon','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_apply') and (p.proname like 'aura\\_apply\\_%' or n.nspname='aura_apply') and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("the reserved username list in the database equals the TypeScript list, and every Studio route under /creator is reserved", async () => {
      const { reservedUsernames } =
        await import("@/features/creator-profile/rules");
      const db = sql(
        "select string_agg(word, ',' order by word) from aura_profile.reserved_username",
      ).split(",");
      expect(db).toEqual([...reservedUsernames].sort());
      const studio = readdirSync("src/app/(studio)/creator", {
        withFileTypes: true,
      })
        .filter(
          (d) =>
            d.isDirectory() &&
            !d.name.startsWith("[") &&
            !d.name.startsWith("("),
        )
        .map((d) => d.name);
      for (const r of studio) expect(db, r).toContain(r);
    });
    it("the TypeScript status labels cover every application status in the database", async () => {
      const { appStatus } = await import("@/features/applications/rules");
      const def = sql(
        "select pg_get_constraintdef(oid) from pg_constraint where conrelid='aura_apply.application'::regclass and conname like '%status%'",
      );
      for (const k of def.match(/'([a-z_]+)'/g)!.map((x) => x.slice(1, -1)))
        expect(appStatus, k).toHaveProperty(k);
    });
    it("the migration rewrites no earlier history", () => {
      const m = readFileSync(
        "supabase/migrations/20261203000100_m11_applications.sql",
        "utf8",
      );
      expect(m).not.toMatch(
        /drop table|drop function aura_(identity|studio|social|creator|analytics|profile|market)|delete from aura_(social|creator|analytics|profile|identity|market)|alter table aura_(identity|market)/i,
      );
    });

    describe("concurrency (separate database connections)", () => {
      let camp = "";
      beforeAll(() => {
        // two fresh Creators and a one-position UGC campaign from the verified Brand c
        sql(
          "select t.mkcreator('g'); select t.activate('g'); select t.mkcreator('h'); select t.activate('h');",
        );
        sql(
          "select t.me('g'); insert into t.x values ('acc_g', t.set_followers('g', 'gia.race', 800)); reset role;",
        );
        sql(
          "select t.me('h'); insert into t.x values ('acc_h', t.set_followers('h', 'hal.race', 900)); reset role;",
        );
        camp = sql(
          'select t.mfa(\'c\'); select t.campaign(\'c\', \'ugc\', \'Race UGC campaign\', \'{"positions":1,"compensation":{"money":{"type":"fixed","currency":"INR","min":2000}}}\')',
        )
          .split("\n")
          .pop()!;
        sql(
          `select t.mfa('c'); select public.aura_market_publish(t.ws('c'), '${camp}')`,
        );
      });
      it("AC02: simultaneous submissions by one Creator to one campaign leave exactly one active application", async () => {
        const res = await Promise.all(
          [1, 2, 3].map((n) =>
            session(
              `s${n}`,
              `select t.me('g');\nbegin;\nselect public.aura_apply_submit(t.ws('g'), (public.aura_apply_save_draft(t.ws('g'), gen_random_uuid(), '${camp}', t.app_content(t.g('acc_g')))->>'id')::uuid, true);\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.filter((r) => r.code === 0).length,
          res.map((r) => r.err).join("|"),
        ).toBeGreaterThanOrEqual(1);
        expect(
          sql(
            `select count(*) from aura_apply.application where campaign_id='${camp}' and creator_workspace_id=t.ws('g') and status not in ('draft','withdrawn','rejected','expired','cancelled')`,
          ),
        ).toBe("1");
      }, 60_000);
      it("AC07: two simultaneous selections for one remaining position select exactly one Creator", async () => {
        sql(
          `select t.me('h'); select public.aura_apply_submit(t.ws('h'), (public.aura_apply_save_draft(t.ws('h'), gen_random_uuid(), '${camp}', t.app_content(t.g('acc_h')))->>'id')::uuid, true)`,
        );
        const ids = sql(
          `select string_agg(id::text, ',') from aura_apply.application where campaign_id='${camp}' and status='submitted'`,
        ).split(",");
        expect(ids).toHaveLength(2);
        const res = await Promise.all(
          ids.map((id, n) =>
            session(
              `sel${n}`,
              `select t.mfa('c');\nbegin;\nselect public.aura_apply_decide(t.ws('c'), '${id}', 'select');\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(res.find((r) => r.code !== 0)!.err).toMatch(
          /positions are filled/,
        );
        expect(
          sql(
            `select count(*) from aura_apply.application where campaign_id='${camp}' and status='selected'`,
          ),
        ).toBe("1");
      }, 60_000);
      it("AC05: simultaneous confirmations of the current proposal by both sides make it ready exactly once", async () => {
        const collab = sql(
          `select collaboration_id from aura_apply.application where campaign_id='${camp}' and status='selected'`,
        );
        const who = sql(
          `select (select k from t.ids where w=creator_workspace_id) from aura_apply.application where campaign_id='${camp}' and status='selected'`,
        );
        sql(
          `select t.me('${who}'); select public.aura_apply_propose(t.ws('${who}'), '${collab}', '{"money":{"currency":"INR","amount":2000},"deliverables":[{"type":"video","quantity":1}],"revisions":1}', null)`,
        );
        const res = await Promise.all([
          session(
            "cc",
            `select t.mfa('c');\nbegin;\nselect public.aura_apply_confirm(t.ws('c'), '${collab}', 1);\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
          session(
            "cr",
            `select t.me('${who}');\nbegin;\nselect public.aura_apply_confirm(t.ws('${who}'), '${collab}', 1);\nselect pg_sleep(0.4);\ncommit;\n`,
          ),
        ]);
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            `select status from aura_apply.collaboration where id='${collab}'`,
          ),
        ).toBe("ready_for_agreement");
        expect(
          sql(
            `select count(*) from aura_apply.notification where workspace_id=t.ws('c') and title like 'Both sides confirmed version 1%' and link like '%${collab}'`,
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
