import { describe, expect, it } from "vitest";
import { spielDatum } from "./format";

describe("Zeiten", () => {
  it("Spieldatum umformatieren", () => {
    expect(spielDatum("2026-10-21 14:45:00")).toBe("21.10.2026, 14:45");
  });
});
