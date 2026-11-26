"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { dayKey, occurs, type Item } from "./model";
const modes = ["Day", "Week", "Month", "Agenda"] as const;
type Mode = (typeof modes)[number];
function shift(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}
function exportCalendar(items: Item[]) {
  const esc = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AURA//Content Studio//EN",
  ];
  for (const i of items.filter((i) => i.day)) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + i.id + "@aura",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      "DTSTART;VALUE=DATE:" + i.day.replaceAll("-", ""),
      "SUMMARY:" + esc(i.title),
    );
    if (i.recurring !== "Once")
      lines.push("RRULE:FREQ=" + i.recurring.toUpperCase());
    lines.push("END:VEVENT");
  }
  const url = URL.createObjectURL(
    new Blob([[...lines, "END:VCALENDAR"].join("\r\n")], {
      type: "text/calendar",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "aura-content.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Calendar({
  items,
  open,
  create,
}: {
  items: Item[];
  open: (i: Item) => void;
  create: (day: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date()),
    [mode, setMode] = useState<Mode>("Week");
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const start =
    mode === "Month"
      ? shift(first, -((first.getDay() + 6) % 7))
      : mode === "Week"
        ? shift(anchor, -((anchor.getDay() + 6) % 7))
        : anchor;
  const days = Array.from(
    {
      length:
        mode === "Month" ? 42 : mode === "Week" ? 7 : mode === "Day" ? 1 : 30,
    },
    (_, i) => shift(start, i),
  );
  function move(direction: number) {
    setAnchor(
      mode === "Month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
        : shift(
            anchor,
            direction * (mode === "Agenda" ? 30 : mode === "Week" ? 7 : 1),
          ),
    );
  }
  return (
    <section className="cs-calendar">
      <div className="cs-toolbar">
        <h2>
          {anchor.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button aria-label="Previous period" onClick={() => move(-1)}>
          <ChevronLeft />
        </button>
        <button onClick={() => setAnchor(new Date())}>Today</button>
        <button aria-label="Next period" onClick={() => move(1)}>
          <ChevronRight />
        </button>
        <select
          aria-label="Calendar view"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          {modes.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button onClick={() => exportCalendar(items)}>
          <Download /> Export
        </button>
      </div>
      <div className={"cs-days cs-" + mode.toLowerCase()}>
        {days.map((d) => {
          const key = dayKey(d),
            entries = items.filter((i) => occurs(i, key));
          if (mode === "Agenda" && !entries.length) return null;
          return (
            <div className="cs-date" key={key}>
              <button
                className="cs-date-head"
                aria-label={"Plan content on " + key}
                onClick={() => create(key)}
              >
                <span>
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}{" "}
                  <b>{d.getDate()}</b>
                </span>
                <Plus size={13} />
              </button>
              {entries.map((i) => (
                <button className="cs-event" key={i.id} onClick={() => open(i)}>
                  {i.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {mode === "Agenda" &&
        !days.some((d) => items.some((i) => occurs(i, dayKey(d)))) && (
          <p>No content scheduled in these 30 days.</p>
        )}
    </section>
  );
}
