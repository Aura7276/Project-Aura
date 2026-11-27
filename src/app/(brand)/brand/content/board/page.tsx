import { BoardView } from "@/features/brand-content/views";
export const metadata = { title: "Production board" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BoardView sp={await searchParams} />;
}
