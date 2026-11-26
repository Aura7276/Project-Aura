import { ExperienceView } from "@/features/creator-profile/studio";
export const metadata = { title: "Experience" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExperienceView sp={await searchParams} />;
}
