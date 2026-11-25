// LOCAL TEST STACK. NOT SUPABASE, NOT REAL AUTHENTICATION.
// A small stand-in for the parts of Supabase Auth (GoTrue) and the REST RPC endpoint (PostgREST) that Creator onboarding and
// Creator Studio use, backed by a real PostgreSQL database that has the real M02, M03 and M04 migrations applied.
// It exists so the REAL Next.js pages, layouts and server actions can be driven end to end without a Supabase project.
// It does not implement sign-up, passwords, e-mail, OAuth, MFA, Storage or Realtime, and it trusts only tokens it minted itself.
import { createServer } from "node:http";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";

const PORT = Number(process.env.AURA_STACK_PORT ?? 54331);
const DB = process.env.AURA_STACK_DB ?? "aura_stack";
const SECRET =
  process.env.AURA_STACK_JWT_SECRET ?? "stack-test-secret-not-for-production";
const admin = (args) =>
  execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
  });

export function setupDatabase() {
  admin([
    "-d",
    "postgres",
    "-c",
    `drop database if exists ${DB}`,
    "-c",
    `create database ${DB}`,
  ]);
  for (const f of [
    "tests/db/fixtures/auth_stub.sql",
    "supabase/migrations/20261125000100_m02_identity.sql",
    "supabase/migrations/20261126000100_m03_creator_onboarding.sql",
    "supabase/migrations/20261127000100_m04_creator_dashboard.sql",
  ])
    admin(["-d", DB, "-f", f]);
}
const b64 = (o) =>
  Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString(
    "base64url",
  );
const sign = (payload) => {
  const h = b64({ alg: "HS256", typ: "JWT" }),
    p = b64(payload);
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
function verify(token) {
  const [h, p, s] = String(token ?? "").split(".");
  if (
    !s ||
    createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") !== s
  )
    return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  return claims.exp * 1000 > Date.now() ? claims : null;
}
function psql(script) {
  return new Promise((resolve) => {
    const c = spawn(
      "psql",
      [
        "-X",
        "-q",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
        "-d",
        DB,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ code, out: out.trim(), err }));
    c.stdin.end(script);
  });
}
const q = (s) => {
  const t = "q" + randomBytes(4).toString("hex");
  return `$${t}$${s}$${t}$`;
};
const claimsSql = (claims) =>
  `set role authenticated;\nselect set_config('request.jwt.claims', ${q(JSON.stringify(claims))}, false) \\g /dev/null\n`;
const meta = new Map();
async function fnMeta(name) {
  if (meta.has(name)) return meta.get(name);
  const r = await psql(
    `select json_build_object('set',p.proretset,'ret',p.prorettype::regtype::text,'names',p.proargnames,'types',(select json_agg(t::regtype::text order by o) from unnest(string_to_array(p.proargtypes::text,' ')::oid[]) with ordinality u(t,o))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${q(name)} and p.proname like 'aura\\_%'`,
  );
  const m = r.out ? JSON.parse(r.out) : null;
  meta.set(name, m);
  return m;
}
function literal(value, type) {
  if (value === null || value === undefined) return "NULL";
  if (type.endsWith("[]")) {
    const el = type.slice(0, -2);
    return `ARRAY[${value.map((v) => `${q(String(v))}::${el}`).join(",")}]::${type}`;
  }
  if (type === "jsonb" || type === "json")
    return `${q(JSON.stringify(value))}::${type}`;
  return `${q(String(value))}::${type}`;
}
async function rpc(name, args, claims) {
  const m = await fnMeta(name);
  if (!m)
    return {
      status: 404,
      body: {
        code: "PGRST202",
        message: `Function ${name} not found`,
        details: null,
        hint: null,
      },
    };
  const names = m.names ?? [],
    types = m.types ?? [];
  const call = Object.keys(args ?? {}).map((k) => {
    const i = names.indexOf(k);
    return i < 0 ? null : `${k} => ${literal(args[k], types[i])}`;
  });
  if (call.includes(null))
    return {
      status: 404,
      body: {
        code: "PGRST202",
        message: "Unknown argument",
        details: null,
        hint: null,
      },
    };
  const fn = `public.${name}(${call.join(", ")})`;
  const expr =
    m.ret === "void"
      ? `select ${fn} \\g /dev/null\nselect 'null'`
      : m.set
        ? `select coalesce(json_agg(to_jsonb(r)),'[]'::json) from ${fn} r`
        : `select coalesce(to_jsonb(${fn})::text,'null')`;
  const r = await psql(
    `${claims ? claimsSql(claims) : "set role anon;\n"}${expr};\n`,
  );
  if (r.code === 0)
    return { status: 200, body: r.out.split("\n").pop() || "null", raw: true };
  const e = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(r.err);
  const code = e?.[1] ?? "XX000";
  return {
    status: code === "42501" ? 403 : code === "40001" ? 409 : 400,
    body: { code, message: e?.[2] ?? "error", details: null, hint: null },
  };
}
async function seedUser({
  email,
  name = "Test Creator",
  country = "IN",
  kind = "creator",
}) {
  const uid = randomUUID(),
    sid = randomUUID();
  const claims = {
    sub: uid,
    session_id: sid,
    role: "authenticated",
    aal: "aal1",
  };
  let sql = `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(${q(uid)}::uuid,${q(email)},now(),${q(JSON.stringify({ name, country }))}::jsonb);\ninsert into auth.sessions(id,user_id) values(${q(sid)}::uuid,${q(uid)}::uuid);\n`;
  sql += `${claimsSql(claims)}select public.aura_complete_identity(${q(name)},${q(country)},true,'') \\g /dev/null\n`;
  if (kind === "creator")
    sql += `select public.aura_create_workspace(${q(randomUUID())}::uuid,'creator',${q(name)},null);\n`;
  const r = await psql(sql);
  let wid = null;
  if (kind === "creator") wid = r.out.split("\n").pop();
  else {
    const w = await psql(
      `insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) values(${q(uid)}::uuid,gen_random_uuid(),'brand','Brand Co','company') returning id;\n`,
    );
    wid = w.out.split("\n")[0];
    await psql(
      `insert into aura_identity.membership values(${q(wid)}::uuid,${q(uid)}::uuid,'owner',true);\n`,
    );
  }
  if (r.code !== 0) throw new Error("seed failed: " + r.err);
  return session(uid, sid, email, { name, country }, wid);
}
function mint(uid, sid, email, user_metadata) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = sign({
    sub: uid,
    session_id: sid,
    role: "authenticated",
    aal: "aal1",
    amr: [],
    aud: "authenticated",
    email,
    exp,
    iat: exp - 3600,
  });
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: new Date().toISOString(),
    user_metadata,
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  return {
    access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: `r.${uid}.${sid}`,
    user,
  };
}
function session(uid, sid, email, user_metadata, workspace_id) {
  return {
    user_id: uid,
    session_id: sid,
    workspace_id,
    cookie_name: "sb-127-auth-token",
    cookie_value: "base64-" + b64(mint(uid, sid, email, user_metadata)),
  };
}
const readBody = (req) =>
  new Promise((r) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        r(d ? JSON.parse(d) : {});
      } catch {
        r({});
      }
    });
  });
