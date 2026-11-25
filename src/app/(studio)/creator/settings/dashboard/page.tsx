import {
  replayWalkthrough,
  resetPrefs,
  savePrefs,
} from "@/features/creator-studio/actions";
import { timezones } from "@/features/creator-studio/schemas";
import { widgetIds, widgetLabels } from "@/features/creator-studio/types";
import { studioContext } from "@/server/studio/service";
import { Card } from "@/features/creator-studio/views";
export const metadata = { title: "Dashboard settings" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; reset?: string; error?: string }>;
}) {
  const { prefs } = await studioContext();
  const q = await searchParams;
  return (
    <>
      <h1>Dashboard settings</h1>
      <p className="st-hint">
        Choose what appears on Home. Important notices and access explanations
        cannot be hidden.
      </p>
      {q.saved && (
        <p className="st-notice" role="status">
          Settings saved.
        </p>
      )}
      {q.reset && (
        <p className="st-notice" role="status">
          Settings reset to defaults.
        </p>
      )}
      {q.error && (
        <p className="st-notice" role="alert">
          We could not save that. Please try again.
        </p>
      )}
      <div className="st-split">
        <Card id="prefs" title="Widgets and preferences">
          <form action={savePrefs}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend>Show on Home</legend>
              {widgetIds.map((w) => (
                <label className="st-check" key={w}>
                  <input
                    type="checkbox"
                    name="show"
                    value={w}
                    defaultChecked={!prefs.hidden_widgets.includes(w)}
                  />
                  <span>{widgetLabels[w]}</span>
                </label>
              ))}
            </fieldset>
            <label className="st-check">
              <input
                type="checkbox"
                name="gamification"
                defaultChecked={prefs.gamification_enabled}
              />
              <span>
                Milestones and streaks
                <br />
                <small className="st-hint">
                  Private to you. Turn off if you would rather not see them.
                </small>
              </span>
            </label>
            <label className="st-check">
              <input
                type="checkbox"
                name="digest"
                defaultChecked={prefs.digest_opt_in}
              />
              <span>
                Weekly email digest
                <br />
                <small className="st-hint">
                  Saved as a preference only. Email delivery is not set up yet,
                  so nothing will be sent until the notifications module exists.
                </small>
              </span>
            </label>
            <div className="st-field">
              <label htmlFor="tz">Time zone</label>
              <select
                id="tz"
                name="timezone"
                defaultValue={
                  timezones.includes(prefs.timezone as never)
                    ? prefs.timezone
                    : "Asia/Kolkata"
                }
              >
                {timezones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
              <p className="st-hint">
                Decides when your day and week start for actions, streaks and
                reviews.
              </p>
            </div>
            <button className="st-btn primary">Save settings</button>
          </form>
          <form action={resetPrefs} style={{ marginTop: "0.6rem" }}>
            <button className="st-btn">Reset to defaults</button>
          </form>
        </Card>
        <Card id="tour" title="Walkthrough">
          <p className="st-hint">
            Status:{" "}
            {prefs.walkthrough_status === "not_seen"
              ? "not taken"
              : prefs.walkthrough_status}
            . You can repeat it whenever you like.
          </p>
          <form action={replayWalkthrough}>
            <button className="st-btn">Replay the walkthrough</button>
          </form>
        </Card>
      </div>
    </>
  );
}
