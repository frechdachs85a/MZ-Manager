import { describe, expect, it } from "vitest";
import { berlinStunde } from "./format";

describe("Stunde in Berlin", () => {
  it("Mitternacht ist 0, nicht NaN", () => {
    expect(berlinStunde(new Date("2026-10-31T23:00:30Z"))).toBe(0); // 00:00 MEZ
    expect(berlinStunde(new Date("2026-11-01T04:30:00Z"))).toBe(5);
    expect(berlinStunde(new Date("2026-07-01T03:30:00Z"))).toBe(5); // Sommerzeit
  });
});
