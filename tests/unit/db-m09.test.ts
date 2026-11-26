// Real-database tests for M09. They run only when AURA_TEST_DB=1 and PGHOST/PGPORT/PGUSER point at a DISPOSABLE PostgreSQL.
// The schema is built from the real M02 to M06 and M09 migrations on a minimal `auth` stub and `storage` stub (NOT Supabase). Skipped runs are
// reported as skipped, never as passed.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AURA_TEST_DB === "1";
const stamp = `${process.pid}_${Date.now() % 100000}`;
const main = `aura_m09_${stamp}`;
const extra = [
  `aura_m09a_${stamp}`,
  `aura_m09b_${stamp}`,
  `aura_m09c_${stamp}`,
  `aura_m09d_${stamp}`,
];
const migrations = [
  "tests/db/fixtures/auth_stub.sql",
  "supabase/migrations/20261125000100_m02_identity.sql",
  "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
  "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  "tests/db/fixtures/storage_stub.sql",
  "supabase/migrations/20261128000100_m05_social_accounts.sql",
  "supabase/migrations/20261129000100_m06_creator_analytics.sql",
  "supabase/migrations/20261201000100_m09_creator_profile.sql",
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
  "M09 database, RLS and public projections (disposable PostgreSQL, auth and storage stubs)",
  () => {
    beforeAll(() => {
      build(main);
      scenario = results(run(main, ["-f", "tests/db/m09_rls.sql"]));
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
    it("runs every M09 SQL scenario group to completion", () => {
      expect(scenario.length).toBeGreaterThanOrEqual(8);
      for (const must of [
        "anonymous and direct",
        "usernames:",
        "publication:",
        "portfolio and services",
        "testimonials:",
        "media kits:",
        "enquiries blocked",
        "cross-tenant",
      ])
        expect(
          scenario.some((r) => r.includes(must)),
          must,
        ).toBe(true);
    });
    it("the existing M03, M04, M05 and M06 database suites still pass on the M09 schema (regression)", () => {
      extra.forEach(build);
      expect(
        results(run(extra[0], ["-f", "tests/db/m06_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(12);
      expect(
        results(run(extra[1], ["-f", "tests/db/m05_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(25);
      expect(
        results(run(extra[2], ["-f", "tests/db/m04_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(18);
      expect(
        results(run(extra[3], ["-f", "tests/db/m03_rls.sql"])).length,
      ).toBeGreaterThanOrEqual(17);
    }, 480_000);
    it("RLS is on for every aura_profile table; nothing is granted to anon, authenticated or PUBLIC; no policies exist", () => {
      expect(
        Number(
          sql("select count(*) from pg_tables where schemaname='aura_profile'"),
        ),
      ).toBeGreaterThanOrEqual(18);
      expect(
        sql(
          "select count(*) from pg_tables where schemaname='aura_profile' and not rowsecurity",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.role_table_grants where table_schema='aura_profile' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
      expect(
        sql("select count(*) from pg_policies where schemaname='aura_profile'"),
      ).toBe("0");
    });
    it("anon can execute exactly the two public projections and read only the allowlisted directory view", () => {
      expect(
        sql(
          "select string_agg(routine_name, ',' order by routine_name) from information_schema.role_routine_grants where routine_schema='public' and grantee='anon' and (routine_name like 'aura\\_profile\\_%' or routine_name like 'aura\\_public\\_%')",
        ),
      ).toBe("aura_public_kit,aura_public_profile");
      expect(
        sql(
          "select string_agg(privilege_type, ',') from information_schema.role_table_grants where table_schema='public' and table_name='m01_public_creator_previews' and grantee='anon'",
        ),
      ).toBe("SELECT");
      expect(
        sql(
          "select count(*) from information_schema.role_routine_grants where routine_schema='aura_profile' and grantee in ('anon','authenticated','PUBLIC')",
        ),
      ).toBe("0");
    });
    it("every SECURITY DEFINER function pins an empty search_path", () => {
      expect(
        sql(
          "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aura_profile') and (p.proname like 'aura%profile%' or p.proname like 'aura_public%') and p.prosecdef and not (coalesce(p.proconfig,'{}'::text[]) @> array['search_path=\"\"'])",
        ),
      ).toBe("0");
    });
    // Words reserved by later migrations (M10 adds "marketplace"); db-m10 checks the complete list against every Studio route.
    const laterModuleWords = [
      "marketplace",
      "applications",
      "invitations",
      "enquiries",
      "negotiations",
    ];
    it("reserved usernames in the database match the TypeScript list (Studio routes stay unclaimable)", async () => {
      const { reservedUsernames } =
        await import("@/features/creator-profile/rules");
      expect(
        sql(
          "select string_agg(word, ',' order by word) from aura_profile.reserved_username",
        ).split(","),
      ).toEqual(
        [...reservedUsernames]
          .filter((w) => !laterModuleWords.includes(w))
          .sort(),
      );
      const { readdirSync } = await import("node:fs");
      const studio = readdirSync("src/app/(studio)/creator", {
        withFileTypes: true,
      })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((d) => !laterModuleWords.includes(d));
      for (const seg of studio)
        expect(
          reservedUsernames as readonly string[],
          `Studio route /creator/${seg} must be reserved`,
        ).toContain(seg);
    });
    it("tokens are stored only as hashes and no visitor identity column exists", () => {
      expect(
        sql(
          "select count(*) from information_schema.columns where table_schema='aura_profile' and column_name='token'",
        ),
      ).toBe("0");
      expect(
        sql(
          "select count(*) from information_schema.columns where table_schema='aura_profile' and column_name ~ '(ip_|user_agent|visitor|email)'",
        ),
      ).toBe("0");
    });
    it("the migration rewrites no earlier history", () => {
      const m = readFileSync(
        "supabase/migrations/20261201000100_m09_creator_profile.sql",
        "utf8",
      );
      expect(m).not.toMatch(
        /drop table|drop function aura_(identity|studio|social|creator|analytics)|delete from aura_(social|creator|analytics)/i,
      );
    });

    describe("concurrency (separate database connections)", () => {
      const mk = (k: string) =>
        sql(
          `do $$ declare a uuid[]; wid uuid; begin a := t.mkuser('${k}@example.test', false); insert into t.ids(k,u,s) values ('${k}',a[1],a[2]); perform t.me('${k}'); perform public.aura_complete_identity('Test ${k}','IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator ${k}',null); reset role; update t.ids set w=wid where t.ids.k='${k}'; perform t.activate('${k}'); end $$`,
        );
      beforeAll(() => {
        for (const k of ["u1", "u2", "u3", "u4"]) mk(k);
      });
      it("four Creators claiming the same username at the same moment: exactly one gets it", async () => {
        const res = await Promise.all(
          ["u1", "u2", "u3", "u4"].map((k) =>
            session(
              k,
              `select t.me('${k}');\nbegin;\nselect public.aura_profile_save(t.ws('${k}'), '{"username":"race.name"}');\nselect pg_sleep(0.4);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          res
            .filter((r) => r.code !== 0)
            .every((r) => /taken|duplicate key/.test(r.err)),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            "select count(*) from aura_profile.profile where username='race.name'",
          ),
        ).toBe("1");
      }, 60_000);
      it("simultaneous snapshots of one kit get distinct, consecutive version numbers", async () => {
        const kit = sql(
          "select t.me('u1'); select (public.aura_profile_create_kit(t.ws('u1'), gen_random_uuid(), '{\"name\":\"Race kit\"}'))->>'id'",
        )
          .split("\n")
          .pop()!;
        const res = await Promise.all(
          [1, 2, 3, 4].map((n) =>
            session(
              `s${n}`,
              `select t.me('u1');\nbegin;\nselect public.aura_profile_snapshot_kit(t.ws('u1'), '${kit}', 'n${n}');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(
          res.every((r) => r.code === 0),
          res.map((r) => r.err).join("|"),
        ).toBe(true);
        expect(
          sql(
            `select string_agg(version::text, ',' order by version) from aura_profile.kit_version where kit_id='${kit}'`,
          ),
        ).toBe("1,2,3,4");
      }, 60_000);
      it("one testimonial invitation used by two people at once yields one testimonial", async () => {
        const token = sql(
          "select t.me('u2'); select public.aura_profile_create_invite(t.ws('u2'), 'race')->>'token'",
        )
          .split("\n")
          .pop()!;
        const res = await Promise.all(
          ["u3", "u4"].map((k) =>
            session(
              k,
              `select t.me('${k}');\nbegin;\nselect public.aura_profile_submit_testimonial('${token}', 'Writer ${k}', null, 'collaborator', 'We worked together on a real project last month.');\nselect pg_sleep(0.3);\ncommit;\n`,
            ),
          ),
        );
        expect(res.filter((r) => r.code === 0)).toHaveLength(1);
        expect(
          sql(
            "select count(*) from aura_profile.testimonial where workspace_id=(select w from t.ids where k='u2')",
          ),
        ).toBe("1");
      }, 60_000);
    });
  },
);
