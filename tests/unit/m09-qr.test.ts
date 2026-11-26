import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  encodeQr,
  pickVersion,
  qrSvgPath,
} from "@/features/creator-profile/qr";
// Reference matrices generated once by the Python `qrcode` 8.2 package (byte mode, level M, each of the 8 masks forced).
// Kept as a fixture so the test needs no network and no extra dependency.
type Ref = { text: string; version: number; mask: number; rows: string[] };
const refs: Ref[] = JSON.parse(
  readFileSync("tests/unit/fixtures/qr-reference.json", "utf8"),
);
describe("M09 QR encoder", () => {
  it("matches the reference encoder module for module on every version 1 to 10 and every mask", () => {
    expect(refs.length).toBe(88);
    let checked = 0;
    for (const r of refs) {
      const q = encodeQr(r.text, r.mask);
      expect(q.version, `${r.text.length} bytes`).toBe(r.version);
      const rows = q.modules.map((row) =>
        row.map((d) => (d ? "1" : "0")).join(""),
      );
      expect(rows, `v${r.version} mask ${r.mask}`).toEqual(r.rows);
      checked++;
    }
    expect(checked).toBe(88);
  });
  it("chooses the smallest version and refuses text that does not fit", () => {
    expect(pickVersion(14)).toBe(1);
    expect(pickVersion(15)).toBe(2);
    expect(pickVersion(213)).toBe(10);
    expect(pickVersion(214)).toBeNull();
    expect(() => encodeQr("x".repeat(300))).toThrow();
  });
  it("draws an SVG path with a quiet zone", () => {
    const q = encodeQr("https://aura.example/kit/abc");
    const { path, view } = qrSvgPath(q.modules);
    expect(view).toBe(q.size + 8);
    expect(path.startsWith("M4 4h7")).toBe(true); // finder pattern top row after the 4-module quiet zone
  });
});
