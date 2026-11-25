import { eligible } from "@/server/auth/session";
import { resume } from "@/features/auth/actions";
export default async function Page() {
  await eligible();
  return (
    <>
      <h1>Continue to your workspace</h1>
      <form action={resume}>
        <button>Continue</button>
      </form>
    </>
  );
}
