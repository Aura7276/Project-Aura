import { OnboardingView } from "@/features/brand/views";
export const metadata = { title: "Brand setup" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OnboardingView sp={await searchParams} />;
}
