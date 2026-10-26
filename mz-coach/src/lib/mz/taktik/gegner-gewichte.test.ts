import { describe, expect, it } from "vitest";
import { gegnerGewichte } from "./gegner-gewichte";

// Erfundene Aufstellungen (keine echten Daten)
const meine = [
  { x: 60, y: 260 }, { x: 104, y: 260 }, { x: 148, y: 260 }, // Abwehr
  { x: 80, y: 180 }, { x: 128, y: 180 }, { x: 104, y: 150 },
  { x: 30, y: 120 }, { x: 104, y: 90 }, { x: 180, y: 60 }, { x: 104, y: 60 }, // 2 außen: links 30, rechts 180
];

describe("gegnerGewichte", () => {
  it("über außen: Kopfball für zentrale Verteidiger, stärkster Verteidiger gegenüber seinem besten Angreifer", () => {
    const g = gegnerGewichte({
      feld: meine,
      gegner: [{ x: 190, y: 60, wert: 1_500_000, label: "A" }, { x: 104, y: 60, wert: 600_000, label: "B" }, { x: 104, y: 300, torwart: true }],
    });
    expect(g.ueberAussen).toBe(true);
    expect(g.kopfball.slice(0, 3)).toEqual([true, true, true]);
    // A steht bei ihm x 190 = bei dir x 18 (links): dein Platz x 60 bekommt den höchsten Faktor
    expect(g.faktor[0]).toBeCloseTo(1.15);
    expect(g.faktor[0]).toBeGreaterThan(g.faktor[2]);
    expect(g.faktor[5]).toBe(1);
  });
  it("eng ohne Flügel-Einstellung: kein Kopfball-Bonus", () => {
    const g = gegnerGewichte({ feld: meine, gegner: [{ x: 104, y: 60, wert: 900_000 }], seinStil: "Kurzpass / normal / normal" });
    expect(g.ueberAussen).toBe(false);
    expect(g.kopfball.every((k) => !k)).toBe(true);
  });
  it("spiegelt eine einseitige Formation zur schwächeren Seite", () => {
    const einseitig = meine.map((p) => (p.x === 30 ? { x: 104, y: 120 } : p)); // nur rechts außen (x 180)
    const g = gegnerGewichte({ feld: einseitig, gegner: [], angriffUeber: "links" });
    expect(g.gespiegelt).toBe(true);
    expect(g.feld[8]).toEqual({ x: 28, y: 60 });
  });
});
