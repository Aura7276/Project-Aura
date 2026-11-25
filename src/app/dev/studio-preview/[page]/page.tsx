import { notFound } from "next/navigation";
import { StudioShell } from "@/features/creator-studio/shell";
import {
  ActionsView,
  Card,
  CreateView,
  DashboardView,
  goalOptions,
  ModuleList,
  ProgressView,
  RecommendationsView,
  CommercialCard,
} from "@/features/creator-studio/views";
import { dataFor, type Situation } from "../fixtures";

export const metadata = {
  title: "Creator Studio preview",
  robots: { index: false, follow: false },
};
const paths: Record<string, string> = {
  dashboard: "/creator/dashboard",
  actions: "/creator/actions",
  progress: "/creator/progress",
  recommendations: "/creator/recommendations",
  create: "/creator/create",
  grow: "/creator/grow",
  studio: "/creator/studio",
};
const situations: Situation[] = ["aspiring", "below100", "qualifying", "ugc"];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ situation?: string }>;
}) {
  const { page } = await params;
  const q = (await searchParams).situation;
  const situation = (situations as string[]).includes(q ?? "")
    ? (q as Situation)
    : "aspiring";
  if (!paths[page]) notFound();
  const d = dataFor(situation);
  return (
    <>
      <p className="st-preview-banner" role="note">
        Development preview of illustrative data ({situation}). Nothing is saved
        and there is no sign-in.
      </p>
      <StudioShell
        workspaceName="Illustrative Creator"
        displayName="Illustrative Creator"
        goals={goalOptions(d.state)}
        today={d.prefs.today}
        walkthroughStatus="not_seen"
        live={false}
        pathname={paths[page]}
      >
        {page === "dashboard" && <DashboardView d={d} />}
        {page === "actions" && <ActionsView d={d} />}
        {page === "progress" && <ProgressView d={d} />}
        {page === "recommendations" && <RecommendationsView state={d.state} />}
        {page === "create" && <CreateView d={d} />}
        {page === "grow" && (
          <>
            <h1>Grow</h1>
            <Card id="g" title="Available now">
              <ModuleList areaId="grow" />
            </Card>
          </>
        )}
        {page === "studio" && (
          <>
            <h1>My Studio</h1>
            <div className="st-grid">
              <Card id="s" title="Profile and account">
                <ModuleList areaId="studio" />
              </Card>
              <CommercialCard summary={d.commercial} />
            </div>
          </>
        )}
      </StudioShell>
    </>
  );
}
