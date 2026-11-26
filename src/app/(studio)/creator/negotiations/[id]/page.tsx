import { CreatorNegotiationView } from "@/features/applications/creator";
export const metadata = { title: "Negotiation" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CreatorNegotiationView id={(await params).id} sp={await searchParams} />;
}
