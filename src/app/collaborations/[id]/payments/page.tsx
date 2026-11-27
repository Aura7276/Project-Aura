import { sharedPayments } from "@/features/earnings/shared-actions";
import { CollaborationPayments } from "@/features/earnings/shared-payments";
export const metadata = { title: "Collaboration payment records" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await sharedPayments(id);
  if (!result.data)
    return (
      <main style={{ padding: 40 }}>
        <h1>Payment records unavailable</h1>
        <p>{result.error}</p>
        <a href="/collaborations">Return to collaborations</a>
      </main>
    );
  return (
    <main>
      <CollaborationPayments id={id} initial={result.data} />
    </main>
  );
}
