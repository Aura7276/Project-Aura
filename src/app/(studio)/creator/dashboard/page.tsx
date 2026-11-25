import { DashboardView } from "@/features/creator-studio/views";
import { studioContext, studioData } from "@/server/studio/service";
export const metadata = { title: "Home" };
export default async function Page() {
  return <DashboardView d={await studioData(await studioContext())} />;
}
