import { describe, expect, it } from "vitest";
import type { SpielMuster, Stil } from "@/lib/mz/analyse/muster";
import { datenWahl, direkteAntwort, getrennt, stileGegenAussen, teamWechsel } from "./angriff-abwehr";

// Erfundene Spiele (keine echten Daten)
const stil = (tactic: string, hinten: number, aussen: boolean): Stil =>
  ({
    formation: { abwehr: hinten, mittel: 10 - hinten - 2, sturm: 2, unklar: 0, unklarSturm: 0, text: "" },
    tactic,
    engeMitte: !aussen,
    fuenferkette: hinten >= 5,
    feld: Array.from({ length: 10 }, (_, i) => ({ x: aussen && i === 9 ? 20 : 104, y: i < hinten ? 230 : 150 })),
  }) as Stil;
const spiel = (eigen: Stil, gegner: Stil, t: number, g: number) =>
  ({ mid: 1, ergebnis: t > g ? "S" : t === g ? "U" : "N", tore: { eigen: t, gegner: g }, eigen, gegner: { ...gegner, name: "X", tid: 1 } }) as unknown as SpielMuster;

describe("Angriff und Abwehr getrennt", () => {
  it("zählt Tore nach Angriff gegen Kette und Gegentore nach Kette gegen seinen Angriff", () => {
    const r = getrennt([
      spiel(stil("wings", 4, true), stil("shortpass", 5, false), 3, 0),
      spiel(stil("wings", 4, true), stil("wings", 5, true), 1, 2),
      spiel(stil("shortpass", 5, false), stil("wings", 4, true), 2, 0),
    ]);
    expect(r.angriff.find((z) => z.schluessel === "Flügel gegen Fünferkette")).toMatchObject({ spiele: 2, tore: 2 });
    expect(r.angriff.find((z) => z.schluessel === "Kurzpass gegen Viererkette")).toMatchObject({ spiele: 1, tore: 2 });
    expect(r.abwehr.find((z) => z.schluessel === "Viererkette gegen eng")).toMatchObject({ spiele: 1, gegentore: 0, zuNull: 1 });
    expect(r.abwehr.find((z) => z.schluessel === "Viererkette gegen über außen")).toMatchObject({ spiele: 1, gegentore: 2 });
    expect(r.abwehr.find((z) => z.schluessel === "Fünferkette gegen über außen")).toMatchObject({ spiele: 1, gegentore: 0 });
  });

  it("wählt Angriff nach seiner Kette und Abwehr nach seinem Angriff, nur Zellen mit genug Spielen", () => {
    const viele = (n: number, e: Stil, g: Stil, t: number, gt: number) => Array.from({ length: n }, () => spiel(e, g, t, gt));
    const r = getrennt([
      ...viele(8, stil("wings", 5, true), stil("wings", 3, true), 4, 1), // Flügel gegen 3er: 4 Tore; 5er gegen außen: 1 Gegentor
      ...viele(8, stil("shortpass", 4, false), stil("wings", 3, true), 2, 3), // Kurzpass gegen 3er: 2 Tore; 4er gegen außen: 3
      ...viele(3, stil("longball", 3, false), stil("wings", 3, true), 9, 0), // zu wenige Spiele
    ]);
    const w = datenWahl(r, "3er-Kette", "über außen")!;
    expect(w.angriff).toMatchObject({ art: "Flügel", tore: 4 });
    expect(w.abwehr).toMatchObject({ kette: "Fünferkette", gegentore: 1 });
    expect(datenWahl(r, "Fünferkette", "über außen")).toBeNull();
  });

  it("direkte Antwort: beste Aufstellung gegen genau diese Formation ab 8 Spielen; Team stellt um oder nicht", () => {
    const viele = (n: number, e: Stil, g: Stil, t: number, gt: number) => Array.from({ length: n }, () => spiel(e, g, t, gt));
    const gegner = stil("wings", 3, true); // 3-5-2 über außen
    const sp = [...viele(8, stil("wings", 5, true), gegner, 3, 1), ...viele(9, stil("wings", 4, true), gegner, 1, 2), ...viele(2, stil("shortpass", 3, false), gegner, 5, 0)];
    const d = direkteAntwort(sp, "3-5-2 über außen")!;
    expect(d.spiele).toBe(19);
    expect(d.beste?.schluessel).toBe("5-3-2 Flügel/?");
    expect(direkteAntwort(sp, "4-3-3 eng")).toBeNull();
    const t = teamWechsel([{ name: "A", rang: 1, spiele: sp }, { name: "B", rang: 2, spiele: viele(5, stil("wings", 4, true), gegner, 2, 0) }]);
    expect(t[0].stelltUm).toBe(true);
    expect(t[1].stelltUm).toBe(false);
  });

  it("Stil gilt als gegen außen, wenn die Topteams ihn überwiegend gegen Gegner über außen spielen", () => {
    const fl = stil("wings", 5, true);
    const kp = stil("shortpass", 3, false);
    const sp = [spiel(fl, stil("wings", 4, true), 2, 0), spiel(fl, stil("wings", 4, true), 2, 0), spiel(fl, stil("shortpass", 3, false), 1, 0), spiel(kp, stil("shortpass", 3, false), 2, 0), spiel(kp, stil("wings", 4, true), 2, 0), spiel(kp, stil("shortpass", 4, false), 1, 1)];
    expect([...stileGegenAussen(sp)]).toEqual(["5-3-2 Flügel/?"]);
  });
});
