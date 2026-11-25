// Period model. Dates are LOCAL calendar days in the Creator's stored time zone (the database supplies "today" in that zone).
// A period is INCLUSIVE of both its first and last day. The previous comparable period has the same number of days and ends the day before the current one starts.
export type Period = { start: string; end: string; days: number };
export type RangeKey = "7d" | "30d" | "90d" | "custom";
const MS = 86_400_000;
const t = (d: string) => Date.parse(d + "T00:00:00Z");
export const isDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(t(s)) &&
  new Date(t(s)).toISOString().slice(0, 10) === s;
export const addDays = (d: string, n: number) =>
  new Date(t(d) + n * MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.round((t(b) - t(a)) / MS);
export const span = (start: string, end: string): Period => ({
  start,
  end,
  days: daysBetween(start, end) + 1,
});
export const maxCustomDays = 730;
export type Resolved =
  | {
      ok: true;
      key: RangeKey;
      current: Period;
      previous: Period;
      includesToday: boolean;
      notes: string[];
    }
  | { ok: false; reason: string };
export function resolveRange(
  key: RangeKey,
  today: string,
  custom?: { start?: string; end?: string },
): Resolved {
  if (!isDate(today))
    return { ok: false, reason: "Today is not a valid date." };
  let current: Period;
  if (key === "custom") {
    if (!isDate(custom?.start) || !isDate(custom?.end))
      return { ok: false, reason: "Choose a start and an end date." };
    if (custom.end < custom.start)
      return { ok: false, reason: "The end date is before the start date." };
    if (custom.end > today)
      return { ok: false, reason: "The end date is in the future." };
    current = span(custom.start, custom.end);
    if (current.days > maxCustomDays)
      return {
        ok: false,
        reason: `Choose a range of ${maxCustomDays} days or fewer.`,
      };
  } else {
    const n = key === "7d" ? 7 : key === "30d" ? 30 : 90;
    current = span(addDays(today, -(n - 1)), today);
  }
  const previous = span(
    addDays(current.start, -current.days),
    addDays(current.start, -1),
  );
  const includesToday = current.end === today;
  const notes = [
    `Both ends are included: ${current.days} days from ${current.start} to ${current.end}.`,
    `The previous period is the ${previous.days} days from ${previous.start} to ${previous.end}.`,
  ];
  if (includesToday)
    notes.push(
      "The current period includes today, which is not finished. Today's own numbers may not be recorded yet.",
    );
  return { ok: true, key, current, previous, includesToday, notes };
}
/** Local calendar day of an instant in a named IANA zone (so a late-evening post is not counted on the wrong day). */
export function localDay(instant: string | Date, tz: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(instant));
    const g = (k: string) => parts.find((p) => p.type === k)?.value;
    return `${g("year")}-${g("month")}-${g("day")}`;
  } catch {
    return null;
  }
}
export const inPeriod = (d: string, p: Period) => d >= p.start && d <= p.end;

/** Converts a local date and time in an IANA zone to a UTC instant without a date library. */
export function zonedInstant(
  date: string,
  time: string,
  tz: string,
): string | null {
  try {
    const guess = Date.parse(`${date}T${time}:00Z`);
    if (Number.isNaN(guess)) return null;
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const read = (ms: number) => {
      const p = Object.fromEntries(
        fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
      );
      return Date.parse(
        `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
      );
    };
    let ms = guess - (read(guess) - guess);
    ms = guess - (read(ms) - ms);
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}
