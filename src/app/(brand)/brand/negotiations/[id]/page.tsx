import { BrandNegotiationView } from "@/features/applications/brand";
export const metadata = { title: "Negotiation" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <BrandNegotiationView id={(await params).id} sp={await searchParams} />
  );
}
