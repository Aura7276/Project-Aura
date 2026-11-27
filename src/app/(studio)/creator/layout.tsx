import { StudioShell } from "@/features/creator-studio/shell";
import {
  captureIdea,
  recordObservation,
  setWalkthrough,
} from "@/features/creator-studio/actions";
import { goalOptions } from "@/features/creator-studio/views";
import { studioContext } from "@/server/studio/service";
import { ActingBanner } from "@/features/agency/banner";
export const metadata = {
  title: { default: "Creator Studio · AURA", template: "%s · Creator Studio" },
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication, Creator workspace ownership and completed M03 activation are all enforced here and in the database.
  const ctx = await studioContext();
  return (
    <>
      <ActingBanner kind="creator" />
      <StudioShell
        workspaceName={ctx.name}
        displayName={ctx.state.profile?.display_name ?? ctx.name}
        goals={goalOptions(ctx.state)}
        today={ctx.prefs.today}
        walkthroughStatus={ctx.prefs.walkthrough_status}
        live
        captureIdea={captureIdea}
        recordObservation={recordObservation}
        saveWalkthrough={setWalkthrough}
      >
        {children}
      </StudioShell>
    </>
  );
}
