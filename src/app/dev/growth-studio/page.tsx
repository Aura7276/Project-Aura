import { notFound } from "next/navigation";
import { GrowthStudio } from "@/features/growth-assistant/studio";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main>
      <GrowthStudio
        preview
        initial={{ drafts: [], memory: null }}
        provider={false}
      />
    </main>
  );
}
