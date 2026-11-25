import Link from "next/link";
import { redirect } from "next/navigation";
import { loadState } from "@/server/creator/service";
import { toggleAction } from "@/features/creator-onboarding/actions";
import {
  buildChecklist,
  checklistSummary,
} from "@/features/creator-onboarding/checklist";
import {
  recommend,
  noPublishedOpportunities,
} from "@/features/creator-onboarding/recommendations";
import { planDisclosure } from "@/features/creator-onboarding/plan";
import {
  EligibilityPanel,
  SummaryList,
} from "@/features/creator-onboarding/summary";
import { m04DashboardEntry } from "@/features/creator-onboarding/integration";

export default async function Page() {
  const { state } = await loadState();
  if (!state.profile?.activated_at) redirect("/onboarding/creator");
  const items = buildChecklist(state);
  const sum = checklistSummary(items);
  const recs = recommend(state, await noPublishedOpportunities.listPublished());
  return (
    <>
      <h1>You’re all set, {state.profile.display_name}</h1>
      <p className="ob-lede">
        Your Creator workspace is active, and your profile is private. Activated{" "}
        {new Date(state.profile.activated_at).toLocaleDateString("en-IN", {
          dateStyle: "long",
        })}
        .
      </p>
      <div className="ob-grid two">
        <div className="ob-grid">
          <section className="ob-box" aria-labelledby="plan-h">
            <h2 id="plan-h">Your first seven days</h2>
            <p className="ob-hint">{planDisclosure}</p>
            <ol className="ob-list">
              {state.plan?.actions.map((a) => (
                <li key={a.id}>
                  <form action={toggleAction}>
                    <input type="hidden" name="action" value={a.id} />
                    <input
                      type="hidden"
                      name="done"
                      value={a.status === "done" ? "no" : "yes"}
                    />
                    <button
                      className="ob-btn quiet"
                      aria-pressed={a.status === "done"}
                      aria-label={`${a.status === "done" ? "Mark not done" : "Mark done"}: ${a.title}`}
                    >
                      {a.status === "done" ? "Done" : "Mark done"}
                    </button>
                  </form>
                  <span>
                    <strong>
                      Day {a.day}: {a.title}
                    </strong>
                    <br />
                    <small>{a.detail}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="ob-box" aria-labelledby="opp-h">
            <h2 id="opp-h">Opportunities for you</h2>
            {recs.empty && (
              <p>
                No published opportunities yet. We will not show placeholders or
                made-up campaigns. Here is how to prepare:
              </p>
            )}
            <ul className="ob-list">
              {recs.preparation.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.title}</strong>
                    <br />
                    <small>{p.detail}</small>
                  </span>
                  {p.href && <Link href={p.href}>Open</Link>}
                </li>
              ))}
            </ul>
          </section>
          <section className="ob-box" aria-labelledby="sum-h">
            <h2 id="sum-h">Your summary</h2>
            <SummaryList state={state} />
          </section>
        </div>
        <div className="ob-grid">
          <section className="ob-box" aria-labelledby="chk-h">
            <h2 id="chk-h">Profile checklist</h2>
            <p className="ob-hint">
              {sum.requiredDone} of {sum.requiredTotal} required done.{" "}
              {sum.optionalAddressed} of {sum.optionalTotal} optional sections
              addressed. Skipping is fine.
            </p>
            <ul className="ob-list">
              {items.map((i) => (
                <li key={i.id}>
                  <span aria-hidden>
                    {i.state === "done"
                      ? "✓"
                      : i.state === "skipped"
                        ? "–"
                        : "○"}
                  </span>
                  <span>
                    {i.href ? <Link href={i.href}>{i.label}</Link> : i.label}
                    <br />
                    <small>
                      {i.state === "done"
                        ? "Done"
                        : i.state === "skipped"
                          ? "Skipped for now"
                          : i.state === "unavailable"
                            ? i.note
                            : "To do"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="ob-box" aria-labelledby="elig-h">
            <h2 id="elig-h">Where you stand</h2>
            <EligibilityPanel state={state} />
          </section>
          <section className="ob-box" aria-labelledby="next-h">
            <h2 id="next-h">What’s next</h2>
            <p>
              Your Creator home (the dashboard) is being built next, at{" "}
              <code>{m04DashboardEntry}</code>. Until then you can edit your
              profile and keep your plan here.
            </p>
            <div className="ob-actions">
              <Link
                className="ob-btn primary"
                href="/onboarding/creator/profile"
              >
                Edit my profile
              </Link>
              <Link className="ob-btn quiet" href="/workspaces">
                Switch workspace
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
