import { notFound } from "next/navigation";
import { BrandDashboard } from "@/features/brand-dashboard/dashboard";
import { previewHome } from "@/features/brand-dashboard/fixtures";
export const metadata = { title: "Brand dashboard preview" };
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main>
      <BrandDashboard initial={previewHome} preview />
    </main>
  );
}
