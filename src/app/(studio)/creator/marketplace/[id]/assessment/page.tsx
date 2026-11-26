import { AssessmentView } from "@/features/marketplace/views";
export const metadata = { title: "Review the terms" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssessmentView id={id} />;
}
