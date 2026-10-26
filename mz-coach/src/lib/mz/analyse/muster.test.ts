import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { bedingungText, lageAus, regelMuster, spielMuster, stilMatrix, teamMuster, type SpielMuster } from "./muster";
import { musterRolle } from "./rolle";

describe("Lage aus dem Spielstand", () => {
  it("Heim und Gast", () => {
    expect(lageAus("2:1", true)).toBe("führt");
    expect(lageAus("2:1", false)).toBe("hinten");
    expect(lageAus("0:0", true)).toBe("gleich");
  });
});

// Echte Ligaspiele von YugiPeeK (tid 97933), nur lokal (siehe .gitignore)
const MIDS = [1625669242, 1625669247, 1625669257, 1625669263, 1625669264, 1625669272, 1625669276];
const dateien = MIDS.map((m) => new URL(`../parser/fixtures/stats-${m}.xml`, import.meta.url));
const vorhanden = dateien.every((d) => existsSync(d));

describe.skipIf(!vorhanden)("Spielmuster an 7 echten Ligaspielen", () => {
  const spiele = dateien.map((d) => spielMuster(parseStatsXml(readFileSync(d, "utf8")), 97933));

  it("Ergebnis und Bilanz wie in der Gegneranalyse (0 S, 0 U, 7 N, Tore 8:26)", () => {
    const t = teamMuster(spiele);
    expect(t.bilanz).toEqual({ S: 0, U: 0, N: 7 });
    expect(spiele.reduce((n, s) => n + s.tore.eigen, 0)).toBe(8);
    expect(spiele.reduce((n, s) => n + s.tore.gegner, 0)).toBe(26);
    expect(spiele.every((s) => s.typ === "1")).toBe(true);
  });

  it("YugiPeeK wechselt nie (wie in der Gegneranalyse)", () => {
    expect(teamMuster(spiele).wechselMinuten).toEqual([]);
  });

  it("Matrix zählt jedes Spiel genau einmal", () => {
    expect(stilMatrix(spiele).reduce((n, z) => n + z.spiele, 0)).toBe(7);
  });
});

const EIGEN = new URL("../parser/fixtures/stats-1625669278.xml", import.meta.url);
describe.skipIf(!existsSync(EIGEN))("Spielverlauf im eigenen Spiel vom 21.10.", () => {
  it("drei Regelwechsel mit Regelminute, Rolle und Spielstand, zeitlich sortiert", () => {
    const m = spielMuster(parseStatsXml(readFileSync(EIGEN, "utf8")), 847159);
    expect(m.wechsel.map((w) => w.regelMinute)).toEqual([55, 60, 60]);
    expect(m.wechsel[0]).toMatchObject({ raus: "Kojiro Hyuga", rein: "Balthasar Wiesenberg", grund: "preset" });
    expect(m.wechsel.map((w) => w.rolleRaus)).toEqual(["Mittelstürmer", "Mittelfeld", "Innenverteidiger"]);
    expect(m.wechsel.every((w) => !w.rolleAbgeleitet && w.lage === "führt")).toBe(true);
    expect(m.ablauf).toHaveLength(3);
    expect(m.ablauf.map((a) => a.minute)).toEqual([...m.ablauf.map((a) => a.minute)].sort((a, b) => a - b));
    expect(teamMuster([m]).wechselNachRolle.reduce((n, w) => n + w.anzahl, 0)).toBe(3);
  });
});

describe("Rolle nach Vorgabe (Editor-Koordinaten)", () => {
  it("Grenzen", () => {
    expect(musterRolle({ x: 25, y: 80 })).toBe("Eckstürmer");
    expect(musterRolle({ x: 185, y: 60 })).toBe("Eckstürmer");
    expect(musterRolle({ x: 26, y: 80 })).toBe("Mittelstürmer");
    expect(musterRolle({ x: 20, y: 81 })).toBe("Mittelstürmer");
    expect(musterRolle({ x: 105, y: 110 })).toBe("Mittelstürmer");
    expect(musterRolle({ x: 105, y: 111 })).toBe("Mittelfeld");
    expect(musterRolle({ x: 45, y: 205 })).toBe("Außenverteidiger");
    expect(musterRolle({ x: 165, y: 230 })).toBe("Außenverteidiger");
    expect(musterRolle({ x: 46, y: 205 })).toBe("Innenverteidiger");
    expect(musterRolle({ x: 20, y: 204 })).toBe("Mittelfeld");
    expect(musterRolle({ x: 105, y: 250 }, true)).toBe("Torwart");
  });
});

describe("Bedingung aus scorecondition/score", () => {
  it("Texte", () => {
    expect(bedingungText({ art: "ahead_by_at_least", tore: 2 })).toBe("bei mindestens 2 Toren Führung");
    expect(bedingungText({ art: "down_by_at_least", tore: 1 })).toBe("bei mindestens 1 Tor Rückstand");
    expect(bedingungText({ art: "tie" })).toBe("bei Gleichstand");
  });
});

