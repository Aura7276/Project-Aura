// Monetary values are stored as integer minor units. Currencies here all use two decimal places.
export function toMinor(input: string): number | null {
  const text = input.trim().replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const [major, minor = ""] = text.split(".");
  return Number(major) * 100 + Number(minor.padEnd(2, "0"));
}
export function fromMinor(minor: number | null): string {
  if (minor === null) return "";
  const m = Math.trunc(minor);
  return `${Math.floor(m / 100)}${m % 100 ? "." + String(m % 100).padStart(2, "0") : ""}`;
}
export function formatMoney(minor: number, currency: string, locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
}
