import { AvailabilityView } from "@/features/creator-profile/studio";
export const metadata = { title: "Availability" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AvailabilityView sp={await searchParams} />;
}
