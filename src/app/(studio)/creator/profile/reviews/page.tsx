import { ReviewsView } from "@/features/creator-profile/studio";
export const metadata = { title: "Testimonials" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReviewsView sp={await searchParams} />;
}
