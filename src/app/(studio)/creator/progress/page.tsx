import { recordObservation } from "@/features/creator-studio/actions";
import { ProgressView } from "@/features/creator-studio/views";
import { studioContext, studioData } from "@/server/studio/service";
export const metadata = { title: "Progress" };
export default async function Page() {
  return (
    <ProgressView
      d={await studioData(await studioContext())}
      recordObservation={recordObservation}
    />
  );
}
