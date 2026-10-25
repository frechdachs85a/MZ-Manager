import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { istStatsXml, parseStatsXml, statsXmlAus, StatsXmlFehler } from "./stats";

// Echte Stats-XML von Spiel 1625669278 (21.10.2026), nur lokal vorhanden (Repo ist öffentlich).
const DATEI = new URL("./fixtures/stats-1625669278.xml", import.meta.url);
const XML = existsSync(DATEI) ? readFileSync(DATEI, "utf8") : null;

describe("Stats-XML Hilfen", () => {
  it("erkennt und schneidet die XML aus einer gespeicherten Seite", () => {
    const html = '<html><body><pre><SoccerStatistics matchId="1"></SoccerStatistics></pre></body></html>';
    expect(istStatsXml(html)).toBe(true);
    expect(statsXmlAus(html)).toBe('<SoccerStatistics matchId="1"></SoccerStatistics>');
    expect(() => statsXmlAus("<html><body></body></html>")).toThrow(StatsXmlFehler);
  });
});

describe.skipIf(!XML)("Echte Stats-XML, Spiel 1625669278", () => {
  const s = parseStatsXml(XML ?? "");
  const name = (id?: number) => s.spieler.find((p) => p.id === id)?.name;

  it("liest Spiel, Teams und Einstellungen", () => {
    expect(s).toMatchObject({ mid: 1625669278, datum: "2026-10-21 14:45:00", final: true });
    expect(s.teams.map((t) => [t.name, t.heim, t.tactic, t.playstyle, t.aggression])).toEqual([
      ["FFK Kosova", true, "wings", "normal", "passive"],
      ["FC Toho", false, "shortpass", "normal", "normal"],
    ]);
    expect(s.spieler).toHaveLength(32);
    expect(s.hinweise).toEqual([]);
  });

  it("Startelf in Editor-Koordinaten; Auftrags-Testfall Cavalcante 103/63, Chille 33/223", () => {
    const startelf = s.spieler.filter((p) => p.teamId === 847159 && p.editor);
    expect(startelf).toHaveLength(11);
    expect(s.spieler.find((p) => p.name === "Jorge Cavalcante")!.editor).toEqual({ x: 103, y: 63 });
    expect(s.spieler.find((p) => p.name === "Massimo Chille")!.editor).toEqual({ x: 33, y: 223 });
    // Gegner mit Torwart bei origin-y 0 (x gespiegelt)
    expect(s.spieler.filter((p) => p.teamId === 96721 && p.editor)).toHaveLength(11);
  });

  it("FC Toho stand auf höchstens 1 Punkt genau wie die kupass-Vorlage aus mz-wissen.md", () => {
    const kupass = [[33, 222], [79, 235], [127, 235], [175, 222], [79, 186], [127, 186], [103, 142], [72, 100], [134, 100], [103, 63]];
    const feld = s.spieler.filter((p) => p.teamId === 847159 && p.editor && !p.torwart).map((p) => p.editor!);
    for (const [x, y] of kupass) {
      expect(feld.some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1)).toBe(true);
    }
  });

  it("Tore mit Vorlage und Spielstand, Wechsel mit Regelminute", () => {
    expect(s.tore).toHaveLength(9);
    expect(s.tore[0]).toMatchObject({ clock: "9:23.333", stand: "0:1" });
    expect(name(s.tore[0].schuetze)).toBe("Jorge Cavalcante");
    expect(name(s.tore[0].vorlage)).toBe("Kojiro Hyuga");
    expect(s.tore.at(-1)!.stand).toBe("0:9");
    expect(s.wechsel.map((w) => [name(w.rein), name(w.raus), w.grund, w.regelMinute, w.minute, w.stand])).toEqual([
      ["Balthasar Wiesenberg", "Kojiro Hyuga", "preset", 55, 60, "0:5"],
      ["Clemens Rodekamp", "Maksymilian Cytrynski", "preset", 60, 62, "0:5"],
      ["Bülent Kaupa", "Petar Nazarov", "preset", 60, 62, "0:5"],
    ]);
    expect(s.karten).toEqual([expect.objectContaining({ art: "yellow", clock: "65:17.666", stand: "0:5" })]);
  });
});
