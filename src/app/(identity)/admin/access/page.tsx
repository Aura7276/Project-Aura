import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
export default async function Page() {
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_is_admin");
  if (error || data !== true) notFound();
  return (
    <>
      <h1>Platform administration</h1>
      <p>
        Your provisioned administrator identity and authenticator have been
        verified.
      </p>
    </>
  );
}
