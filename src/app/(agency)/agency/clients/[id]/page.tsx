import { ClientDetail } from "@/features/agency/views";
export const metadata = { title: "Client" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ClientDetail id={(await params).id} sp={await searchParams} />;
}