const send = (res, status, body, raw) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(raw ? body : JSON.stringify(body));
};
export function start() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    try {
      if (url.pathname === "/health")
        return send(res, 200, {
          ok: true,
          stack: "local-test-stack-not-supabase",
        });
      if (url.pathname === "/__test/user" && req.method === "POST")
        return send(res, 200, await seedUser(await readBody(req)));
      if (url.pathname === "/__test/login") {
        // One-click sign-in for manual testing: seeds the user on first use, then sets the session cookie (cookies are shared across ports
        // on the same host) and redirects into the app. Only mints sessions for this local test stack.
        const email = String(
          url.searchParams.get("email") ?? "demo@example.test",
        ).slice(0, 120);
        const to = /^\/(?!\/)[A-Za-z0-9/_?=&.-]{0,120}$/.test(
          url.searchParams.get("to") ?? "",
        )
          ? url.searchParams.get("to")
          : "/onboarding/creator";
        const ex = await psql(
          `select id::text || '|' || coalesce(raw_user_meta_data::text,'{}') from auth.users where email=${q(email)};`,
        );
        let seed;
        if (ex.out) {
          const [uid, md] = ex.out.split("|");
          const sid = randomUUID();
          await psql(
            `insert into auth.sessions(id,user_id) values(${q(sid)}::uuid,${q(uid)}::uuid);`,
          );
          seed = session(uid, sid, email, JSON.parse(md || "{}"), null);
        } else
          seed = await seedUser({
            email,
            name:
              email
                .split("@")[0]
                .replace(/[^A-Za-z0-9 ]/g, " ")
                .trim() || "Demo Creator",
          });
        res.writeHead(302, {
          "set-cookie": `${seed.cookie_name}=${seed.cookie_value}; Path=/; HttpOnly; SameSite=Lax`,
          location: `${process.env.AURA_APP_URL ?? "http://127.0.0.1:3103"}${to}`,
        });
        return res.end();
      }
      if (url.pathname === "/auth/v1/user") {
        const c = verify(token);
        if (!c)
          return send(res, 401, {
            code: 401,
            error_code: "bad_jwt",
            msg: "invalid JWT",
          });
        const r = await psql(
          `select coalesce((select to_jsonb(u) from (select id, email, email_confirmed_at, raw_user_meta_data as user_metadata from auth.users where id=${q(c.sub)}::uuid) u),'null');`,
        );
        const u = JSON.parse(r.out || "null");
        if (!u)
          return send(res, 401, {
            code: 401,
            error_code: "user_not_found",
            msg: "user not found",
          });
        return send(res, 200, {
          ...u,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
        });
      }
      if (url.pathname === "/auth/v1/token") {
        const [, uid, sid] = String(
          (await readBody(req)).refresh_token ?? "",
        ).split(".");
        if (!uid || !sid) return send(res, 400, { error: "invalid_grant" });
        const r = await psql(
          `select email, raw_user_meta_data from auth.users where id=${q(uid)}::uuid;`,
        );
        const [email, md] = r.out.split("|");
        return send(res, 200, mint(uid, sid, email, JSON.parse(md || "{}")));
      }
      if (url.pathname === "/auth/v1/logout") return send(res, 204, "", true);
      const m = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
      if (m && req.method === "POST") {
        const claims = token ? verify(token) : null;
        const r = await rpc(m[1], await readBody(req), claims);
        return send(res, r.status, r.body, r.raw);
      }
      return send(res, 404, { message: "not found" });
    } catch (e) {
      return send(res, 500, { message: String(e?.message ?? e).slice(0, 200) });
    }
  });
  return new Promise((resolve) =>
    server.listen(PORT, "127.0.0.1", () => resolve(server)),
  );
}
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
  await start();
  console.log(
    `local test stack (NOT Supabase) listening on http://127.0.0.1:${PORT}`,
  );
}
