import { EnquiryView } from "@/features/applications/creator";
export const metadata = { title: "Enquiry" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EnquiryView id={(await params).id} sp={await searchParams} />;
}
