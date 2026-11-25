import Link from "next/link";
import { describeEvent } from "@/features/creator-studio/events";
import { studio, studioContext } from "@/server/studio/service";
import { Card } from "@/features/creator-studio/views";
export const metadata = { title: "Notifications" };
export default async function Page() {
  const ctx = await studioContext();
  const r = await studio.events(ctx.client, ctx.workspaceId);
  const items = r.ok
    ? r.value
        .map((e) => ({ at: e.at, text: describeEvent(e.event) }))
        .filter((e): e is { at: string; text: string } => !!e.text)
    : [];
  return (
    <>
      <h1>Notifications</h1>
      <p className="st-hint">
        Real account events only. There are no unread counts, and no email or
        push messages are sent yet (they arrive with the notifications module,
        M25).
      </p>
      <Card id="n" title="Recent activity">
        {!r.ok ? (
          <p className="st-hint">We could not load your activity right now.</p>
        ) : items.length ? (
          <ul className="st-list">
            {items.map((i) => (
              <li
                key={i.at + i.text}
                className="st-item"
                style={{ gridTemplateColumns: "1fr" }}
              >
                <strong>{i.text}</strong>
                <span className="st-hint">
                  {new Date(i.at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="st-hint">Nothing yet.</p>
        )}
        <p>
          <Link href="/security">Sign-in activity and devices</Link>
        </p>
      </Card>
    </>
  );
}
