import { CalendarView } from "@/features/brand-content/views";
export const metadata = { title: "Content calendar" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CalendarView sp={await searchParams} />;
}
