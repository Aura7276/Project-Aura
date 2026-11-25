import { expect, it } from "vitest";
import {
  destinations,
  isDestination,
  implementedDestination,
  destinationPath,
  footerGroups,
} from "../../src/config/navigation";
it("resolves every footer entry to a known internal readiness route", () => {
  for (const id of Object.values(footerGroups).flat()) {
    expect(isDestination(id)).toBe(true);
    if (implementedDestination(id))
      expect(destinationPath(id)).not.toMatch(/^\/readiness\//);
    else expect(destinationPath(id)).toMatch(/^\/readiness\/[a-z]+$/);
    expect(destinations[id][1]).toBeTruthy();
  }
  expect(isDestination("__proto__")).toBe(false);
  expect(isDestination("//external.example")).toBe(false);
});
