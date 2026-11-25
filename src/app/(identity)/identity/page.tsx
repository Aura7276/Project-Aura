import { actor } from "@/server/auth/session";
import { completeIdentity } from "@/features/auth/actions";
import { IdentityFields } from "@/features/auth/fields";
export default async function Page() {
  const { user } = await actor();
  return (
    <>
      <h1>Confirm your details</h1>
      <form action={completeIdentity}>
        <IdentityFields
          name={String(user.user_metadata.name ?? "")}
          mobile={String(user.user_metadata.mobile ?? "")}
          country={String(user.user_metadata.country ?? "")}
        />
        <button>Continue</button>
      </form>
    </>
  );
}
