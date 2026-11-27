import { ClientsView } from "@/features/agency/views";
export const metadata = { title: "Clients" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ClientsView sp={await searchParams} />;
}
