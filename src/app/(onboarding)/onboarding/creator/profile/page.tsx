import Link from "next/link";
import { redirect } from "next/navigation";
import { loadState } from "@/server/creator/service";
import { buildChecklist } from "@/features/creator-onboarding/checklist";
import {
  reminderDue,
  reminderAfterDays,
} from "@/features/creator-onboarding/integration";

const sections = [
  ["identity", "About you"],
  ["social", "Social accounts"],
  ["niche", "Niche"],
  ["goals", "Goals"],
  ["challenges", "Challenges"],
  ["preferences", "Collaboration preferences and exclusions"],
  ["rates", "Rates"],
  ["resources", "Time and tools"],
] as const;
export default async function Page() {
  const { state } = await loadState();
  if (!state.profile?.activated_at) redirect("/onboarding/creator");
  const items = buildChecklist(state);
  const stale = reminderDue(state.profile.updated_at);
  const todo = items.filter(
    (i) => i.group === "optional" && i.state === "todo",
  );
  return (
    <>
      <h1>Your profile</h1>
      <p className="ob-lede">
        Everything here is private and editable. Last updated{" "}
        {new Date(state.profile.updated_at).toLocaleDateString("en-IN", {
          dateStyle: "medium",
        })}
        .
      </p>
      {(stale || todo.length > 0) && (
        <div className="ob-note" role="status">
          {stale && (
            <p>
              It has been over {reminderAfterDays} days. Please check that your
              details are still right, especially follower counts.
            </p>
          )}
          {todo.length > 0 && (
            <p>
              Still optional:{" "}
              {todo.map((t) => t.label.replace(" (optional)", "")).join(", ")}.
            </p>
          )}
          <p>
            <small>
              Reminders appear here only. Email and push reminders arrive with
              notifications (M25), and automatic social refresh with social
              account management (M05).
            </small>
          </p>
        </div>
      )}
      <ul className="ob-list">
        {sections.map(([id, label]) => (
          <li key={id}>
            <Link href={`/onboarding/creator/${id}`}>{label}</Link>
          </li>
        ))}
      </ul>
      <div className="ob-actions">
        <Link className="ob-btn quiet" href="/onboarding/creator/complete">
          Back to my summary
        </Link>
      </div>
    </>
  );
}
