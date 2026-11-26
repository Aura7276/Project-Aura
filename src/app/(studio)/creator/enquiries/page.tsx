import { EnquiriesView } from "@/features/applications/creator";
export const metadata = { title: "Enquiries" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EnquiriesView sp={await searchParams} />;
}
