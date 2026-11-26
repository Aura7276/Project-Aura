import { EligibilityView } from "@/features/marketplace/views";
export const metadata = { title: "Eligibility" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <EligibilityView id={id} sp={await searchParams} />;
}
