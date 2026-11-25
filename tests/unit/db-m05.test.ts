// Real-database tests for M05. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02, M03, M04 and M05 migrations on a minimal `auth` stub and a minimal `storage` stub (NOT Supabase):
// row-level policies and SQL functions are exercised for real; Supabase Auth, PostgREST and Storage APIs are not. Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m05_${stamp}`;
const extra = [`aura_m05r3_${stamp}`, `aura_m05r4_${stamp}`];
const migrations = [
  "tests/db/fixtures/auth_stub.sql",
  "supabase/migrations/20261125000100_m02_identity.sql",
  "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
  "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  "tests/db/fixtures/storage_stub.sql",
  "supabase/migrations/20261128000100_m05_social_accounts.sql",
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
let taxonomy: string[] = [];

describe.skipIf(!enabled)(
  "M05 database, RLS and storage policies (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      const out = run(main, ["-f", "tests/db/m05_rls.sql"]);
      taxonomy = out
        .split("---RESULTS---")[0]
        .split("\n")
        .filter((l) => /^(platform|metric),/.test(l));
      scenario = results(out);
    }, 180_000);
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

    it("runs every M05 SQL scenario group to completion", () => {
      expect(scenario.length).toBeGreaterThanOrEqual(25);
      for (const must of [
        "anonymous and direct",
        "accounts: create",
        "limit of 10",
        "primary and preferred",
        "M03 onboarding social step",
        "observations:",
        "content observations",
        "challenge:",
        "review is restricted",
        "self-approval",
        "approval:",
        "duplicate ownership",
        "dispute resolved",
        "evidence storage",
        "sharing:",
        "disconnect and refresh",
        "reminders:",
        "extraction contract",
        "cross-tenant",
        "same infrastructure serves a Brand",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the existing M03 and M04 database suites still pass on the M05 schema (regression)", () => {
      build(extra[0]);
      build(extra[1]);
      expect(
        results(run(extra[0], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
      expect(
        results(run(extra[1], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
    }, 240_000);
    it("RLS is on for every aura_social table; nothing is granted to anon, authenticated or PUBLIC; there are no policies on private tables", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_social'"),
        ),
      ).toBeGreaterThanOrEqual(17);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_social' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_social' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_social'"),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_creator' and table_name='social_account' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("only intended public functions are executable by authenticated, none by anon, and private worker/review helpers are not exposed", () => {
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_social\\_%' and grantee='anon'",
        ),
      ).toBe("0");
      expect(
        Number(
          sql(
            "select count(*) from information_schema.role_routine_grants where routine_schema='public' and routine_name like 'aura\\_social\\_%' and grantee='authenticated'",
          ),
        ),
      ).toBe(
        Number(
          sql(
            "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\\_social\\_%'",
          ),
        ),
      );
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_social' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('aura_social_job_start','aura_social_job_complete','aura_social_create_suggestion')",
        ),
      ).toBe("0");
    });
    it("every SECURITY DEFINER function pins an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_social') and p.proname like 'aura%social%' and p.prosecdef and not (coalesce(p.proconfig,'{}') @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    it("the evidence bucket is private and exactly three storage policies exist", () => {
      expect(
        sql(
          "select public::text || ':' || file_size_limit from storage.buckets where id='social-evidence'",
        ),
      ).toBe("false:5242880");
      expect(
        sql(
          "select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname='storage' and tablename='objects'",
        ),
      ).toBe(
        "social_evidence_delete,social_evidence_insert,social_evidence_select",
      );
    });
    it("platform and metric catalogue codes in the database match the TypeScript catalogue", async () => {
      const { platformCodes } =
        await import("@/features/creator-social/catalogue");
      const { metricCodes } = await import("@/features/creator-social/metrics");
      const db = (k: string) =>
        taxonomy
          .filter((l) => l.startsWith(k + ","))
          .map((l) => l.split(",")[1])
          .sort();
      expect(db("platform")).toEqual([...platformCodes].sort());
      expect(db("metric")).toEqual([...metricCodes].sort());
    });
    it("no migration step deletes observations or rewrites applied M02 to M04 history", async () => {
      const { readFileSync } = await import("node:fs");
      const m05 = readFileSync(
        "supabase/migrations/20261128000100_m05_social_accounts.sql",
        "utf8",
      );
      expect(m05).not.toMatch(
        /delete from aura_social\.(account|content)_observation|drop table|drop function aura_(identity|studio)/i,
      );
    });
    it("an interrupted or invalid request leaves no partial data", () => {
      const before = sql("select count(*) from aura_creator.social_account");
      const r = run(main, ["-At", "-c", "select t.me('b')", "-c", "select 1"]);
      expect(r).toBeDefined();
      const failing = spawn("psql", ["-X", "-q", "-At", "-d", main], {
        stdio: ["pipe", "ignore", "ignore"],
      });
      failing.stdin.end(
        `select t.me('e');\nselect public.aura_social_add_account(t.ws('e'), gen_random_uuid(), '{"platform":"instagram","handle":"partial.write","followers":-5}');\n`,
      );
      return new Promise<void>((resolve) =>
        failing.on("close", () => {
          expect(
            sql(
              "select count(*) from aura_creator.social_account where handle='partial.write'",
            ),
          ).toBe("0"); // the account insert rolled back with the failed observation
          expect(sql("select count(*) from aura_creator.social_account")).toBe(
            before,
          );
          resolve();
        }),
      );
    });

    describe("concurrency (separate database connections)", () => {
      // Fixture: fresh Creator users with empty workspaces, so these tests do not depend on the scenario script's leftovers.
      const mk = (k: string) =>
        sql(
          `do $$ declare a uuid[]; wid uuid; begin a := t.mkuser('${k}@example.test', false); insert into t.ids(k,u,s) values ('${k}',a[1],a[2]); perform t.me('${k}'); perform public.aura_complete_identity('Test ${k}','IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator ${k}',null); reset role; update t.ids set w=wid where k='${k}'; end $$`,
        );
      const count = (k: string) =>
        sql(
          `select count(*) from aura_creator.social_account where workspace_id=(select w from t.ids where k='${k}') and lifecycle in ('active','disconnected')`,
        );
      beforeAll(() => {
        mk("g");
        mk("h");
        mk("i");
        mk("g2");
      });

      it("account limit: six simultaneous creations into a workspace holding nine accounts produce exactly one more", async () => {
        const fill = Array.from(
          { length: 9 },
          (_, i) =>
            `select public.aura_social_add_account(t.ws('g'), gen_random_uuid(), '{"platform":"other","handle":"fill${i}"}');`,
        ).join("\n");
        const f = await session("fill", `select t.me('g');\n${fill}\n`);
        expect(f.code, f.err).toBe(0);
        expect(count("g")).toBe("9");
        const one = (n: number) =>
          session(
            `add${n}`,
            `select t.me('g');\nbegin;\nselect public.aura_social_add_account(t.ws('g'), gen_random_uuid(), '{"platform":"other","handle":"race${n}"}');\nselect pg_sleep(0.6);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3, 4, 5, 6].map(one));
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /Social account limit reached/.test(r.err)),
        ).toBe(true);
        expect(count("g")).toBe("10"); // never 11, however the sessions interleave
      }, 60_000);
      it("a retried or duplicated submission with one request id creates exactly one account", async () => {
        const rid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
        const dup = (n: number) =>
          session(
            `dup${n}`,
            `select t.me('h');\nbegin;\nselect (public.aura_social_add_account(t.ws('h'), '${rid}', '{"platform":"threads","handle":"dup.handle"}'))->>'id';\nselect pg_sleep(0.4);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3, 4].map(dup));
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          new Set(res.map((r) => r.out.trim().split("\n").pop())).size,
        ).toBe(1);
        expect(
          sql(
            "select count(*) from aura_creator.social_account where handle='dup.handle'",
          ),
        ).toBe("1");
      }, 60_000);
      it("primary-account switching: four simultaneous switches leave exactly one primary and no error", async () => {
        const seed = Array.from(
          { length: 3 },
          (_, i) =>
            `select public.aura_social_add_account(t.ws('h'), gen_random_uuid(), '{"platform":"instagram","handle":"prim${i}"}');`,
        ).join("\n");
        expect(
          (await session("seed", `select t.me('h');\n${seed}\n`)).code,
        ).toBe(0);
        const ids = sql(
          "select string_agg(id::text, ',') from aura_creator.social_account where workspace_id=(select w from t.ids where k='h') and lifecycle='active'",
        ).split(",");
        expect(ids).toHaveLength(4);
        const res = await Promise.all(
          ids.map((id, n) =>
            session(
              `p${n}`,
              `select t.me('h');\nbegin;\nselect public.aura_social_set_primary(t.ws('h'), '${id}');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_creator.social_account where workspace_id=(select w from t.ids where k='h') and is_primary",
          ),
        ).toBe("1");
      }, 60_000);
      it("preferred-account switching on one platform: simultaneous changes leave exactly one preferred", async () => {
        expect(
          (
            await session(
              "seed",
              `select t.me('h');\nselect public.aura_social_add_account(t.ws('h'), gen_random_uuid(), '{"platform":"threads","handle":"pref.two"}');\n`,
            )
          ).code,
        ).toBe(0);
        const ids = sql(
          "select string_agg(id::text, ',') from aura_creator.social_account where workspace_id=(select w from t.ids where k='h') and platform='threads' and lifecycle='active'",
        ).split(",");
        expect(ids.length).toBeGreaterThanOrEqual(2);
        const res = await Promise.all(
          ids.map((id, n) =>
            session(
              `f${n}`,
              `select t.me('h');\nbegin;\nselect public.aura_social_set_preferred(t.ws('h'), '${id}', true);\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_creator.social_account where workspace_id=(select w from t.ids where k='h') and platform='threads' and preferred_for_platform",
          ),
        ).toBe("1");
      }, 60_000);
      it("duplicate simultaneous observation submits with one request id create exactly one row", async () => {
        const acc = sql(
          "select id from aura_creator.social_account where workspace_id=(select w from t.ids where k='h') and lifecycle='active' order by created_at limit 1",
        );
        const rid = "11111111-2222-4333-8444-666666666666";
        const s = (n: number) =>
          session(
            `o${n}`,
            `select t.me('h');\nbegin;\nselect public.aura_social_record_observation(t.ws('h'), '${rid}', '${acc}', 'followers', 77, current_date);\nselect pg_sleep(0.4);\ncommit;\n`,
          );
        const res = await Promise.all([1, 2, 3].map(s));
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            `select count(*) from aura_social.account_observation where request_id='${rid}'`,
          ),
        ).toBe("1");
      }, 60_000);
      it("simultaneous approvals of two claims for one identity: exactly one wins and the other is refused (AC02)", async () => {
        // Fixture: a second reviewer (platform admin + granted reviewer + MFA) and two workspaces claiming the same handle.
        sql(
          `do $$ declare a uuid[]; begin a := t.mkuser('r4@example.test', true); insert into t.ids(k,u,s) values ('r4',a[1],a[2]); insert into aura_identity.platform_admin(user_id) values (a[1]); insert into aura_social.reviewer(user_id) values (a[1]); end $$`,
        );
        expect(
          (
            await session(
              "profile",
              `select t.mfa('r4');\nselect public.aura_complete_identity('Test r4','IN',true,'');\n`,
            )
          ).code,
        ).toBe(0);
        const claim = async (k: string) => {
          const add = await session(
            `add-${k}`,
            `select t.me('${k}');\nselect public.aura_social_add_account(t.ws('${k}'), gen_random_uuid(), '{"platform":"instagram","handle":"race.identity"}')->>'id';\n`,
          );
          expect(add.code, add.err).toBe(0);
          const acc = add.out.trim().split("\n").pop()!;
          const r = await session(
            `start-${k}`,
            `select t.me('${k}');\nselect public.aura_social_start_verification(t.ws('${k}'), '${acc}', gen_random_uuid())->>'claim_id';\n`,
          );
          expect(r.code, r.err).toBe(0);
          const id = r.out.trim().split("\n").pop()!;
          const q = await session(
            `review-${k}`,
            `select t.me('${k}');\nselect public.aura_social_request_review(t.ws('${k}'), '${id}');\n`,
          );
          expect(q.code, q.err).toBe(0);
          return id;
        };
        const [cg, ci] = [await claim("g2"), await claim("i")];
        const approve = (reviewer: string, id: string) =>
          session(
            `approve-${reviewer}`,
            `select t.mfa('${reviewer}');\nbegin;\nselect public.aura_social_decide('${id}', 'approved', 'Concurrent approval test');\nselect pg_sleep(1);\ncommit;\n`,
          );
        const res = await Promise.all([approve("r", cg), approve("r4", ci)]);
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(res.filter((r) => r.code !== 0)[0].err).toMatch(
          /already verified/,
        );
        expect(
          sql(
            "select count(*) from aura_social.ownership_claim where identity_key='instagram:h:race.identity' and state='verified'",
          ),
        ).toBe("1");
        expect(
          sql(
            "select count(*) from aura_creator.social_account where platform='instagram' and handle='race.identity' and verification='verified'",
          ),
        ).toBe("1");
        expect(
          sql(
            "select count(*) from aura_social.ownership_claim where identity_key='instagram:h:race.identity' and state='under_review'",
          ),
        ).toBe("1"); // the loser stays under review
      }, 90_000);
    });
  },
);
