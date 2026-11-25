import {
  CommercialCard,
  Card,
  ModuleList,
} from "@/features/creator-studio/views";
import { unavailableCommercial } from "@/features/creator-studio/commercial";
import { studioContext } from "@/server/studio/service";
export const metadata = { title: "My Studio" };
export default async function Page() {
  const ctx = await studioContext();
  return (
    <>
      <h1>My Studio</h1>
      <p className="st-hint">
        Your profile, preferences and account. Your profile is private and is
        not published.
      </p>
      <div className="st-grid">
        <Card id="s" title="Profile and account">
          <ModuleList areaId="studio" />
        </Card>
        <CommercialCard
          summary={await unavailableCommercial.summary(ctx.workspaceId)}
        />
      </div>
    </>
  );
}