// Künstliche Muster (keine echten Daten), um die Sätze zu prüfen
const basis = (mid: number, extra: Partial<SpielMuster>): SpielMuster =>
  ({ mid, ergebnis: "U", tore: { eigen: 0, gegner: 0 }, wechsel: [], taktikwechsel: [], karten: [], ablauf: [], torVerlauf: [], ...extra }) as unknown as SpielMuster;
const w = (regelMinute: number, rolleRaus: string, lage: "führt" | "gleich" | "hinten", bedingung?: { art: string; tore?: number }) =>
  ({ minute: regelMinute + 2, regelMinute, lage, grund: "preset", bedingung, raus: "", rein: "", rolleRaus, rolleAbgeleitet: false, stand: "" }) as SpielMuster["wechsel"][number];

describe("Regelmuster über mehrere Spiele", () => {
  it("immer gleiche Wechsel, unabhängig vom Spielstand", () => {
    const sp = [
      basis(1, { wechsel: [w(55, "Eckstürmer", "führt"), w(55, "Mittelstürmer", "führt"), w(55, "Außenverteidiger", "führt")] }),
      basis(2, { wechsel: [w(55, "Außenverteidiger", "hinten"), w(55, "Eckstürmer", "hinten"), w(55, "Mittelstürmer", "hinten")] }),
    ];
    expect(regelMuster(sp)[0].text).toBe("Wechselt in der 55. immer (2 von 2 Spielen) Eckstürmer, Mittelstürmer und Außenverteidiger, unabhängig vom Spielstand.");
  });

  it("Bedingung aus der XML", () => {
    const sp = [basis(1, { wechsel: [w(55, "Mittelstürmer", "führt", { art: "ahead_by_at_least", tore: 1 })] }), basis(2, {})];
    expect(regelMuster(sp)[0].text).toBe("Wechselt in der 55. in 1 von 2 Spielen Mittelstürmer, Bedingung laut XML: bei mindestens 1 Tor Führung.");
  });

  it("Taktikwechsel bei Rückstand mit Minutenspanne, Bezug auf Spiele mit Rückstand", () => {
    const hinten = [{ minute: 10, frame: 900, eigen: false }];
    const tw = (minute: number) => ({ minute, lage: "hinten" as const, art: "aggression", neu: "aggressive", stand: "" });
    const sp = [basis(1, { torVerlauf: hinten, taktikwechsel: [tw(67)] }), basis(2, { torVerlauf: hinten, taktikwechsel: [tw(91)] }), basis(3, {})];
    expect(regelMuster(sp).find((s) => s.art === "taktik")?.text).toBe("Stellt bei Rückstand zwischen der 67. und 91. auf aggressiv (in 2 von 2 Spielen mit Rückstand; Minute laut time-Attribut).");
  });

  it("zurückgelegen ohne Auslösung: sehr wahrscheinlich keine Rückstandsregel", () => {
    const sp = [basis(1, { torVerlauf: [{ minute: 20, frame: 1800, eigen: false }] }), basis(2, {})];
    const t = regelMuster(sp).filter((s) => s.art === "keine").map((s) => s.text);
    expect(t).toContain("Lag in 1 von 2 Spielen (erstmals ab der 20.), nie eine Änderung von Taktik, Spielweise oder Härte bei Rückstand: sehr wahrscheinlich keine Rückstandsregel dafür.");
  });
});

describe("Rot-Regel des Gegners", () => {
  it("Taktikwechsel bis 2 Minuten nach eigener Roter Karte wird als Rot-Regel erkannt, nicht als Spielstandregel", () => {
    const basis = { mid: 1, ergebnis: "U", tore: { eigen: 1, gegner: 1 }, wechsel: [], ablauf: [], torVerlauf: [] } as unknown as SpielMuster;
    const spiel = {
      ...basis,
      karten: [{ minute: 43, lage: "gleich", art: "red", spieler: "", stand: "1:1" }],
      taktikwechsel: [{ minute: 43, lage: "gleich", art: "playstyle", neu: "defensive", stand: "1:1" }],
    } as SpielMuster;
    const ohne = { ...basis, mid: 2, karten: [], taktikwechsel: [] } as unknown as SpielMuster;
    const r = regelMuster([spiel, ohne]);
    expect(r.some((x) => x.text.startsWith("Rot-Regel: stellt nach eigener Roter Karte sofort auf Spielweise defensiv (in 1 von 1"))).toBe(true);
    expect(r.some((x) => x.text.startsWith("Stellt bei Gleichstand"))).toBe(false);
  });
});
