import { entryIntent } from "@/features/public-site/intent";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  destinations,
  isDestination,
  implementedDestination,
  destinationPath,
} from "@/config/navigation";
export default async function Readiness({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; value?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { id } = await params;
  if (!isDestination(id)) notFound();
  if (implementedDestination(id)) redirect(destinationPath(id));
  const { kind, value } = await searchParams;
  const intent =
    typeof value === "string" &&
    ((kind === "invite" && id === "register") ||
      (kind === "campaign" && id === "login"))
      ? entryIntent(kind, value)
      : null;
  return (
    <>
      <p className="stage-label">Development preview · Pending destination</p>
      <h1>{destinations[id][0]}</h1>
      <p>
        Available after implementation and approval of {destinations[id][1]}.
      </p>
      {intent && (
        <p>
          <Link href={intent.returnTo}>
            Return to the{" "}
            {intent.kind === "invite" ? "invitation" : "campaign preview"}
          </Link>
        </p>
      )}
      <Link href="/" className="underline">
        Return home
      </Link>
    </>
  );
}
