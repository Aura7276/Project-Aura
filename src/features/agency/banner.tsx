import { actingDelegation } from "./acting";
import { stopWorking } from "./actions";
import { scopesText } from "./rules";
import "./agency.css";

/** Shown across the Brand area and Creator Studio while an Agency team member works for a client. */
export async function ActingBanner({ kind }: { kind: "brand" | "creator" }) {
  const d = await actingDelegation(kind);
  if (!d) return null;
  return (
    <div className="ag-acting" role="region" aria-label="Working for a client">
      <div className="shell">
        <span>
          Working for <b>{d.name}</b> as {d.agency} ·{" "}
          <span className="ag-acting-scope">
            {d.can_write ? scopesText(d.scopes) : "Read only"}
          </span>
        </span>
        <form action={stopWorking}>
          <button>Back to Agency Studio</button>
        </form>
      </div>
    </div>
  );
}
