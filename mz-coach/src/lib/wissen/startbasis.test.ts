import { describe, expect, it } from "vitest";
import { naechsterLigaspieltag } from "./startbasis";

describe("naechsterLigaspieltag", () => {
  it("findet Mittwoch und Sonntag", () => {
    // 24.10.2026 ist ein Samstag
    expect(naechsterLigaspieltag(new Date(2026, 9, 24)).getDate()).toBe(25);
    // Montag 26.10. -> Mittwoch 28.10.
    expect(naechsterLigaspieltag(new Date(2026, 9, 26)).getDate()).toBe(28);
    // Mittwoch selbst bleibt Mittwoch
    expect(naechsterLigaspieltag(new Date(2026, 9, 28)).getDate()).toBe(28);
  });
});
