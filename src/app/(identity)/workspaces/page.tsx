import Link from "next/link";
import { eligible } from "@/server/auth/session";
import * as a from "@/features/auth/actions";
import { Field } from "@/features/auth/fields";
export default async function Page() {
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_workspaces");
  if (error) throw Error("Unable to load workspaces");
  return (
    <>
      <h1>Your workspaces</h1>
      {(data as { id: string; name: string; role: string }[]).map((w) => (
        <form key={w.id} action={a.chooseWorkspace}>
          <input type="hidden" name="workspace" value={w.id} />
          <button>
            {w.name} · {w.role}
          </button>
        </form>
      ))}
      <h2>Create a workspace</h2>
      <form action={a.createWorkspace}>
        <input type="hidden" name="request" value={crypto.randomUUID()} />
        <label>
          Workspace type
          <select name="kind">
            <option value="creator">Personal Creator</option>
            <option value="brand">Brand</option>
            <option value="agency">Agency</option>
          </select>
        </label>
        <Field name="name" label="Workspace name" />
        <label>
          Business type (Brand only)
          <select name="business">
            {["company", "startup", "individual", "small_business"].map((k) => (
              <option key={k} value={k}>
                {k.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <p>
          Brand and Agency owners need an authenticator before creating a
          workspace.
        </p>
        <button>Create workspace</button>
      </form>
      <h2>Join an existing workspace</h2>
      <form action={a.acceptInvitation}>
        <Field name="token" label="Invitation token" />
        <button>Accept invitation</button>
      </form>
      <Link href="/security">Account security</Link>
    </>
  );
}
