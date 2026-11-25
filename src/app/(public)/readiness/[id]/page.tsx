import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { destinations, isDestination } from "@/config/navigation";
export default async function Readiness({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { id } = await params;
  if (id === "creators" || id === "brands") redirect("/" + id);
  if (!isDestination(id)) notFound();
  return (
    <>
      <p className="stage-label">Development preview · Pending destination</p>
      <h1>{destinations[id][0]}</h1>
      <p>
        Available after implementation and approval of {destinations[id][1]}.
      </p>
      <Link href="/" className="underline">
        Return home
      </Link>
    </>
  );
}
