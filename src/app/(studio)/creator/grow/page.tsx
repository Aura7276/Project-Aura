import Link from "next/link";
import { Card, ModuleList } from "@/features/creator-studio/views";
export const metadata = { title: "Grow" };
export default function Page() {
  return (
    <>
      <h1>Grow</h1>
      <p className="st-hint">
        Build a steady routine and track real progress. Connected analytics and
        the assistant arrive with later modules.
      </p>
      <div className="st-grid">
        <Card id="g" title="Available now">
          <ModuleList areaId="grow" />
        </Card>
        <Card id="w" title="Start here">
          <p className="st-hint">
            Not sure where to begin? Open today’s actions.
          </p>
          <Link className="st-btn primary" href="/creator/actions">
            Today’s actions
          </Link>
        </Card>
      </div>
    </>
  );
}
