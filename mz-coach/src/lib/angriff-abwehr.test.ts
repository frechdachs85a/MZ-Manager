import { describe, expect, it } from "vitest";
import type { SpielMuster, Stil } from "@/lib/mz/analyse/muster";
import { getrennt } from "./angriff-abwehr";

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
});
