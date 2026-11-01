import { describe, expect, it } from "vitest";
import { imVisier, type Leistung } from "./spieler-leistung";

// Erfundene Testdaten
const l = (rolle: Leistung["rolle"], minuten: number, vorlagen: number, tore = 0): Leistung => ({
  rolle,
  spiele: 3,
  minuten,
  tore,
  vorlagen,
  schuesseAufsTor: 0,
  zkGewonnen: 0,
  zkVerloren: 0,
  paesse: 0,
  quellen: { liga: 1, scout: 2 },
});

describe("Im Visier", () => {
  it("meldet Bankspieler, die in der Rolle jeden Startspieler übertreffen, nur ab 180 Minuten", () => {
    const daten = new Map<number, Leistung[]>([
      [1, [l("Flügel", 500, 3)]], // Startelf
      [2, [l("Flügel", 200, 4)]], // Bank, 1,8 je 90 > 0,54
      [3, [l("Flügel", 100, 5)]], // Bank, zu wenig Minuten
    ]);
    const v = imVisier(daten, new Set([1]), new Map([[2, "Max Muster"]]));
    expect(v.map((x) => x.pid)).toEqual([2]);
    expect(v[0].besser[0]).toContain("Vorlagen 1,80 je 90");
  });
});
