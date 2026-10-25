import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KaderSeiteUnbekannt } from "./kader";
import { istSpielliste, ligaspieleDieserSaison, parseSpielliste } from "./spielliste";

// Echte Spielliste von YugiPeeK (tid 97933), gespeichert am 25.10.2026, nur lokal vorhanden.
const DATEI = new URL("./fixtures/spielliste-97933-2026-10-25.html", import.meta.url);
const HTML = existsSync(DATEI) ? readFileSync(DATEI, "utf8") : null;

it("ohne Liste: klare Meldung", () => {
  expect(istSpielliste("<html></html>")).toBe(false);
  expect(() => parseSpielliste("<html></html>")).toThrow(KaderSeiteUnbekannt);
});

describe.skipIf(!HTML)("Echte Spielliste tid 97933", () => {
  const l = parseSpielliste(HTML ?? "");

  it("liest Team und alle 25 Spiele", () => {
    expect(l).toMatchObject({ tid: 97933, teamName: "YugiPeeK ✈", serverzeit: "2026-10-25T07:17:33.000Z" });
    expect(l.spiele).toHaveLength(25);
    expect(l.spiele[0]).toMatchObject({ mid: 1637265680, datum: "2026-10-24", zeit: "22:00", art: "Offizieller Pokal", altersklasse: true });
  });

  it("filtert die 2 Ligaspiele dieser Saison", () => {
    expect(ligaspieleDieserSaison(l)).toEqual([
      expect.objectContaining({ mid: 1625669276, datum: "2026-10-21", wettbewerb: "div1.1", heim: { tid: 97933, name: "YugiPeeK ✈" }, gast: { tid: 97246, name: "Sydney FC" }, tore: { heim: 2, gast: 4 } }),
      expect.objectContaining({ mid: 1625669272, datum: "2026-10-18", heim: { tid: 850456, name: "AKKISLA SPOR" }, tore: { heim: 4, gast: 2 } }),
    ]);
  });

  it("zählt Spielarten wie auf der Seite", () => {
    const n = (art: string) => l.spiele.filter((s) => s.art === art).length;
    expect([n("Ligaspiel"), n("Offizieller Pokal"), n("Freundschaftsspiel"), n("Scoutspiel")]).toEqual([2, 20, 2, 1]);
  });
});

describe("letzte Ligaspiele", () => {
  it("nimmt höchstens 8, die neuesten zuerst, nur Ligaspiele dieser Saison", async () => {
    const { letzteLigaspiele, LIGA_MID_AB } = await import("./spielliste");
    const spiel = (i: number, art = "Ligaspiel") => ({
      mid: LIGA_MID_AB + i,
      datum: `2026-10-${String(i).padStart(2, "0")}`,
      art,
      altersklasse: false,
      heim: { name: "A" },
      gast: { name: "B" },
    });
    const l = [...Array.from({ length: 10 }, (_, i) => spiel(i + 1)), spiel(20, "Freundschaftsspiel"), { ...spiel(21), mid: 5 }];
    const r = letzteLigaspiele(l);
    expect(r).toHaveLength(8);
    expect(r[0].datum).toBe("2026-10-10");
    expect(r.at(-1)!.datum).toBe("2026-10-03");
  });
});
