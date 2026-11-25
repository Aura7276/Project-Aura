import Link from "next/link";
import { eligible } from "@/server/auth/session";
import * as a from "@/features/auth/actions";
import { Field, PasswordFields } from "@/features/auth/fields";
export default async function Page() {
  const { client, user } = await eligible();
  const { data, error } = await client.rpc("aura_security_state");
  if (error) throw Error("Security details unavailable");
  const factors = await client.auth.mfa.listFactors();
  return (
    <>
      <h1>Account security</h1>
      <p>{user.email}</p>
      <Link href="/mfa">Manage authenticator</Link>
      {factors.data?.totp.map((f) => (
        <form key={f.id} action={a.removeFactor}>
          <input type="hidden" name="factor" value={f.id} />
          <button>Remove {f.friendly_name ?? "authenticator"}</button>
        </form>
      ))}
      <h2>Change password</h2>
      <form action={a.changePassword}>
        <Field type="password" name="current" label="Current password" />
        <PasswordFields />
        <button>Update password</button>
      </form>
      {process.env.AURA_SMS_ENABLED === "true" && (
        <form action={a.phone}>
          <Field name="phone" label="International phone number" />
          <Field name="current" type="password" label="Current password" />
          <Field
            name="code"
            label="SMS confirmation code (after requesting)"
            optional
          />
          <button>Update phone verification</button>
        </form>
      )}
      <h2>Mobile verification</h2>
      <p>
        {data.verified_phone
          ? "Verified · " + data.verified_phone
          : "No verified mobile number"}
      </p>
      <h2>Recent security activity</h2>
      {data.activity.length ? (
        <ul>
          {(data.activity as { event: string; at: string }[]).map((e, i) => (
            <li key={i}>
              {e.event.replaceAll("_", " ")} · {e.at}
            </li>
          ))}
        </ul>
      ) : (
        <p>No recent activity recorded.</p>
      )}
      <h2>Sessions</h2>
      <ul>
        {(
          data.sessions as {
            current: boolean;
            created_at: string;
            agent: string;
          }[]
        ).map((s, i) => (
          <li key={i}>
            {s.current ? "This session" : "Other session"} · {s.created_at} ·{" "}
            {s.agent}
          </li>
        ))}
      </ul>
      <form action={a.logout}>
        <button>Sign out here</button>
        <button name="scope" value="global">
          Sign out everywhere
        </button>
      </form>
    </>
  );
}
