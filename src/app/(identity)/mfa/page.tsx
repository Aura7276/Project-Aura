import { actor } from "@/server/auth/session";
import { challenge } from "@/features/auth/actions";
import { Field } from "@/features/auth/fields";
import { Enroll } from "@/features/auth/enroll";
export default async function Page() {
  const { client } = await actor();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw Error("Unable to load authentication methods");
  return (
    <>
      <h1>Verify your identity</h1>
      {data.totp.map((f) => (
        <form key={f.id} action={challenge}>
          <input type="hidden" name="factor" value={f.id} />
          <Field name="code" label="Authenticator code" />
          <button>Verify code</button>
        </form>
      ))}
      <Enroll />
    </>
  );
}
