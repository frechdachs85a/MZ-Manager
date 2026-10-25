import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrieren } from "@/lib/db/schema";
import { speichereTopSpiel } from "@/lib/db/top-spiel";
import { spielMuster } from "@/lib/mz/analyse/muster";
import { parseStatsXml } from "@/lib/mz/parser/stats";
import { portfolioAnalyse, regelcheck } from "./portfolio";

describe("Regelcheck einer Startaufstellung", () => {
  it("kupass-Koordinaten aus mz-wissen.md, Abschnitt 8, halten Regel 1 und 2 ein", () => {
    const kupass = [[33, 222], [79, 235], [127, 235], [175, 222], [79, 186], [127, 186], [103, 142], [72, 100], [134, 100], [103, 63]].map(([x, y]) => ({ x, y }));
    const c = regelcheck(kupass);
    expect(c.stuermer).toBe(3);
    expect(c.minY).toBe(63);
    expect(c.verstoesse).toEqual([]);
    expect(regelcheck([{ x: 100, y: 60 }, { x: 110, y: 70 }]).verstoesse).toHaveLength(2);
  });
});

// 7 echte Ligaspiele von YugiPeeK, hier testweise als "Topteam" eingetragen (nur lokal)
const MIDS = [1625669242, 1625669247, 1625669257, 1625669263, 1625669264, 1625669272, 1625669276];
const F = (m: number) => new URL(`./mz/parser/fixtures/stats-${m}.xml`, import.meta.url);

describe.skipIf(!MIDS.every((m) => existsSync(F(m))))("Portfolio aus Topteam-Spielen", () => {
  it("zählt jeden Stil je Gegnerklasse, schlägt verlorene Stile nicht vor", () => {
    const db = new Database(":memory:");
    migrieren(db);
    db.prepare("INSERT INTO top_team VALUES (97933, 1, 'Test', 'Test', '2026-10-25')").run();
    for (const m of MIDS) {
      const xml = readFileSync(F(m), "utf8");
      const s = parseStatsXml(xml);
      speichereTopSpiel(db, 97933, "liga", spielMuster(s, 97933, { anonym: true }));
      const heim = s.teams.find((t) => t.heim)!;
      const gast = s.teams.find((t) => !t.heim)!;
      db.prepare("INSERT INTO team_spiel (tid, mid, datum, art, daten_json, stand) VALUES (?, ?, ?, ?, ?, ?)").run(
        97933, m, s.datum!.slice(0, 10), "Ligaspiel",
        JSON.stringify({ mid: m, datum: s.datum!.slice(0, 10), art: "Ligaspiel", wettbewerb: "div1", altersklasse: false, heim: { name: heim.name }, gast: { name: gast.name }, tore: { heim: 0, gast: 0 } }),
        "x",
      );
    }
    const p = portfolioAnalyse(db);
    expect(p.spiele).toBe(7);
    expect(p.klassen.reduce((n, k) => n + k.spiele, 0)).toBe(7);
    expect(p.fehlend).toEqual([]); // 0 Siege: nichts bewährt
    const e = p.klassen[0].stile[0];
    expect(e.beispiel.feld).toHaveLength(10);
  });
});
