import { notFound } from "next/navigation";
import { EarningsStudio } from "@/features/earnings/studio";
import { previewLedger } from "@/features/earnings/fixtures";
export const metadata = { title: "Earnings preview" };
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main>
      <EarningsStudio initial={previewLedger} preview />
    </main>
  );
}
