import { captureIdea } from "@/features/creator-studio/actions";
import { CreateView } from "@/features/creator-studio/views";
import { studioContext, studioData } from "@/server/studio/service";
export const metadata = { title: "Create" };
export default async function Page() {
  return (
    <CreateView
      d={await studioData(await studioContext())}
      captureIdea={captureIdea}
    />
  );
}
