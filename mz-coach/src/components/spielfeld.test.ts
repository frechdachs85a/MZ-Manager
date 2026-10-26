import { describe, expect, it } from "vitest";
import { heatFarbe } from "./spielfeld";

describe("heatFarbe (feste Wertgrenzen)", () => {
  it("gleiche Farbe für gleichen Wert, unabhängig vom Team", () => {
    expect(heatFarbe(200_000)).toBe("rgb(187 247 208)");
    expect(heatFarbe(700_000)).toBe("rgb(21 128 61)");
    expect(heatFarbe(1_500_000)).toBe("rgb(127 29 29)");
    expect(heatFarbe(3_000_000)).toBe("rgb(127 29 29)");
  });
  it("unter 0,7 Mio bleibt grün", () => {
    expect(heatFarbe(500_000)).toBe("rgb(104 188 135)");
  });
});
