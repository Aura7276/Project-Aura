import { ServicesView } from "@/features/creator-profile/studio";
export const metadata = { title: "Services" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ServicesView sp={await searchParams} />;
}
