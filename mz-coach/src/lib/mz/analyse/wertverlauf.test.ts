import { describe, expect, it } from "vitest";
import { wertbereich, wertverlauf } from "./wertverlauf";

// Beispiel von Marcus (mz-wissen.md, Abschnitt 14): FC Toho gegen Sydney FC, Werte vom 26.10.2026
const W: Record<number, number> = {
  // FC Toho Startelf (Summe 12.293.741) und Einwechsler
  1: 1073111, 2: 925612, 3: 1307990, 4: 965281, 5: 1172011, 6: 1084561, 7: 1307990, 8: 1236354, 9: 1042030, 10: 1247600, 11: 931201,
  12: 1260960, 13: 1140180, 14: 1105418,
  // Sydney Startelf (Summe 11.243.191) und Einwechsler
  21: 1080813, 22: 891600, 23: 852886, 24: 1148904, 25: 1176714, 26: 947764, 27: 919478, 28: 1094308, 29: 1081358, 30: 1315488, 31: 733878,
  32: 1185984, 33: 777024,
};

describe("Kaderwert über die Spielzeit", () => {
  const v = wertverlauf({
    eigeneElf: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    gegnerElf: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
    // Nazarov (3) -> Kaupa (12), Cytrynski (8) -> Rodekamp (13) in der 60., Hyuga (10) -> Ishizaki (14) in der 70.
    eigeneWechsel: [{ minute: 60, raus: 3, rein: 12 }, { minute: 60, raus: 8, rein: 13 }, { minute: 70, raus: 10, rein: 14 }],
    // Toscano (32) für Lenz (31), Denzin (33) für Reifer (26) in der 40.
    gegnerWechsel: [{ minute: 40, raus: 31, rein: 32 }, { minute: 40, raus: 26, rein: 33 }],
    wert: (p) => W[p],
    name: (p) => `p${p}`,
  });
  const r2 = (n: number) => Math.round(n * 100) / 100;

  it("rechnet die Zahlen von Marcus nach", () => {
    expect(v.fenster.map((f) => [f.von, f.bis])).toEqual([[0, 40], [40, 60], [60, 70], [70, 90]]);
    expect(v.fenster.map((f) => f.eigen)).toEqual([12293741, 12293741, 12150537, 12008355]);
    expect(v.fenster.map((f) => f.gegner)).toEqual([11243191, 11524557, 11524557, 11524557]);
    expect(v.fenster.map((f) => r2(f.verhaeltnis))).toEqual([1.09, 1.07, 1.05, 1.04]);
    expect(r2(v.gewichtet.verhaeltnis)).toBe(1.07);
    expect(Math.round(v.gewichtet.eigen / 10000) / 100).toBe(12.21);
    expect(Math.round(v.gewichtet.gegner / 10000) / 100).toBe(11.4);
    expect(v.fehlend).toEqual([]);
  });

  it("ordnet den Wertbereich ein", () => {
    expect(wertbereich(1.07)).toContain("0,85 bis 1,15");
    expect(wertbereich(1.2)).toContain("2,44");
  });
});
