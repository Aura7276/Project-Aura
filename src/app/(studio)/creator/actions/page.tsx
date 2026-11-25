import { ActionsView } from "@/features/creator-studio/views";
import { studioContext, studioData } from "@/server/studio/service";
export const metadata = { title: "Daily actions" };
export default async function Page() {
  return <ActionsView d={await studioData(await studioContext())} />;
}
