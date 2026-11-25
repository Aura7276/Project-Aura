import { RecommendationsView } from "@/features/creator-studio/views";
import { studioContext } from "@/server/studio/service";
export const metadata = { title: "Recommendations" };
export default async function Page() {
  return <RecommendationsView state={(await studioContext()).state} />;
}
